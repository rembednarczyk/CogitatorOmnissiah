/**
 * Row category in the database — separates award entries from side cycle volumes
 * added by the Rytuał Żniw. Rows without „Kategoria" set are treated as award ones
 * (backward compatibility — existing entries lack this field).
 *
 * Award consumers (stats, integrity, Skryptorium/Regał index) filter on
 * `isAwardBook`; the Vinted scanner deliberately takes EVERYTHING (we want to scan cycle volumes too).
 */
export const CYCLE_VOLUME_CATEGORY = "Tom cyklu";
export const AWARD_CATEGORY = "Nagroda";

export function isCycleVolume(b: { kategoria?: string }): boolean {
  return b.kategoria === CYCLE_VOLUME_CATEGORY;
}

export function isAwardBook(b: { kategoria?: string }): boolean {
  return !isCycleVolume(b);
}
