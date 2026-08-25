import { NotionBook } from "../src/types";
import { parseVintedData } from "./vintedStore";

/**
 * „Rynek" — statystyki z blobu `VintedData` (składowane oferty). Czysta funkcja
 * (bez I/O): liczy z pól, które skaner już zebrał. „Chciane" = nieprzeczytane
 * i nieposiadane (te faktycznie warto kupić). Zob. docs/stats-service.md.
 */

export interface CheapOffer { bookId: string; bookTitle: string; price: number; currency: string; url: string }
export interface PriceDrop extends CheapOffer { prevPrice: number }
export interface TopSeller { id: string; login: string; url: string; books: number; total: number }

export interface MarketStats {
  currency: string;
  /** Suma najtańszych ofert po jednej na chcianą książkę z ofertami — koszt skompletowania. */
  completionCost: number;
  /** Ile chcianych książek ma ≥1 ofertę z ceną. */
  booksWithOffers: number;
  /** Łączna liczba ofert z ceną wśród chcianych książek. */
  totalOffers: number;
  /** Najtańsze pojedyncze oferty (top). */
  cheapest: CheapOffer[];
  /** Świeże spadki cen (cena < poprzednia). */
  priceDrops: PriceDrop[];
  /** Sprzedawcy z największą liczbą chcianych książek (naturalne paczki). */
  topSellers: TopSeller[];
}

const isWanted = (b: NotionBook) => {
  const zr = b.zrodlo || [];
  return !zr.includes("Przeczytane") && !zr.includes("Posiadam");
};

export function computeMarketStats(books: NotionBook[]): MarketStats {
  let completionCost = 0;
  let booksWithOffers = 0;
  let totalOffers = 0;
  const cheapestAll: CheapOffer[] = [];
  const drops: PriceDrop[] = [];
  const currencyCount: Record<string, number> = {};
  // seller.id → { login, url, books:Set, total(min-per-book) }
  const sellers: Record<string, { login: string; url: string; books: Set<string>; perBookMin: Record<string, number> }> = {};

  for (const book of books) {
    if (!isWanted(book)) continue;
    const data = parseVintedData(book.vintedData);
    if (!data) continue;
    const title = book.plTitle || book.origTitle || "—";
    const priced = data.offers.filter((o) => typeof o.price === "number" && o.price! > 0);
    if (priced.length === 0) continue;

    booksWithOffers++;
    totalOffers += priced.length;

    let bookMin = Infinity;
    for (const o of priced) {
      const price = o.price as number;
      currencyCount[o.currency] = (currencyCount[o.currency] || 0) + 1;
      if (price < bookMin) bookMin = price;
      cheapestAll.push({ bookId: book.id, bookTitle: title, price, currency: o.currency, url: o.url });
      if (typeof o.prevPrice === "number" && o.prevPrice > price) {
        drops.push({ bookId: book.id, bookTitle: title, price, prevPrice: o.prevPrice, currency: o.currency, url: o.url });
      }
      // Sprzedawca (dociągnięty w etapie 2) — grupowanie chcianych książek.
      if (o.seller?.id) {
        const s = (sellers[o.seller.id] ||= { login: o.seller.login, url: o.seller.url, books: new Set(), perBookMin: {} });
        s.books.add(book.id);
        s.perBookMin[book.id] = Math.min(s.perBookMin[book.id] ?? Infinity, price);
      }
    }
    completionCost += bookMin;
  }

  const currency = Object.entries(currencyCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "PLN";

  const topSellers: TopSeller[] = Object.entries(sellers)
    .map(([id, s]) => ({ id, login: s.login, url: s.url, books: s.books.size, total: Object.values(s.perBookMin).reduce((a, b) => a + b, 0) }))
    .filter((s) => s.books >= 2) // paczka ma sens od 2 książek
    .sort((a, b) => b.books - a.books || a.total - b.total)
    .slice(0, 6);

  return {
    currency,
    completionCost: Math.round(completionCost * 100) / 100,
    booksWithOffers,
    totalOffers,
    cheapest: cheapestAll.sort((a, b) => a.price - b.price).slice(0, 8),
    priceDrops: drops.sort((a, b) => (b.prevPrice - b.price) - (a.prevPrice - a.price)).slice(0, 8),
    topSellers,
  };
}
