import { VintedItem, VintedSeller } from "./vintedParser";
import { NotionBook } from "../src/types";
import { isVintedUrl, isVintedPhotoUrl } from "./vintedUrl";

/**
 * Persistent storage of Vinted results in Notion (a JSON blob in a book's text field).
 * Separates the expensive/rate-limited data acquisition (scraping behind Cloudflare) from cheap,
 * repeatable analysis (grouping per seller) — once scraped, offers live in the
 * database, so the scan is resumable and analysis needs no re-fetching.
 * See docs/vinted-scanner.md §5.
 */

export interface StoredOffer {
  url: string;
  title?: string;
  /** Price as a number (priceValue). null = unknown. */
  price: number | null;
  currency: string;
  photo?: string | null;
  /** Seller — null until fetched in a separate step (stage 2). */
  seller?: VintedSeller | null;
  /** Price from the PREVIOUS scan (to detect a drop). Set for offers that survived. */
  prevPrice?: number | null;
  /** ISO — when this offer URL first appeared (for the „nowa" marker). */
  firstSeenAt?: string;
}

export interface StoredVintedData {
  /** ISO timestamp of this book's last scan (data freshness). */
  scannedAt: string;
  /** ISO — when the set of offers LAST changed (new/gone/different price). */
  changedAt?: string;
  offers: StoredOffer[];
}

/** View of a book's stored data (for rendering tiles/bundles from the database — stage 3). */
export interface StoredBookView {
  id: string;
  title: string;
  author: string;
  /** Publication year (the „Rok" column in Notion) — metadata, straight from the database. */
  year?: string;
  /** Whether the book is part of a cycle (the „Część cyklu" column, checkbox) — „next volume" risk. */
  partOfCycle?: boolean;
  /** Cycle name (the „Cykl" column) — if determined by the harvest. For the tile label. */
  cykl?: string;
  /** Volume number in the cycle (the „CyklNr" column) — if determined by the harvest. */
  cyklNr?: number;
  scannedAt: string;
  changedAt?: string;
  offers: StoredOffer[];
}

/** Summary of one book's changes between the previous and the fresh scan. */
export interface OfferDiff {
  added: number;
  removed: number;
  priceDropped: number;
  priceRaised: number;
}

export const EMPTY_DIFF: OfferDiff = { added: 0, removed: 0, priceDropped: 0, priceRaised: 0 };

export function hasChanges(d: OfferDiff): boolean {
  return d.added > 0 || d.removed > 0 || d.priceDropped > 0 || d.priceRaised > 0;
}

/**
 * `changedAt` marker policy: bump to `scannedAt` ONLY when a previous
 * state (baseline) exists AND something actually changed — otherwise the first scan would falsely
 * mark the whole book as „zmiana". Without a baseline / without changes: keep the old one.
 */
export function computeChangedAt(prevData: StoredVintedData | null, diff: OfferDiff, scannedAt: string): string | undefined {
  return prevData && hasChanges(diff) ? scannedAt : prevData?.changedAt;
}

/** Projection of a Notion row + stored data → a tile/bundle view (stage 3). */
export function toStoredBookView(book: NotionBook, data: StoredVintedData): StoredBookView {
  return {
    id: book.id,
    title: book.plTitle,
    author: book.author || "",
    year: book.year,
    partOfCycle: book.currentCzesccyklu,
    cykl: book.cykl,
    cyklNr: book.cyklNr,
    scannedAt: data.scannedAt,
    changedAt: data.changedAt,
    offers: data.offers,
  };
}

/**
 * Drops a seller whose profile link isn't a Vinted URL. The parser only ever builds
 * `https://www.vinted.pl/member/{id}`, so a mismatch means the value didn't come from
 * the parser — dropping it is self-healing (the next resolve pass re-fetches it).
 */
function sanitizeSeller(seller: unknown): VintedSeller | null {
  if (!seller || typeof seller !== "object") return null;
  const s = seller as Record<string, unknown>;
  if (typeof s.id !== "string" || typeof s.login !== "string") return null;
  if (!isVintedUrl(s.url)) return null;
  return { id: s.id, login: s.login, url: s.url };
}

/**
 * Validates ONE stored offer against the host allow-list. Returns null when the offer
 * must be dropped entirely (a non-Vinted `url` — the offer's identity is untrustworthy
 * and it is what the seller-resolve pass would re-fetch). A bad `photo` or `seller` only
 * loses that field, since the offer itself is still usable.
 */
