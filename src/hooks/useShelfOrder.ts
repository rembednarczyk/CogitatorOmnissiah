import { useCallback } from "react";

/**
 * Persists manual shelf order keys (precise drag&drop → POST /api/shelf-order).
 * Network transport only — the optimistic override and rollback stay in the component
 * (that's UI state). Extracted from `BookshelfSection` so the component does no I/O of its own (§2).
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
