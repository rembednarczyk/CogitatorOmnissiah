import { useState, useCallback, useRef } from "react";
import { storedToView, StoredView } from "../utils/vintedSellers";

/**
 * Etap 3: wczytuje SKŁADOWANE wyniki Vinted z Notion (`GET /api/vinted-stored`) i mapuje
 * na widok renderowalny tym samym UI co skan live — kafelki i paczki lecą z bazy, bez
 * re-scrape. Zwykły GET (odczyt Notion, nie Cloudflare), więc bez SSE/watchdoga.
 *
 * Ochrona przed wyścigiem: `genRef` + AbortController — gdy w trakcie wolnego GET-a
 * użytkownik ruszy skan/resolucję (które wołają `clearStored`), przestarzała odpowiedź
 * jest porzucana i nie „porywa" widoku (nie ustawia `stored` po fakcie).
 */
export function useVintedStored() {
  const [stored, setStored] = useState<StoredView | null>(null);
  const [isLoadingStored, setIsLoadingStored] = useState(false);
  const [storedError, setStoredError] = useState<string | null>(null);
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadStored = useCallback(async () => {
    const gen = ++genRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsLoadingStored(true);
    setStoredError(null);
    try {
      const res = await fetch("/api/vinted-stored", { signal: ac.signal });
      if (gen !== genRef.current) return; // unieważnione (clear/nowe żądanie)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Błąd serwera: ${res.status}`);
      }
      const data = await res.json();
      if (gen !== genRef.current) return; // sprawdź ponownie po await
      setStored(storedToView(data.books || []));
    } catch (err: any) {
      if (err?.name === "AbortError" || gen !== genRef.current) return;
      setStoredError(err.message);
    } finally {
      if (gen === genRef.current) setIsLoadingStored(false);
    }
  }, []);

  const clearStored = useCallback(() => {
    // Unieważnij każdy load w locie (bump pokolenia + abort) i wyjdź z widoku bazy.
    genRef.current++;
    abortRef.current?.abort();
    setIsLoadingStored(false);
    setStored(null);
  }, []);

  return { stored, isLoadingStored, storedError, loadStored, clearStored };
}
