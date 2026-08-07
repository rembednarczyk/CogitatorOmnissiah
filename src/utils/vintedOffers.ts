// Pomocniki prezentacji ofert Vinted (czyste, testowalne): sortowanie po cenie
// rosnąco (oferty bez ceny na końcu), zakres cen do nagłówka karty i formatowanie
// kwoty w polskim stylu.

export interface OfferLike {
  priceValue?: number | null;
  currency?: string;
}

/** Waluta do wyświetlenia: PLN → „zł", w innym wypadku kod bez zmian. */
function currencyLabel(currency?: string): string {
  if (!currency) return "zł";
  const c = currency.trim().toUpperCase();
  return c === "PLN" || c === "ZŁ" ? "zł" : currency;
}

/** „12,00 zł" dla znanej ceny; „cena w ofercie", gdy nieznana (placeholder). */
export function formatVintedPrice(value: number | null | undefined, currency?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "cena w ofercie";
  return `${value.toFixed(2).replace(".", ",")} ${currencyLabel(currency)}`;
}

/**
 * Sortuje oferty rosnąco po cenie; oferty bez ceny (priceValue == null) lądują na
 * końcu. Zwraca NOWĄ tablicę (nie mutuje wejścia).
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

/** Minimalna cena (lub null, gdy żadna oferta nie ma ceny) i liczba ofert. */
export function offersPriceSummary(items: OfferLike[]): { min: number | null; count: number } {
  const prices = items
    .map((i) => i.priceValue)
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  return { min: prices.length ? Math.min(...prices) : null, count: items.length };
}
