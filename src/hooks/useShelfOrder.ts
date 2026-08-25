import { useCallback } from "react";

/**
 * Zapis ręcznych kluczy porządku regału (precyzyjny drag&drop → POST /api/shelf-order).
 * Sam transport sieciowy — optymistyczny override i rollback zostają w komponencie
 * (to stan UI). Wydzielone z `BookshelfSection`, by komponent nie robił własnego I/O (§2).
 */
export function useShelfOrder() {
  const saveOrders = useCallback(async (orders: { pageId: string; order: number }[]): Promise<void> => {
    const res = await fetch("/api/shelf-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.error || `Błąd serwera: ${res.status}`);
    }
  }, []);

  return { saveOrders };
}
