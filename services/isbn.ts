/**
 * Pure ISBN helpers (no I/O). A scanned book barcode is an EAN-13 = ISBN-13.
 * We normalize everything to a validated ISBN-13 so lookups and stored values
 * compare on one canonical form. ISBN-10 (older books) is converted to 13.
 */

/** Keep only digits and a trailing X (ISBN-10 check char); uppercase the X. */
function cleanIsbnChars(raw: string): string {
  return (raw || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

/** Polish ISBN-13 prefix (978-83…). The scanned physical copies are Polish editions. */
const POLISH_PREFIX = "97883";

/** Max ISBNs stored per row — Polish-first, comfortably under Notion's 2000-char limit. */
export const MAX_STORED_ISBNS = 40;

/**
 * Order + cap the stored edition ISBNs for a book. Polish editions (978-83…) come
 * FIRST so a scan of the physical Polish copy always matches AND survives Notion's
 * 2000-char field limit (the tail is what gets truncated); the list is then capped so
 * a generic title (e.g. „451° Fahrenheita" → 130+ foreign editions) can't bloat a row.
 */
export function prioritizeIsbns(isbns: string[], cap = MAX_STORED_ISBNS): string[] {
  const seen = new Set<string>();
  const deduped = isbns.filter((i) => (seen.has(i) ? false : (seen.add(i), true)));
  const polish = deduped.filter((i) => i.startsWith(POLISH_PREFIX));
  const rest = deduped.filter((i) => !i.startsWith(POLISH_PREFIX));
  return [...polish, ...rest].slice(0, cap);
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
 * ISBN-13 → ISBN-10 (only for the 978 prefix; 979 has no ISBN-10 equivalent). Recovers
 * the pre-2007 10-digit form so old numbers stay searchable — e.g. „9788370012250"
 * (Slan) → „8370012256". Returns null when the input isn't a 978 ISBN-13.
 */
export function isbn13to10(isbn13: string): string | null {
  const s = cleanIsbnChars(isbn13);
  if (!/^978\d{10}$/.test(s)) return null;
  const core = s.slice(3, 12); // 9 digits after „978"
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? "X" : String(check));
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
