import { BookIndexEntry } from "../types";

/**
 * Fold diakrytyków PER ZNAK (nie NFD): mapuje polskie litery na łacińskie
 * odpowiedniki i lowercase'uje. Świadomie NIE używamy `normalize('NFD')` —
 * NFD nie rozkłada „ł" (U+0142), a fold per-znak jest 1:1 na długość, dzięki
 * czemu indeksy trafień mapują wprost na oryginalny tekst (podświetlanie).
 */
const FOLD: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ż: "z", ź: "z",
};

export function fold(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) out += FOLD[ch] ?? ch;
  return out;
}

/** Rozbija zapytanie na tokeny (spacje) po foldzie. */
function tokenize(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/**
 * Filtruje + rankuje indeks po tytule (PL + oryginalny) i autorze. Każdy token
 * musi trafić (AND) jako substring w KTÓRYMKOLWIEK z pól — dzięki temu „simmons
 * hyperion" łączy autora z tytułu. Puste zapytanie → cały zbiór (tryb przeglądu).
 * Ranking: prefiks tytułu > substring tytułu > tytuł oryginalny > autor.
 */
export function matchBooks(query: string, index: BookIndexEntry[]): BookIndexEntry[] {
  const tokens = tokenize(query);
  // Tytuł efektywny = polski, a gdy go brak — oryginalny (rekordy nieprzetłumaczone).
  const displayTitle = (b: BookIndexEntry) => b.plTitle || b.origTitle;
  const byTitle = (a: BookIndexEntry, b: BookIndexEntry) => displayTitle(a).localeCompare(displayTitle(b), "pl");

  if (!tokens.length) return [...index].sort(byTitle);

  const scored: { book: BookIndexEntry; score: number }[] = [];
  for (const b of index) {
    const title = fold(displayTitle(b));
    const orig = fold(b.origTitle);
    const author = fold(b.author);
    const matchesAll = tokens.every((t) => title.includes(t) || orig.includes(t) || author.includes(t));
    if (!matchesAll) continue;

    const t0 = tokens[0];
    const score = title.startsWith(t0) ? 0
      : title.includes(t0) ? 1
      : orig.includes(t0) ? 2
      : 3;
    scored.push({ book: b, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || byTitle(a.book, b.book))
    .map((s) => s.book);
}

export interface HighlightSegment {
  text: string;
  hit: boolean;
}

/**
 * Dzieli tekst na segmenty trafione/nietrafione względem zapytania. Bazuje na
 * foldzie 1:1 (indeks w folded == indeks w oryginale), więc podświetla we
 * właściwym miejscu mimo diakrytyków. Podświetla tylko tokeny obecne w TYM
 * tekście (token trafiony w innym polu tu nie da zakresu).
 */
export function highlight(text: string, query: string): HighlightSegment[] {
  const tokens = tokenize(query);
  if (!tokens.length || !text) return [{ text, hit: false }];

  const folded = fold(text);
  // Zabezpieczenie: gdyby lowercase zmienił długość (rzadkie unicode), fallback
  // bez podświetlenia zamiast rozjechanych indeksów.
  if (folded.length !== text.length) return [{ text, hit: false }];

  const ranges: [number, number][] = [];
  for (const t of tokens) {
    let from = 0;
    let i = folded.indexOf(t, from);
    while (i !== -1) {
      ranges.push([i, i + t.length]);
      from = i + t.length;
      i = folded.indexOf(t, from);
    }
  }
  if (!ranges.length) return [{ text, hit: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of ranges) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  const segs: HighlightSegment[] = [];
  let cur = 0;
  for (const [s, e] of merged) {
    if (s > cur) segs.push({ text: text.slice(cur, s), hit: false });
    segs.push({ text: text.slice(s, e), hit: true });
    cur = e;
  }
  if (cur < text.length) segs.push({ text: text.slice(cur), hit: false });
  return segs;
}
