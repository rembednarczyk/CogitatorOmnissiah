import { useState, useCallback, useRef } from "react";
import { consumeSSE } from "../utils/sse";
import { createStallWatchdog } from "../utils/stallWatchdog";
import { VintedSeller } from "../utils/vintedSellers";

/**
 * Hook grupowania Vinted per sprzedawca (on-demand). Wysyła URL-e wybranych ofert
 * (zwykle najtańsza/książkę), a serwer dociąga sprzedawcę ze strony każdej oferty i
 * strumieniuje `seller_resolved`. Zbiera mapę `url → sprzedawca`; samo grupowanie na
 * niej robi czysty `groupBySeller`. Wzorzec SSE jak w useVintedCheck (watchdog 120 s).
 */
export function useVintedGrouping() {
  const [sellersByUrl, setSellersByUrl] = useState<Record<string, VintedSeller | null>>({});
  const [isGrouping, setIsGrouping] = useState(false);
  const [groupProgress, setGroupProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const runGrouping = useCallback(async (urls: string[]) => {
    if (runningRef.current || urls.length === 0) return;
    runningRef.current = true;
    setIsGrouping(true);
    setSellersByUrl({});
    setGroupProgress({ current: 0, total: urls.length, message: "Inicjowanie..." });
    setGroupError(null);

    const watchdog = createStallWatchdog(120000);
    try {
      watchdog.arm();
      const response = await fetch("/api/vinted-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: urls.map(url => ({ url })) }),
        signal: watchdog.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Błąd serwera: ${response.status}`);
      }

      await consumeSSE(response.body, (data) => {
        if (data.type === "progress" || data.type === "status") {
          setGroupProgress(prev => ({
            current: data.current ?? prev?.current ?? 0,
            total: data.total ?? prev?.total ?? urls.length,
            message: data.message ?? "",
          }));
        } else if (data.type === "seller_resolved") {
          const { url, seller } = data.result || {};
          if (url) setSellersByUrl(prev => ({ ...prev, [url]: seller ?? null }));
        } else if (data.type === "error") {
          throw new Error(data.error);
        }
      }, watchdog.arm);
    } catch (err: any) {
      setGroupError(
        watchdog.stalled
          ? "Połączenie z serwerem zawisło (brak odpowiedzi przez 120 s). Odśwież i spróbuj ponownie."
          : err.message
      );
    } finally {
      watchdog.clear();
      runningRef.current = false;
      setIsGrouping(false);
      setGroupProgress(null);
    }
  }, []);

  const stopGrouping = useCallback(async () => {
    try {
      await fetch("/api/vinted-group/stop", { method: "POST" });
    } catch (err) {
      console.error("Error stopping Vinted grouping:", err);
    }
  }, []);

  return { sellersByUrl, isGrouping, groupProgress, groupError, runGrouping, stopGrouping };
}
