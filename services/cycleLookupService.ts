import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { WikiParser } from "../wiki.parser";
import { NotionBook } from "../src/types";
import { isWikiAuthorMatch } from "./dataNormalizer";
import { createLogger } from "../logger";

const log = createLogger("CycleLookup");

/** Status jednego tomu względem TWOJEJ bazy (krzyżowanie po znormalizowanym tytule). */
export interface CycleVolume {
  title: string;
  /** Czy to książka, z której wyszedł podgląd. */
  isCurrent: boolean;
  /** Czy tom jest w bazie Notion. */
  inBase: boolean;
  read: boolean;
  owned: boolean;
  /** Czy tom jest nagrodzony (ma jakąkolwiek nagrodę w bazie). */
  awarded: boolean;
  awards: string[];
}

export interface CycleView {
  cycleName: string;
  volumes: CycleVolume[];
  /** Ile tomów PRZED bieżącym nie jest przeczytanych (książki do nadrobienia przed fabułą). */
  unreadBefore: number;
  /** Źródło listy: „chain" (prev/next), „template" ({{Cykl}}), „mixed". */
  source: "chain" | "template" | "mixed" | "single";
}

/** Normalizacja tytułu do krzyżowania: bez formatowania wiki, lowercase, bez interpunkcji brzegowej.
 *  Eksportowana, by rytuał żniw indeksował wiersze DOKŁADNIE tak samo (inaczej „inBase" z
 *  lookup i dopasowanie w żniwach się rozjeżdżają → duplikat wiersza). */
export function normTitle(t: string): string {
  return (t || "")
    .replace(/''+/g, "")
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2")
    .toLowerCase()
    .replace(/[.,:;!?'"„”»«()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_HOPS = 15; // bezpiecznik chodzenia po łańcuchu w każdą stronę

/**
 * Podgląd cyklu dla pojedynczej książki — NA ŻĄDANIE, bez zapisu do Notion.
 * Buduje uporządkowaną listę tomów z łańcucha `|poprzednia=`/`|następna=` (pewny,
 * potwierdzony format), wzbogaca o linki z `{{Cykl}}`, i krzyżuje każdy tom z bazą.
 * Cache w pamięci procesu (klucz: tytuł+autor) — powtórne kliknięcie jest natychmiastowe.
 */
export class CycleLookupService {
  private cache = new Map<string, CycleView | null>();

  constructor(private notion: NotionAdapter, private wiki: WikiAdapter) {}

  /** Rozwiązuje stronę wiki dla (tytuł, autor): direct fetch + search, z bramką autora. */
  private async resolvePage(title: string, author: string): Promise<string> {
    // 1. Bezpośrednie pobranie po dokładnym tytule.
    const direct = await this.wiki.fetchPageContent(title);
    if (direct && (!author || isWikiAuthorMatch(WikiParser.extractAuthor(direct), author))) return direct;
    // 2. Wyszukiwanie po „tytuł autor".
    if (author) {
      const hits = await this.wiki.searchPage(`${title} ${author}`, 3);
      for (const h of hits) {
        const c = await this.wiki.fetchPageContent(h);
        if (c && isWikiAuthorMatch(WikiParser.extractAuthor(c), author)) return c;
      }
    }
    return direct || "";
  }

  /** Fetch po dokładnym tytule sąsiada z łańcucha (bez bramki autora — tytuł z zaufanego pola). */
  private async fetchNeighbor(title: string): Promise<string> {
    try { return await this.wiki.fetchPageContent(title); } catch { return ""; }
  }

  async lookup(rawTitle: string, author: string): Promise<CycleView | null> {
    const key = `${normTitle(rawTitle)}|${(author || "").toLowerCase().trim()}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const result = await this.compute(rawTitle, author);
    this.cache.set(key, result);
    return result;
  }

  private async compute(rawTitle: string, author: string): Promise<CycleView | null> {
    const wikitext = await this.resolvePage(rawTitle, author);
    if (!wikitext) return null;
    const info = WikiParser.extractCycleInfo(wikitext);
    if (!info.cycleName && !info.prev && !info.next && info.templateVolumes.length === 0) return null;

    // Uporządkowany łańcuch: ...prev(prev), prev, [current], next, next(next)...
    const before: string[] = [];
    const after: string[] = [];
    const visited = new Set<string>([normTitle(rawTitle)]);

    let cursor = info.prev;
    for (let i = 0; i < MAX_HOPS && cursor; i++) {
      const n = normTitle(cursor);
      if (visited.has(n)) break;
      visited.add(n);
      before.unshift(cursor);
      const c = await this.fetchNeighbor(cursor);
      cursor = c ? WikiParser.extractCycleInfo(c).prev : null;
    }
    cursor = info.next;
    for (let i = 0; i < MAX_HOPS && cursor; i++) {
      const n = normTitle(cursor);
      if (visited.has(n)) break;
      visited.add(n);
      after.push(cursor);
      const c = await this.fetchNeighbor(cursor);
      cursor = c ? WikiParser.extractCycleInfo(c).next : null;
    }

    const chain = [...before, rawTitle, ...after];
    // Linki z {{Cykl}} — dołóż nieobecne w łańcuchu (dla cykli bez prev/next).
    const extras = info.templateVolumes.filter((t) => !chain.some((c) => normTitle(c) === normTitle(t)));
    const ordered = chain.length > 1 ? [...chain, ...extras] : (extras.length > 0 ? [rawTitle, ...extras] : chain);

    const source: CycleView["source"] =
      chain.length > 1 && extras.length > 0 ? "mixed" :
      chain.length > 1 ? "chain" :
      extras.length > 0 ? "template" : "single";

    // Krzyżowanie z bazą (cache: współdzielone pobranie).
    const books = await this.notion.getBooksForStats(undefined, undefined, { cache: true });
    const byTitle = new Map<string, NotionBook>();
    for (const b of books) {
      for (const t of [b.plTitle, b.origTitle]) if (t) byTitle.set(normTitle(t), b);
    }

    const volumes: CycleVolume[] = ordered.map((title) => {
      const b = byTitle.get(normTitle(title));
      const zr = b?.zrodlo || [];
      return {
        title,
        isCurrent: normTitle(title) === normTitle(rawTitle),
        inBase: !!b,
        read: zr.includes("Przeczytane"),
        owned: zr.includes("Posiadam"),
        awarded: (b?.awards || []).length > 0,
        awards: b?.awards || [],
      };
    });

    const currentIdx = volumes.findIndex((v) => v.isCurrent);
    const unreadBefore = currentIdx > 0 ? volumes.slice(0, currentIdx).filter((v) => !v.read).length : 0;

    // Nazwa cyklu: pole |cykl= jeśli jest; inaczej NIE „Cykl" (wszystkie bezimienne
    // cykle zlałyby się w jedną grupę i większość zostałaby pominięta w żniwach) —
    // bierzemy tytuł PIERWSZEGO tomu, stabilny niezależnie od kotwicy startowej.
    const cycleName = info.cycleName || volumes[0]?.title || "Cykl";
    log.info("Cykl", { title: rawTitle, cycle: cycleName, volumes: volumes.length, source });
    return { cycleName, volumes, unreadBefore, source };
  }
}
