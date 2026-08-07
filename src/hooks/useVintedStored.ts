import { useState, useCallback } from "react";
import { storedToView, StoredView } from "../utils/vintedSellers";

/**
 * Etap 3: wczytuje SKŁADOWANE wyniki Vinted z Notion (`GET /api/vinted-stored`) i mapuje
 * na widok renderowalny tym samym UI co skan live — kafelki i paczki lecą z bazy, bez
 * re-scrape. Zwykły GET (odczyt Notion, nie Cloudflare), więc bez SSE/watchdoga.
 */
export function useVintedStored() {
  const [stored, setStored] = useState<StoredView | null>(null);
  const [isLoadingStored, setIsLoadingStored] = useState(false);
  const [storedError, setStoredError] = useState<string | null>(null);

  const loadStored = useCallback(async () => {
    setIsLoadingStored(true);
    setStoredError(null);
    try {
      const res = await fetch("/api/vinted-stored");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Błąd serwera: ${res.status}`);
      }
      const data = await res.json();
      setStored(storedToView(data.books || []));
    } catch (err: any) {
      setStoredError(err.message);
    } finally {
      setIsLoadingStored(false);
    }
  }, []);

  const clearStored = useCallback(() => setStored(null), []);

  return { stored, isLoadingStored, storedError, loadStored, clearStored };
}
