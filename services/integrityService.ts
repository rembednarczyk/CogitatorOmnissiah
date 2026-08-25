import { NotionAdapter } from "../notion.adapter";
import { ConfigService } from "./configService";
import { WikiAdapter } from "../wiki.adapter";
import { BookSyncService } from "./bookSyncService";
import { SyncEvent, NotionBook, Book, IntegrityCheckResult } from "../src/types";
import { normalizeData } from "./dataNormalizer";
import { isAwardBook } from "./bookCategory";

export type { IntegrityCheckResult };

const PREDEFINED_AWARDS = [
  { name: "Nagroda Hugo", title: "Hugo nagroda powieść" },
  { name: "Nagroda Nebula", title: "Nebula nagroda najlepsza powieść" },
  { name: "Nagroda Locus", title: "Locus nagroda powieść" }
];

const IGNORED_LOCUS_TAGS = ["Powieść dla młodzieży", "Locus - Powieść dla młodzieży", "Locus YA"];

/** Książka zredukowana do kluczy tożsamości + lat wydania, po scaleniu duplikatów. */
interface MergedBook { years: Set<string>; display: string; keys: string[] }
/** Wejście do scalania: pre-wyekstrahowane klucze/lata/etykieta pojedynczego rekordu. */
interface BookEntry { keys: string[]; years: string[]; display: string }

export class IntegrityService {
  private bookSyncService: BookSyncService;

  constructor(private notion: NotionAdapter, private wiki: WikiAdapter, config: ConfigService) {
    this.bookSyncService = new BookSyncService(notion, wiki, config);
  }

  async runIntegrityCheck(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Inicjalizacja Skanera Sanctity..." });
      await this.notion.init();

      sendEvent({ type: "status", message: "Pobieranie wszystkich danych z Notion..." });
      const allNotionRows = await this.notion.queryAllBooks(
        (count) => sendEvent({ type: "status", message: `Pobrano ${count} rekordów z Notion...` }),
        checkCancellation
      );
      // Integralność dotyczy pozycji NAGRODOWYCH — poboczne tomy cykli (Kategoria=Tom
      // cyklu) nie są na listach nagród wiki, więc wykluczamy je z porównań (rok/Lp).
      const notionBooks = allNotionRows.filter(isAwardBook);
      if (checkCancellation()) return;

      sendEvent({ type: "status", message: "Pobieranie danych z Archiwum Encyklopedii (Nagrody)..." });
      const allWikiBooks = await this.fetchWikiBooks(sendEvent, checkCancellation);
      if (checkCancellation()) return;

      sendEvent({ type: "status", message: "Analiza integralności danych (Rytuał Weryfikacji)..." });

      // Scal duplikaty po kluczach tożsamości (tytuł|autor) — te same mapy zasilają
      // porównanie liczby książek per rok.
      const mergedNotion = this.mergeBooksByKey(this.notionEntries(notionBooks));
      const mergedWiki = this.mergeBooksByKey(this.wikiEntries(allWikiBooks));

      const result: IntegrityCheckResult = {
        lpUniqueness: { status: false, duplicates: this.checkLpUniqueness(notionBooks) },
        originalTitleUniqueness: { status: false, duplicates: this.checkTitleDuplicates(notionBooks, b => b.origTitle || "") },
        polishTitleUniqueness: { status: false, duplicates: this.checkTitleDuplicates(notionBooks, b => b.plTitle || "") },
        yearCountMatch: { status: false, diffs: this.computeYearDiffs(mergedNotion, mergedWiki) },
        awardCountMatch: { status: false, diffs: this.computeAwardDiffs(notionBooks, allWikiBooks) },
      };
      // status = brak rozbieżności
      result.lpUniqueness.status = result.lpUniqueness.duplicates.length === 0;
      result.originalTitleUniqueness.status = result.originalTitleUniqueness.duplicates.length === 0;
      result.polishTitleUniqueness.status = result.polishTitleUniqueness.duplicates.length === 0;
      result.yearCountMatch.status = result.yearCountMatch.diffs.length === 0;
      result.awardCountMatch.status = result.awardCountMatch.diffs.length === 0;

      sendEvent({ type: "complete", result });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }

  private async fetchWikiBooks(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean): Promise<Book[]> {
    let allWikiBooks: Book[] = [];
    for (const aw of PREDEFINED_AWARDS) {
      if (checkCancellation()) break;
      const books = await this.bookSyncService.fetchBooksFromMediaWiki(aw.title, aw.name, sendEvent);
      allWikiBooks = allWikiBooks.concat(books);
    }
    return allWikiBooks;
  }

