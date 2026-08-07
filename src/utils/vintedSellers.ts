import { VintedResult } from "../hooks/useVintedCheck";

/** Sprzedawca Vinted (dociągany ze strony oferty, nie z katalogu). */
export interface VintedSeller {
  id: string;
  login: string;
  url: string;
}

export interface SellerBundle {
  seller: VintedSeller;
  entries: { bookTitle: string; bookAuthor: string; item: VintedResult["vintedItems"][number] }[];
  /** Suma cen ofert w paczce (znane ceny). */
  totalValue: number;
}

/**
 * Nakłada mapę `url → sprzedawca` (dociągniętą on-demand) na wyniki skanu i zwraca
 * paczki: sprzedawców mających ≥2 RÓŻNE książki. To „low hanging fruit" — u jednej
 * osoby można kupić kilka pozycji naraz. Czysta funkcja (bez I/O) — testowalna.
 */
export function groupBySeller(
  results: VintedResult[],
  sellersByUrl: Record<string, VintedSeller | null>,
): SellerBundle[] {
  const byId = new Map<string, SellerBundle>();
  for (const r of results) {
    for (const item of r.vintedItems) {
      const seller = item.url ? sellersByUrl[item.url] : null;
      if (!seller) continue;
      let bundle = byId.get(seller.id);
      if (!bundle) {
        bundle = { seller, entries: [], totalValue: 0 };
        byId.set(seller.id, bundle);
      }
      // Nie dubluj tej samej książki u tego samego sprzedawcy.
      if (!bundle.entries.some(e => e.bookTitle === r.title)) {
        bundle.entries.push({ bookTitle: r.title, bookAuthor: r.author, item });
      }
    }
  }
  const bundles = [...byId.values()].filter(b => b.entries.length >= 2);
  for (const b of bundles) {
    b.totalValue = b.entries.reduce((sum, e) => sum + (e.item.priceValue ?? 0), 0);
  }
  // Najpierw najwięcej książek, potem najtańsza suma.
  return bundles.sort((a, b) => b.entries.length - a.entries.length || a.totalValue - b.totalValue);
}
