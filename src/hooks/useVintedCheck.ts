import { useState, useCallback, useRef } from "react";
import { consumeSSE } from "../utils/sse";
import { createStallWatchdog } from "../utils/stallWatchdog";

export interface VintedResult {
  id: string;
  title: string;
  author: string;
  searchUrl?: string;
  /** Znacznik świeżości — kiedy skanowano tę książkę (tylko dla danych z bazy, etap 3). */
  scannedAt?: string;
  vintedItems: {
    id?: string;
    title: string;
    price: string | number;
    priceValue?: number | null;
    currency: string;
    url: string;
    photo?: string | null;
  }[];
}

export interface VintedSearchAttempt {
  id: string;
  title: string;
  author: string;
  url: string;
  status: "pending" | "success" | "no_results" | "blocked" | "error";
  itemCount: number;
  // Diagnostyka (Krok 2) — pomaga odróżnić realny brak ofert od bloku / gubienia
  // ofert przez parser. Kształt zależny od ścieżki (HTML vs błąd sieci).
  debug?: {
    chars?: number;
    hasCatalogJson?: boolean;
    hasFeedGrid?: boolean;
    itemLinks?: number;
    blockedMarker?: boolean;
    noResultsMarker?: boolean;
    parsed?: number;
    error?: string;
    code?: string;
    httpStatus?: number;
    // Diagnostyka OOM (Krok 2): pamięć procesu po każdej próbie. Rosnące rssMb ku
    // limitowi hostingu (Render free = 512 MB) tuż przed śmiercią skanu = OOM-kill.
    rssMb?: number;
    heapMb?: number;
  };
}

export function useVintedCheck() {
  const [vintedResults, setVintedResults] = useState<VintedResult[]>([]);
  const [searchAttempts, setSearchAttempts] = useState<VintedSearchAttempt[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number; message: string; startTime: number | null } | null>(null);
  const [vintedError, setVintedError] = useState<string | null>(null);
  // Ref zamiast stanu w strażniku — stan w domknięciu bywa nieaktualny
  const isCheckingRef = useRef(false);

  const runVintedCheck = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);
    setVintedResults([]);
    setSearchAttempts([]);
    setCheckProgress({ current: 0, total: 0, message: "Inicjowanie...", startTime: Date.now() });
    setVintedError(null);

    // Skaner Vinted potrafi milczeć długo na jednej książce: withRetry(3, 4000) przy
    // timeout 30 s daje worst-case ~102 s ciszy (30+4+30+8+30) na wolnej/blokowanej
    // pozycji, gdy serwer wysyła tylko keepalive (a Render bywa go buforuje). Domyślne
    // 30 s ucinało wtedy fetch → serwer widział rozłączenie → self-kill całego skanu.
    // 120 s pokrywa ten worst-case bez ruszania timingu scrapera (nie zmniejsza trafień).
    const watchdog = createStallWatchdog(120000);

    try {
      watchdog.arm();
      const response = await fetch("/api/vinted-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: watchdog.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Błąd serwera: ${response.status}`);
      }

      await consumeSSE(response.body, (data) => {
        if (data.type === "progress") {
          setCheckProgress(prev => ({
            current: data.current ?? 0,
            total: data.total ?? 0,
            message: data.message ?? "",
            startTime: prev?.startTime || Date.now()
          }));
        } else if (data.type === "status") {
          setCheckProgress(prev => ({
            current: prev?.current || 0,
            total: prev?.total || 0,
            message: data.message ?? "",
            startTime: prev?.startTime || Date.now()
          }));
        } else if (data.type === "match") {
          setVintedResults(prev => {
            if (prev.some(r => r.id === data.result.id)) return prev;
            return [...prev, data.result];
          });
        } else if (data.type === "search_attempt") {
          setSearchAttempts(prev => {
            const existing = prev.findIndex(a => a.id === data.result.id);
            if (existing !== -1) {
              const next = [...prev];
              next[existing] = data.result;
              return next;
            }
            return [...prev, data.result];
          });
        } else if (data.type === "complete") {
          setVintedResults(data.result.results);
        } else if (data.type === "error") {
          throw new Error(data.error);
        }
      }, watchdog.arm);
    } catch (err: any) {
      setVintedError(
        watchdog.stalled
          ? "Połączenie z serwerem zawisło (brak odpowiedzi przez 120 s). Możliwe buforowanie strumienia przez hosting. Odśwież i spróbuj ponownie."
          : err.message
      );
    } finally {
      watchdog.clear();
      isCheckingRef.current = false;
      setIsChecking(false);
      setCheckProgress(null);
    }
  }, []);

  const stopVintedCheck = useCallback(async () => {
    try {
      await fetch("/api/vinted-check/stop", { method: "POST" });
    } catch (err) {
      console.error("Error stopping Vinted check:", err);
    }
  }, []);

  return { 
    vintedResults, 
    searchAttempts,
    isChecking, 
    checkProgress, 
    vintedError, 
    runVintedCheck, 
    stopVintedCheck 
  };
}
