/**
 * Jedno źródło prawdy dla linku do strony w Archiwum Encyklopedii Fantastyki.
 * Tytuł tomu/książki = nazwa strony wiki; spacje → „_", potem `encodeURIComponent`.
 * Współdzielone przez front (panele cyklu) i backend (żniwa — link przy tytule).
 * Moduł czysty, bez zależności Node/DOM (wzorzec jak `configSchema.ts`).
 */
export function encyclopediaUrl(title: string): string {
  return `https://encyklopediafantastyki.pl/index.php?title=${encodeURIComponent((title || "").replace(/ /g, "_"))}`;
}
