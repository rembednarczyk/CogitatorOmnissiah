import { VintedResult } from "../hooks/useVintedCheck";

/** Sprzedawca Vinted (dociągany ze strony oferty, nie z katalogu). */
export interface VintedSeller {
  id: string;
  login: string;
  url: string;
}

export interface SellerBundleEntry {
  bookTitle: string;
  bookAuthor: string;
  /** Najtańsza kopia tej książki U TEGO sprzedawcy. */
  item: VintedResult["vintedItems"][number];
  /** Dopłata vs najtańsza kopia tej książki globalnie (0, gdy to właśnie najtańsza). */
  premium: number;
}

export interface SellerBundle {
  seller: VintedSeller;
  entries: SellerBundleEntry[];
  /** Suma cen (najtańsze kopie u tego sprzedawcy). */
  totalValue: number;
  /** Łączna dopłata za konsolidację vs kupno każdej książki u najtańszego sprzedawcy. */
  totalPremium: number;
}

/**
 * Nakłada mapę `url → sprzedawca` (dociągniętą on-demand) na wyniki skanu i zwraca
 * paczki: sprzedawców mających ≥2 RÓŻNE książki. Dla każdej książki bierze NAJTAŃSZĄ
 * kopię danego sprzedawcy i liczy dopłatę vs najtańsza globalnie — dzięki temu widać
 * tradeoff „dopłacam grosze, ale konsoliduję przesyłkę". Czysta funkcja (bez I/O).
 *
 * Działa w obu trybach: „najtańsze" (tylko najtańsza oferta/książkę ma sprzedawcę →
 * dopłaty = 0) i „wszystkie oferty" (każda oferta ma sprzedawcę → ujawnia many-to-many).
 */
export function groupBySeller(
  results: VintedResult[],
  sellersByUrl: Record<string, VintedSeller | null>,
): SellerBundle[] {
  // Najtańsza cena każdej książki GLOBALNIE (ze wszystkich jej ofert w skanie).
  const globalMin = new Map<string, number>();
  for (const r of results) {
    const prices = r.vintedItems
      .map(i => i.priceValue)
      .filter((p): p is number => p != null);
    if (prices.length) globalMin.set(r.id, Math.min(...prices));
  }

  // seller.id → (book id → najtańszy wpis tego sprzedawcy dla tej książki)
  const byId = new Map<string, { seller: VintedSeller; books: Map<string, SellerBundleEntry> }>();
  for (const r of results) {
    for (const item of r.vintedItems) {
      const seller = item.url ? sellersByUrl[item.url] : null;
      if (!seller) continue;
      let s = byId.get(seller.id);
      if (!s) { s = { seller, books: new Map() }; byId.set(seller.id, s); }

      const price = item.priceValue ?? Infinity;
      const existing = s.books.get(r.id);
      if (!existing || price < (existing.item.priceValue ?? Infinity)) {
        const gmin = globalMin.get(r.id);
        s.books.set(r.id, {
          bookTitle: r.title,
          bookAuthor: r.author,
          item,
          premium: item.priceValue != null && gmin != null ? Math.max(0, item.priceValue - gmin) : 0,
        });
      }
    }
  }

  const bundles: SellerBundle[] = [];
  for (const s of byId.values()) {
    if (s.books.size < 2) continue;
    const entries = [...s.books.values()];
    bundles.push({
      seller: s.seller,
      entries,
      totalValue: entries.reduce((sum, e) => sum + (e.item.priceValue ?? 0), 0),
      totalPremium: entries.reduce((sum, e) => sum + e.premium, 0),
    });
  }
  // Najpierw najwięcej książek, potem najtańsza suma.
  return bundles.sort((a, b) => b.entries.length - a.entries.length || a.totalValue - b.totalValue);
}
