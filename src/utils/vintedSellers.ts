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
  /** Rok wydania (metadana z Notion). */
  bookYear?: string;
  /** Czy książka jest częścią cyklu (metadana z Notion) — ryzyko „kolejny tom". */
  bookPartOfCycle?: boolean;
  /** Nazwa cyklu (metadana z Notion, z żniw) — do etykiety kafelka cyklu. */
  bookCykl?: string;
  /** Numer tomu w cyklu (metadana z Notion, z żniw). */
  bookCyklNr?: number;
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

/** Payload składowanej książki z `GET /api/vinted-stored` (etap 3). */
export interface StoredBookPayload {
  id: string;
  title: string;
  author: string;
  year?: string;
  partOfCycle?: boolean;
  cykl?: string;
  cyklNr?: number;
  scannedAt: string;
  changedAt?: string;
  offers: { url: string; title?: string; price: number | null; currency: string; photo?: string | null; seller?: VintedSeller | null; prevPrice?: number | null; firstSeenAt?: string }[];
}

export interface StoredView {
  results: VintedResult[];
  sellersByUrl: Record<string, VintedSeller | null>;
  /** Najstarszy / najświeższy `scannedAt` w zbiorze (znacznik świeżości). */
  oldest: string | null;
  newest: string | null;
}

/**
 * Czysta transformacja składowanego payloadu → widok renderowalny tym samym UI co skan
 * live (VintedResult[] + mapa url→sprzedawca + zakres świeżości). Dzięki temu kafelki i
 * paczki lecą z bazy bez re-scrape, reużywając `groupBySeller` i istniejący render.
 */
export function storedToView(books: StoredBookPayload[]): StoredView {
  const results: VintedResult[] = [];
  const sellersByUrl: Record<string, VintedSeller | null> = {};
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const b of books) {
    results.push({
      id: b.id,
      title: b.title,
      author: b.author,
      year: b.year,
      partOfCycle: b.partOfCycle,
      cykl: b.cykl,
      cyklNr: b.cyklNr,
      scannedAt: b.scannedAt,
      changedAt: b.changedAt,
      vintedItems: b.offers.map(o => ({
        title: o.title ?? "",
        price: o.price ?? "??",
        priceValue: o.price ?? null,
        currency: o.currency ?? "zł",
        url: o.url,
        photo: o.photo ?? null,
        prevPrice: o.prevPrice ?? null,
        firstSeenAt: o.firstSeenAt,
      })),
    });
    for (const o of b.offers) if (o.url) sellersByUrl[o.url] = o.seller ?? null;
    if (b.scannedAt) {
      if (!oldest || b.scannedAt < oldest) oldest = b.scannedAt;
      if (!newest || b.scannedAt > newest) newest = b.scannedAt;
    }
  }
  return { results, sellersByUrl, oldest, newest };
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
          bookYear: r.year,
          bookPartOfCycle: r.partOfCycle,
          bookCykl: r.cykl,
          bookCyklNr: r.cyklNr,
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
  // Domyślnie: najpierw najwięcej książek, potem najtańsza suma.
  return sortBundles(bundles, "count");
}

/** Kryterium sortowania paczek w UI. */
export type BundleSortMode = "count" | "price";

/**
 * Zwraca KOPIĘ paczek posortowaną wg trybu:
 * - `count`  — najwięcej książek, remis → najtańsza suma (domyślny);
 * - `price`  — najtańsza suma (`totalValue`), remis → najwięcej książek.
 */
export function sortBundles(bundles: SellerBundle[], mode: BundleSortMode): SellerBundle[] {
  const copy = [...bundles];
  if (mode === "price") {
    return copy.sort((a, b) => a.totalValue - b.totalValue || b.entries.length - a.entries.length);
  }
  return copy.sort((a, b) => b.entries.length - a.entries.length || a.totalValue - b.totalValue);
}
