import { VintedResult } from "../hooks/useVintedCheck";

/** Vinted seller (fetched from the offer page, not from the catalog). */
export interface VintedSeller {
  id: string;
  login: string;
  url: string;
}

export interface SellerBundleEntry {
  bookTitle: string;
  bookAuthor: string;
  /** Publication year (metadata from Notion). */
  bookYear?: string;
  /** Whether the book is part of a cycle (metadata from Notion) — risk of „another volume". */
  bookPartOfCycle?: boolean;
  /** Cycle name (metadata from Notion, from the harvest) — for the cycle tile label. */
  bookCykl?: string;
  /** Volume number within the cycle (metadata from Notion, from the harvest). */
  bookCyklNr?: number;
  /** The cheapest copy of this book FROM THIS seller. */
  item: VintedResult["vintedItems"][number];
  /** Surcharge vs the cheapest copy of this book globally (0 when it is the cheapest). */
  premium: number;
}

export interface SellerBundle {
  seller: VintedSeller;
  entries: SellerBundleEntry[];
  /** Sum of prices (cheapest copies from this seller). */
  totalValue: number;
  /** Total consolidation surcharge vs buying each book from the cheapest seller. */
  totalPremium: number;
}

/** Payload of a stored book from `GET /api/vinted-stored` (stage 3). */
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
  /** Oldest / newest `scannedAt` in the set (freshness marker). */
  oldest: string | null;
  newest: string | null;
}

/**
 * Pure transformation of the stored payload → a view renderable by the same UI as the
 * live scan (VintedResult[] + url→seller map + freshness range). This way tiles and
 * bundles come from the DB without a re-scrape, reusing `groupBySeller` and the existing render.
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
 * Applies the `url → seller` map (fetched on-demand) onto the scan results and returns
 * bundles: sellers having ≥2 DIFFERENT books. For each book it takes the CHEAPEST
 * copy from the given seller and computes the surcharge vs the global cheapest — this way you see
 * the tradeoff „I pay pennies extra but consolidate the shipment". Pure function (no I/O).
 *
 * Works in both modes: „najtańsze" (only the cheapest offer/book has a seller →
 * surcharges = 0) and „wszystkie oferty" (every offer has a seller → reveals many-to-many).
 */
export function groupBySeller(
  results: VintedResult[],
  sellersByUrl: Record<string, VintedSeller | null>,
): SellerBundle[] {
  // The cheapest price of each book GLOBALLY (from all its offers in the scan).
  const globalMin = new Map<string, number>();
  for (const r of results) {
    const prices = r.vintedItems
      .map(i => i.priceValue)
      .filter((p): p is number => p != null);
    if (prices.length) globalMin.set(r.id, Math.min(...prices));
  }

  // seller.id → (book id → the cheapest entry from this seller for this book)
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
  // By default: most books first, then the cheapest sum.
  return sortBundles(bundles, "count");
}

/** Sort criterion for bundles in the UI. */
export type BundleSortMode = "count" | "price";

/**
 * Returns a COPY of the bundles sorted by mode:
 * - `count`  — most books, tie → cheapest sum (default);
 * - `price`  — cheapest sum (`totalValue`), tie → most books.
 */
export function sortBundles(bundles: SellerBundle[], mode: BundleSortMode): SellerBundle[] {
  const copy = [...bundles];
  if (mode === "price") {
    return copy.sort((a, b) => a.totalValue - b.totalValue || b.entries.length - a.entries.length);
  }
  return copy.sort((a, b) => b.entries.length - a.entries.length || a.totalValue - b.totalValue);
}
