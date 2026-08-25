/**
 * Kategoria wiersza w bazie — rozdziela pozycje nagrodowe od pobocznych tomów cykli
 * dodanych rytuałem żniw. Wiersze bez ustawionej „Kategorii" traktujemy jako nagrodowe
 * (zgodność wstecz — istniejące pozycje nie mają tego pola).
 *
 * Konsumenci nagrodowi (statystyki, integralność, indeks Skryptorium/Regału) filtrują
 * `isAwardBook`; skaner Vinted celowo bierze WSZYSTKO (tomy cykli też chcemy skanować).
 */
export const CYCLE_VOLUME_CATEGORY = "Tom cyklu";
export const AWARD_CATEGORY = "Nagroda";

export function isCycleVolume(b: { kategoria?: string }): boolean {
  return b.kategoria === CYCLE_VOLUME_CATEGORY;
}

export function isAwardBook(b: { kategoria?: string }): boolean {
  return !isCycleVolume(b);
}
