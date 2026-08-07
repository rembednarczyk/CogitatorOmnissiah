import { cleanTitle, calculateSimilarity, normalizeAuthor } from "../utils";

/**
 * Parser wyników OPAC (Prolib Integro, MBP Lublin). Czysty (bez I/O) — skaner
 * podaje HTML, dostaje listę rekordów. Struktura strony wyników:
 *   <article data-item-id="…"> … <dl class="dl-horizontal">
 *       <dt>Tytuł:</dt><dd><span>…</span></dd>
 *       <dt>Autorzy:</dt><dd><span><a>Nazwisko, Imię (rok- )</a></span></dd> …
 *   </dl>
 *   <span class="pdt-p-book|pdt-p-movie|pdt-p-audiobook"></span>  ← typ nośnika
 * Zapytanie jest już zawężone do filii (param f2), więc obecność rekordu = filia
 * ma dany egzemplarz w zbiorach.
 */

export type OpacDocType = "ksiazka" | "audiobook" | "film" | "inne";

export interface OpacRecord {
  id: string;
  title: string;
  author: string;
  documentType: OpacDocType;
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Wyciąga wartość pola z listy <dl>: <dt>Label:</dt><dd>…</dd>. */
function dlField(block: string, labelRe: string): string {
  const re = new RegExp(`<dt[^>]*>\\s*${labelRe}\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`, "i");
  const m = block.match(re);
  return m ? stripTags(m[1]) : "";
}

function docTypeOf(block: string): OpacDocType {
  if (/pdt-p-book/.test(block)) return "ksiazka";
  if (/pdt-p-audiobook/.test(block)) return "audiobook";
  if (/pdt-p-movie/.test(block)) return "film";
  return "inne";
}

export function parseOpacResults(html: string): OpacRecord[] {
  const records: OpacRecord[] = [];
  const articleRe = /<article\b[^>]*\bdata-item-id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g;
  let m: RegExpExecArray | null;
  while ((m = articleRe.exec(html)) !== null) {
    const id = m[1];
    const block = m[0];
    const title = dlField(block, "Tytuł:");
    const author = dlField(block, "Autor(?:zy)?:");
    if (!title) continue;
    records.push({ id, title, author, documentType: docTypeOf(block) });
  }
  return records;
}

/**
 * Znajduje najlepiej pasujący rekord KSIĄŻKI (domyślnie z wykluczeniem filmów i
 * audiobooków — wyszukiwanie „gra o tron" zwraca też seriale i inne dzieła autora,
 * a użytkownik szuka konkretnej książki). Dopasowanie = zgodność tytułu (z obsługą
 * tytułów równoległych „Oryginał = Polski") ORAZ autora (gdy znany po obu stronach).
 * Zwraca najlepszy rekord ponad progiem albo null.
 */
export function findBookMatch(
  records: OpacRecord[],
  title: string,
  author: string,
  opts: { includeAudiobook?: boolean } = {},
): OpacRecord | null {
  const wanted: OpacDocType[] = opts.includeAudiobook ? ["ksiazka", "audiobook"] : ["ksiazka"];
  const books = records.filter((r) => wanted.includes(r.documentType));

  const normTitle = cleanTitle(title || "").toLowerCase();
  const normAuthor = normalizeAuthor(author || "");
  if (!normTitle) return null;

  let best: OpacRecord | null = null;
  let bestSim = 0;

  for (const r of books) {
    // Tytuły równoległe: „Game of thrones … = Gra o tron" — porównaj każdą stronę.
    const parts = r.title.split("=").map((s) => cleanTitle(s).toLowerCase()).filter(Boolean);
    let titleSim = 0;
    for (const p of parts) {
      titleSim = Math.max(titleSim, calculateSimilarity(normTitle, p));
      if (normTitle.length > 3 && (p.includes(normTitle) || normTitle.includes(p))) {
        titleSim = Math.max(titleSim, 0.9);
      }
    }
    if (titleSim <= 0.8) continue;

    // Autor: gdy znamy autora z Notion, musi zgadzać się z rekordem (redukuje
    // fałszywe trafienia na inne dzieła tego samego autora złapane po serii/temacie).
    let authorOk = true;
    if (normAuthor) {
      const recAuthor = normalizeAuthor(r.author || "");
      authorOk = !!recAuthor && (
        calculateSimilarity(normAuthor, recAuthor) > 0.6 ||
        recAuthor.includes(normAuthor) ||
        normAuthor.includes(recAuthor)
      );
    }
    if (authorOk && titleSim > bestSim) {
      best = r;
      bestSim = titleSim;
    }
  }
  return best;
}