export function sanitizeStoredOffer(raw: unknown): StoredOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isVintedUrl(o.url)) return null;
  return {
    url: o.url,
    title: typeof o.title === "string" ? o.title : undefined,
    price: typeof o.price === "number" && isFinite(o.price) ? o.price : null,
    currency: typeof o.currency === "string" ? o.currency : "PLN",
    photo: isVintedPhotoUrl(o.photo) ? o.photo : null,
    seller: sanitizeSeller(o.seller),
    prevPrice: typeof o.prevPrice === "number" && isFinite(o.prevPrice) ? o.prevPrice : undefined,
    firstSeenAt: typeof o.firstSeenAt === "string" ? o.firstSeenAt : undefined,
  };
}

/** VintedItem (from the scan) → StoredOffer (for storage). Returns null for an
 *  off-site URL — defence in depth, so a hostile scraped link never even gets stored. */
export function offerFromItem(item: VintedItem): StoredOffer | null {
  if (!isVintedUrl(item.url)) return null;
  return {
    url: item.url,
    title: item.title,
    price: item.priceValue,
    currency: item.currency,
    photo: isVintedPhotoUrl(item.photo) ? item.photo : null,
    seller: sanitizeSeller(item.seller),
  };
}

export function serializeVintedData(data: StoredVintedData): string {
  return JSON.stringify(data);
}

/** Parses the blob from Notion; returns null for empty/corrupt (doesn't crash the scan). */
export function parseVintedData(raw: string | null | undefined): StoredVintedData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d && typeof d === "object" && Array.isArray(d.offers)) {
      return {
        scannedAt: typeof d.scannedAt === "string" ? d.scannedAt : "",
        changedAt: typeof d.changedAt === "string" ? d.changedAt : undefined,
        // Every offer is re-validated on the way OUT of storage, not just on the way in:
        // the blob lives in Notion, so anything that can write there could otherwise
        // smuggle an off-site URL past the parser's guarantee (→ SSRF on the re-fetch,
        // and an unvalidated `href` in the UI). Bad offers are dropped, not repaired.
        offers: d.offers.map(sanitizeStoredOffer).filter((o: StoredOffer | null): o is StoredOffer => o !== null),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Merges freshly scanned offers with the stored ones AND computes a diff (new / gone /
 * price change). PRESERVES the recognized seller and `firstSeenAt` for offers with an unchanged
 * URL (a re-scan doesn't wipe stage-2 seller data), sets `prevPrice` = price from the
 * previous scan (to detect a drop), and stamps new offers with `firstSeenAt = scannedAt`.
 */
export function mergeAndDiff(
  fresh: StoredOffer[],
  prev: StoredOffer[] | undefined,
  scannedAt: string,
): { offers: StoredOffer[]; diff: OfferDiff } {
  const prevByUrl = new Map((prev ?? []).map(o => [o.url, o]));

  // Dedupe fresh ones by URL — the parser can return the same offer twice; without this
  // `added` and the offer list balloon (a duplicate rendered 2× and counted as 2 „nowe").
  const uniqueFresh: StoredOffer[] = [];
  const freshUrls = new Set<string>();
  for (const o of fresh) {
    if (freshUrls.has(o.url)) continue;
    freshUrls.add(o.url);
    uniqueFresh.push(o);
  }

  let added = 0, priceDropped = 0, priceRaised = 0;
  const offers: StoredOffer[] = uniqueFresh.map(o => {
    const old = prevByUrl.get(o.url);
    if (!old) {
      added++;
      return { ...o, seller: o.seller ?? null, firstSeenAt: scannedAt };
    }
    // Offer survived: keep the seller and the ORIGINAL firstSeenAt (may be undefined
    // for old blobs from before this function — then we do NOT mark it as „nowa"), record
    // the previous price to detect a drop.
    const seller = o.seller ?? old.seller ?? null;
    const firstSeenAt = old.firstSeenAt;
    const prevPrice = typeof old.price === "number" ? old.price : null;
    if (typeof o.price === "number" && typeof old.price === "number" && o.price !== old.price) {
      if (o.price < old.price) priceDropped++; else priceRaised++;
    }
    return { ...o, seller, firstSeenAt, prevPrice };
  });

  const removed = (prev ?? []).filter(o => !freshUrls.has(o.url)).length;
  return { offers, diff: { added, removed, priceDropped, priceRaised } };
}
