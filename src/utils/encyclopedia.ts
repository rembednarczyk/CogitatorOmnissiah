/**
 * Single source of truth for the link to a page in the Archiwum Encyklopedii Fantastyki.
 * Volume/book title = wiki page name; spaces → „_", then `encodeURIComponent`.
 * Shared by the frontend (cycle panels) and backend (harvest — link next to the title).
 * Pure module, no Node/DOM dependencies (pattern like `configSchema.ts`).
 */
export function encyclopediaUrl(title: string): string {
  return `https://encyklopediafantastyki.pl/index.php?title=${encodeURIComponent((title || "").replace(/ /g, "_"))}`;
}
