/**
 * Pure ISBN helpers (no I/O). A scanned book barcode is an EAN-13 = ISBN-13.
 * We normalize everything to a validated ISBN-13 so lookups and stored values
 * compare on one canonical form. ISBN-10 (older books) is converted to 13.
 */

/** Keep only digits and a trailing X (ISBN-10 check char); uppercase the X. */
function cleanIsbnChars(raw: string): string {
  return (raw || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

/** EAN-13 / ISBN-13 checksum: Σ d_i·(1,3,1,3…) ≡ 0 (mod 10). */
export function isValidIsbn13(s: string): boolean {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

/** ISBN-10 checksum: Σ d_i·(10-i) ≡ 0 (mod 11); last digit may be X (=10). */
export function isValidIsbn10(s: string): boolean {
  if (!/^\d{9}[0-9X]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i);
  sum += s[9] === "X" ? 10 : Number(s[9]);
  return sum % 11 === 0;
}

/** ISBN-10 → ISBN-13 (prefix 978, recompute the check digit). Assumes a valid ISBN-10. */
export function isbn10to13(isbn10: string): string {
  const core = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return core + check;
}

/**
 * Normalize any scanned/typed code to a canonical, checksum-valid ISBN-13, or null
 * when it isn't a real ISBN (wrong length, bad checksum, non-book EAN). EAN-13s that
 * aren't books (prefix ≠ 978/979) are rejected so a random product barcode can't match.
 */
export function normalizeIsbn(raw: string): string | null {
  const s = cleanIsbnChars(raw);
  if (s.length === 13) {
    return isValidIsbn13(s) && (s.startsWith("978") || s.startsWith("979")) ? s : null;
  }
  if (s.length === 10) {
    return isValidIsbn10(s) ? isbn10to13(s) : null;
  }
  return null;
}
