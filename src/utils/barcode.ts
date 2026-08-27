import { BookIndexEntry } from "../types";

/**
 * Client-side barcode helpers for the Skryptorium scan flow. A physical book's
 * barcode is an EAN-13, which equals its ISBN-13. Two match paths:
 *   B (direct) — compare the scanned code to a row's stored `isbn` (enrichment ritual);
 *   A (resolve) — no stored match → resolve the ISBN to a title server-side and
 *                 hand that to the existing fuzzy search.
 * The heavy normalization (checksums, ISBN-10→13) lives server-side in
 * `services/isbn.ts`; here we only need digit extraction + a direct compare.
 */

/** True when the browser exposes the native BarcodeDetector API (Android/Chrome). */
export function scanSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

/** Strip everything but digits (barcode readers/typed input may carry dashes, spaces). */
export function cleanScannedCode(raw: string): string {
  return (raw || "").replace(/[^0-9]/g, "");
}

/**
 * A scanned code looks like a book EAN-13 when it's 13 digits and starts with the
 * Bookland prefix 978/979. (A full checksum check happens server-side on resolve.)
 */
export function looksLikeBookIsbn(raw: string): boolean {
  const d = cleanScannedCode(raw);
  return d.length === 13 && (d.startsWith("978") || d.startsWith("979"));
}

/**
 * Direct match (variant B): find the index entry whose stored ISBN equals the
 * scanned code (compared digit-only, so stored formatting doesn't matter).
 * Returns null when nothing carries that ISBN.
 */
export function matchIsbnInIndex(code: string, index: BookIndexEntry[]): BookIndexEntry | null {
  const target = cleanScannedCode(code);
  if (!target) return null;
  for (const b of index) {
    if (b.isbn && cleanScannedCode(b.isbn) === target) return b;
  }
  return null;
}
