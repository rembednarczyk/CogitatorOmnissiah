import { useState, useCallback, useRef } from "react";
import { useSSEStream } from "./useSSEStream";

export interface VintedResult {
  id: string;
  title: string;
  author: string;
  searchUrl?: string;
  /** Publication year (the „Rok" column; from the database). */
  year?: string;
  /** Part of a cycle (the „Część cyklu" column; from the database) — risk of the „next volume". */
  partOfCycle?: boolean;
  /** Cycle name (the „Cykl" column; from harvest) — for the cycle tile label. */
  cykl?: string;
  /** Volume number in the cycle (the „CyklNr" column; from harvest). */
  cyklNr?: number;
  /** Freshness marker — when this book was scanned (only for database data, stage 3). */
  scannedAt?: string;
  /** When the offer set last changed (from the database). When == scannedAt → changed in the last scan. */
  changedAt?: string;
  vintedItems: {
    id?: string;
    title: string;
    price: string | number;
    priceValue?: number | null;
    currency: string;
    url: string;
    photo?: string | null;
    /** Price from the previous scan (from the database) — a drop when priceValue < prevPrice. */
    prevPrice?: number | null;
    /** When the offer first appeared (from the database) — „new" when == the book's scannedAt. */
    firstSeenAt?: string;
  }[];
}

export interface VintedSearchAttempt {
  id: string;
  title: string;
  author: string;
  url: string;
  status: "pending" | "success" | "no_results" | "blocked" | "error";
  itemCount: number;
  // Diagnostics (Step 2) — helps tell a genuine lack of offers from a block / the parser
  // dropping offers. Shape depends on the path (HTML vs network error).
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
    // OOM diagnostics (Step 2): process memory after each attempt. rssMb rising toward
    // the hosting limit (Render free = 512 MB) right before the scan dies = OOM-kill.
    rssMb?: number;
    heapMb?: number;
    // Diff against the previous scan (change detection): added/removed/price drop/price rise.
    changes?: { added: number; removed: number; priceDropped: number; priceRaised: number };
  };
}

export function useVintedCheck() {
  const [vintedResults, setVintedResults] = useState<VintedResult[]>([]);
  const [searchAttempts, setSearchAttempts] = useState<VintedSearchAttempt[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number; message: string; startTime: number | null } | null>(null);
  const [vintedError, setVintedError] = useState<string | null>(null);
  // Ref instead of state in the guard — state in the closure can be stale
  const isCheckingRef = useRef(false);

  // The Vinted scanner can go silent for a long time on a single book: withRetry(3, 4000)
  // with a 30 s timeout gives a worst-case ~102 s of silence on a slow/blocked item (the
  // server sends only keepalive, and Render buffers it). 120 s covers that worst-case without
  // touching the scraper's timing (doesn't reduce hits).
  const { run } = useSSEStream("/api/vinted-check", { timeoutMs: 120000 });

  const runVintedCheck = useCallback(async (opts?: { skipScannedWithinHours?: number }) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);
    setVintedResults([]);
    setSearchAttempts([]);
    setCheckProgress({ current: 0, total: 0, message: "Inicjowanie...", startTime: Date.now() });
    setVintedError(null);

    const result = await run({ skipScannedWithinHours: opts?.skipScannedWithinHours }, (data) => {
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
    });

    if (!result.ok && result.error) setVintedError(result.error);
    isCheckingRef.current = false;
    setIsChecking(false);
    setCheckProgress(null);
  }, [run]);

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
