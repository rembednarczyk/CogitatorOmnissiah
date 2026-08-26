// Helpers for presenting Vinted offers (pure, testable): sorting by price
// ascending (offers without a price at the end), price range for the card header and
// formatting the amount in Polish style.

export interface OfferLike {
  priceValue?: number | null;
  currency?: string;
}

/** Currency to display: PLN → „zł", otherwise the code unchanged. */
function currencyLabel(currency?: string): string {
  if (!currency) return "zł";
  const c = currency.trim().toUpperCase();
  return c === "PLN" || c === "ZŁ" ? "zł" : currency;
}

/** „12,00 zł" for a known price; „cena w ofercie" when unknown (placeholder). */
export function formatVintedPrice(value: number | null | undefined, currency?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "cena w ofercie";
  return `${value.toFixed(2).replace(".", ",")} ${currencyLabel(currency)}`;
}

/**
 * Sorts offers ascending by price; offers without a price (priceValue == null) land at
 * the end. Returns a NEW array (doesn't mutate the input).
 */
export function sortOffersByPrice<T extends OfferLike>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const av = a.priceValue ?? null;
    const bv = b.priceValue ?? null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return av - bv;
  });
}

/**
 * Cleans the offer title for display: decodes HTML entities and cuts off the „tail"
 * from the Vinted description (the „, Stan: …" condition and appended amounts), because the
 * parser's HTML paths take the listing's title attribute with the whole description and price inside.
 */
export function cleanOfferTitle(title: string): string {
  let t = (title || "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  t = t.replace(/,\s*Stan:.*$/i, "");                 // cut off the condition and everything after it
  t = t.replace(/,?\s*\d+[.,]\d+\s*(?:zł|PLN).*$/i, ""); // fallback: appended price tail
  return t.trim();
}

/** Minimum price (or null when no offer has a price) and the number of offers. */
export function offersPriceSummary(items: OfferLike[]): { min: number | null; count: number } {
  const prices = items
    .map((i) => i.priceValue)
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  return { min: prices.length ? Math.min(...prices) : null, count: items.length };
}

/**
 * Sorts result CARDS by each book's cheapest offer (ascending). Books
 * without any known price land at the end. Returns a NEW array (doesn't mutate).
 * Used for dynamically arranging results during the scan.
 */
export function sortResultsByCheapest<T extends { vintedItems: OfferLike[] }>(results: T[]): T[] {
  return [...results].sort((a, b) => {
    const am = offersPriceSummary(a.vintedItems).min;
    const bm = offersPriceSummary(b.vintedItems).min;
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return am - bm;
  });
}