  /**
   * Klucz tożsamości książki odporny na wariacje: normalizuje autora (mapowania),
   * sortuje i czyści nazwiska, normalizuje tytuł. Pusty tytuł → pusty klucz
   * (odrzucany), by "|autor" nie scalał różnych książek tego samego autora.
   */
  private robustKey(author: string, title: string): string {
    const normalizedAuthor = normalizeData(author || "", 'author');
    const authors = normalizedAuthor.split(',').map(a =>
      a.toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    ).filter(Boolean).sort();
    const normAuthor = authors.join(",");

    const normTitle = normalizeData(title || "", 'title')
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!normTitle) return "";
    return `${normTitle}|${normAuthor}`;
  }

  // --- A. Lp uniqueness ---
  private checkLpUniqueness(books: NotionBook[]): string[] {
    const lpMap = new Map<string, number>();
    books.forEach(b => { if (b.lp) lpMap.set(b.lp, (lpMap.get(b.lp) || 0) + 1); });
    return Array.from(lpMap.entries())
      .filter(([_, count]) => count > 1)
      .map(([lp, count]) => `Lp ${lp}: powtórzony ${count} razy`);
  }

  // --- B/C. Title uniqueness per author (origTitle or plTitle) ---
  private checkTitleDuplicates(books: NotionBook[], pick: (b: NotionBook) => string): string[] {
    const map = new Map<string, number>();
    books.forEach(b => {
      const title = pick(b);
      if (!title) return;
      const key = this.robustKey(b.author || "", title);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .filter(([_, count]) => count > 1)
      .map(([key, count]) => `"${key.split('|')[0]}" (${key.split('|')[1]}): powtórzony ${count} razy`);
  }

  private hasTrackedAward(b: NotionBook): boolean {
    return !!b.awards?.some(aw => {
      const lowerAw = aw.toLowerCase();
      if (lowerAw.includes("locus") && IGNORED_LOCUS_TAGS.some(tag => lowerAw.includes(tag.toLowerCase()))) return false;
      return ["hugo", "nebula", "locus"].some(kw => lowerAw.includes(kw));
    });
  }

  private notionEntries(notionBooks: NotionBook[]): BookEntry[] {
    return notionBooks.filter(b => this.hasTrackedAward(b)).map(b => ({
      keys: [this.robustKey(b.author || "", b.origTitle || ""), this.robustKey(b.author || "", b.plTitle || "")].filter(Boolean),
      years: (b.year || "").split(',').map(y => y.trim()).filter(Boolean),
      display: `"${b.origTitle || b.plTitle}" (${b.author})`,
    }));
  }

  private wikiEntries(allWikiBooks: Book[]): BookEntry[] {
    return allWikiBooks.map(b => ({
      keys: [this.robustKey(b.author || "", b.originalTitle || ""), this.robustKey(b.author || "", b.polishTitle || "")].filter(Boolean),
      years: [b.year.toString()],
      display: `"${b.originalTitle || b.polishTitle}" (${b.author})`,
    }));
  }

  /** Scala rekordy dzielące dowolny klucz tożsamości w jedną książkę (union lat). */
  private mergeBooksByKey(entries: BookEntry[]): Map<string, MergedBook> {
    const merged = new Map<string, MergedBook>();
    const keyToPrimary = new Map<string, string>();
    for (const e of entries) {
      if (e.keys.length === 0) continue;
      let primaryKey = e.keys.find(k => keyToPrimary.has(k));
      if (primaryKey) {
        primaryKey = keyToPrimary.get(primaryKey)!;
      } else {
        primaryKey = e.keys[0];
        merged.set(primaryKey, { years: new Set(), display: e.display, keys: e.keys });
      }
      const data = merged.get(primaryKey)!;
      e.years.forEach(y => { if (y) data.years.add(y); });
      e.keys.forEach(k => keyToPrimary.set(k, primaryKey!));
    }
    return merged;
  }

  // --- D. Book count per year (with cross-match collisions / misplaced) ---
  private computeYearDiffs(mergedNotion: Map<string, MergedBook>, mergedWiki: Map<string, MergedBook>) {
    const countByYear = (merged: Map<string, MergedBook>) => {
      const m = new Map<string, number>();
      merged.forEach(data => data.years.forEach(y => { if (y) m.set(y, (m.get(y) || 0) + 1); }));
      return m;
    };
    const notionYearMap = countByYear(mergedNotion);
    const wikiYearMap = countByYear(mergedWiki);

    const allYears = Array.from(new Set([...notionYearMap.keys(), ...wikiYearMap.keys()])).sort();
    return allYears.map(y => {
      const notionCount = notionYearMap.get(y) || 0;
      const wikiCount = wikiYearMap.get(y) || 0;
      if (notionCount === wikiCount) return null;

      const notionBooksInYear = Array.from(mergedNotion.values()).filter(data => data.years.has(y));
      const wikiBooksInYear = Array.from(mergedWiki.values()).filter(data => data.years.has(y));

      const notionToWikiMatches = new Map<string, string[]>();
      const wikiToNotionMatches = new Map<string, string[]>();

      wikiBooksInYear.forEach(wb => {
        notionBooksInYear.filter(nb => nb.keys.some(k => wb.keys.includes(k))).forEach(nb => {
          if (!notionToWikiMatches.has(nb.display)) notionToWikiMatches.set(nb.display, []);
          notionToWikiMatches.get(nb.display)!.push(wb.display);
        });
      });
      notionBooksInYear.forEach(nb => {
        wikiBooksInYear.filter(wb => wb.keys.some(k => nb.keys.includes(k))).forEach(wb => {
          if (!wikiToNotionMatches.has(wb.display)) wikiToNotionMatches.set(wb.display, []);
          wikiToNotionMatches.get(wb.display)!.push(nb.display);
        });
      });

      const notionOnlyInYear = notionBooksInYear.filter(nb => !notionToWikiMatches.has(nb.display));
      const wikiOnlyInYear = wikiBooksInYear.filter(wb => !wikiToNotionMatches.has(wb.display));

      const collisions: { title: string, matches: string[] }[] = [];
      notionToWikiMatches.forEach((matches, notionTitle) => {
        if (matches.length > 1) collisions.push({ title: `Notion: ${notionTitle}`, matches: matches.map(m => `Wiki: ${m}`) });
      });
      wikiToNotionMatches.forEach((matches, wikiTitle) => {
        if (matches.length > 1) collisions.push({ title: `Wiki: ${wikiTitle}`, matches: matches.map(m => `Notion: ${m}`) });
      });

      const misplaced: { title: string, otherYear: string }[] = [];
      const notionOnlyFinal: string[] = [];
      const wikiOnlyFinal: string[] = [];

      notionOnlyInYear.forEach(nb => {
        const wikiMatch = Array.from(mergedWiki.values()).find(wb => wb.keys.some(k => nb.keys.includes(k)));
        if (wikiMatch) misplaced.push({ title: nb.display, otherYear: `Wiki mówi: ${Array.from(wikiMatch.years).join(", ")}` });
        else notionOnlyFinal.push(nb.display);
      });
      wikiOnlyInYear.forEach(wb => {
        const notionMatch = Array.from(mergedNotion.values()).find(nb => nb.keys.some(k => wb.keys.includes(k)));
        if (notionMatch) misplaced.push({ title: wb.display, otherYear: `Notion mówi: ${Array.from(notionMatch.years).join(", ")}` });
        else wikiOnlyFinal.push(wb.display);
      });

      return {
        year: y,
        notion: notionCount,
        wiki: wikiCount,
        notionOnly: notionOnlyFinal.length > 0 ? notionOnlyFinal : undefined,
        wikiOnly: wikiOnlyFinal.length > 0 ? wikiOnlyFinal : undefined,
        misplaced: misplaced.length > 0 ? misplaced : undefined,
        collisions: collisions.length > 0 ? collisions : undefined
      };
    }).filter((d): d is NonNullable<typeof d> => d !== null);
  }

  // --- E. Award count match ---
  private computeAwardDiffs(notionBooks: NotionBook[], allWikiBooks: Book[]) {
    const notionAwardMap = new Map<string, { count: number, books: string[] }>();
    notionBooks.forEach(b => {
      (b.awards || []).forEach(aw => {
        if (aw === "Wszystkie") return;
        if (!notionAwardMap.has(aw)) notionAwardMap.set(aw, { count: 0, books: [] });
        const data = notionAwardMap.get(aw)!;
        data.count++;
        data.books.push(`"${b.origTitle || b.plTitle}" (${b.author})`);
      });
    });

    const wikiAwardMap = new Map<string, { count: number, books: string[] }>();
    allWikiBooks.forEach(b => {
      if (!wikiAwardMap.has(b.award)) wikiAwardMap.set(b.award, { count: 0, books: [] });
      const data = wikiAwardMap.get(b.award)!;
      data.count++;
      data.books.push(`"${b.originalTitle || b.polishTitle}" (${b.author})`);
    });

    return Array.from(new Set([...notionAwardMap.keys(), ...wikiAwardMap.keys()])).map(aw => {
      const notionData = notionAwardMap.get(aw);
      const wikiData = wikiAwardMap.get(aw);
      const notionCount = notionData?.count || 0;
      const wikiCount = wikiData?.count || 0;
      if (notionCount === wikiCount) return null;
      return {
        award: aw,
        notion: notionCount,
        wiki: wikiCount,
        notionOnly: notionData?.books.filter(nb => !wikiData?.books.includes(nb)),
        wikiOnly: wikiData?.books.filter(wb => !notionData?.books.includes(wb))
      };
    }).filter((d): d is NonNullable<typeof d> => d !== null);
  }
}
