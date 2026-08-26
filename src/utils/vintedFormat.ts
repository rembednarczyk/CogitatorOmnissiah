import { VintedResult, VintedSearchAttempt } from "../hooks/useVintedCheck";

type Offer = VintedResult["vintedItems"][number];

/** Short date „DD.MM" from an ISO timestamp (data freshness from the DB). */
export function shortDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Concise one-line diagnostics of a scan attempt (Step 2). Key signal:
 * itemLinks>0 with parsed:0 and no markers = the parser lost the offers. Rising
 * rssMb toward the hosting limit = an approaching OOM.
 */
export function formatDebug(d: NonNullable<VintedSearchAttempt["debug"]>): string {
  if (d.error) return `⚠ ${d.error}${d.httpStatus ? ` (${d.httpStatus})` : d.code ? ` (${d.code})` : ""}`;
  const parts: string[] = [];
  if (d.chars !== undefined) parts.push(`${(d.chars / 1000).toFixed(0)}k`);
  parts.push(d.hasCatalogJson ? "json" : d.hasFeedGrid ? "grid" : "html");
  if (d.itemLinks !== undefined) parts.push(`links:${d.itemLinks}`);
  if (d.parsed !== undefined) parts.push(`parsed:${d.parsed}`);
  if (d.blockedMarker) parts.push("BLOCK");
  if (d.noResultsMarker) parts.push("noRes");
  if (d.rssMb !== undefined) parts.push(`mem:${d.rssMb}MB`);
  if (d.changes) {
    const c = d.changes;
    const delta: string[] = [];
    if (c.added) delta.push(`+${c.added}`);
    if (c.removed) delta.push(`−${c.removed}`);
    if (c.priceDropped) delta.push(`↓${c.priceDropped}`);
    if (c.priceRaised) delta.push(`↑${c.priceRaised}`);
    if (delta.length) parts.push(`Δ ${delta.join(" ")}`);
  }
  return parts.join(" · ");
}

/**
 * Whether the book tile changed in the LAST scan (`changedAt === scannedAt`).
 * Requires a baseline — the first scan (without `changedAt`) doesn't count as a change.
 */
export function isBookChanged(result: VintedResult): boolean {
  return !!result.changedAt && result.changedAt === result.scannedAt;
}

export interface OfferBadges {
  /** New — the offer appeared in the last scan, but only when that scan actually
   * detected a change (otherwise the first scan would mark all offers as new). */
  isNew: boolean;
  /** Price drop vs the previous scan (zł), or null. */
  drop: number | null;
}

export function offerBadges(item: Offer, result: VintedResult): OfferBadges {
  const isNew = !!item.firstSeenAt
    && item.firstSeenAt === result.scannedAt
    && result.changedAt === result.scannedAt;
  const drop = (item.prevPrice != null && item.priceValue != null && item.priceValue < item.prevPrice)
    ? item.prevPrice - item.priceValue
    : null;
  return { isNew, drop };
}
