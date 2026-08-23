import { VintedResult, VintedSearchAttempt } from "../hooks/useVintedCheck";

type Offer = VintedResult["vintedItems"][number];

/** Krótka data „DD.MM" ze znacznika ISO (świeżość danych z bazy). */
export function shortDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Zwięzła jednolinijkowa diagnostyka próby skanu (Krok 2). Kluczowy sygnał:
 * itemLinks>0 przy parsed:0 i bez markerów = parser zgubił oferty. Rosnące
 * rssMb ku limitowi hostingu = zbliżający się OOM.
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
 * Czy kafelek książki zmienił się w OSTATNIM skanie (`changedAt === scannedAt`).
 * Wymaga baseline — pierwszy skan (bez `changedAt`) nie liczy się jako zmiana.
 */
export function isBookChanged(result: VintedResult): boolean {
  return !!result.changedAt && result.changedAt === result.scannedAt;
}

export interface OfferBadges {
  /** „nowa" — oferta pojawiła się w ostatnim skanie, ale tylko gdy ten skan w ogóle
   * wykrył zmianę (inaczej pierwszy skan oznaczałby wszystkie oferty jako nowe). */
  isNew: boolean;
  /** Spadek ceny vs poprzedni skan (zł), lub null. */
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
