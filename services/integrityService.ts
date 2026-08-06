import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { BookSyncService } from "./bookSyncService";
import { SyncEvent, NotionBook, Book, IntegrityCheckResult } from "../src/types";
import { normalizeData } from "./dataNormalizer";

export type { IntegrityCheckResult };

export class IntegrityService {
  private bookSyncService: BookSyncService;

  constructor(private notion: NotionAdapter, private wiki: WikiAdapter) {
    this.bookSyncService = new BookSyncService(notion, wiki);
  }

  async runIntegrityCheck(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Inicjalizacja Skanera Sanctity..." });
      await this.notion.init();

      // 1. Fetch Notion Data
      sendEvent({ type: "status", message: "Pobieranie wszystkich danych z Notion..." });
      const notionBooks = await this.notion.queryAllBooks(
        (count) => sendEvent({ type: "status", message: `Pobrano ${count} rekordów z Notion...` }),
        checkCancellation
      );

      if (checkCancellation()) return;

      // 2. Fetch Wiki Data (Predefined Awards)
      sendEvent({ type: "status", message: "Pobieranie danych z Archiwum Encyklopedii (Nagrody)..." });
      const PREDEFINED_AWARDS = [
        { name: "Nagroda Hugo", title: "Hugo nagroda powieść" },
        { name: "Nagroda Nebula", title: "Nebula nagroda najlepsza powieść" },
        { name: "Nagroda Locus", title: "Locus nagroda powieść" }
      ];

      let allWikiBooks: Book[] = [];
      for (const aw of PREDEFINED_AWARDS) {
        if (checkCancellation()) break;
        const books = await this.bookSyncService.fetchBooksFromMediaWiki(aw.title, aw.name, sendEvent);
        allWikiBooks = allWikiBooks.concat(books);
      }

      if (checkCancellation()) return;

      sendEvent({ type: "status", message: "Analiza integralności danych (Rytuał Weryfikacji)..." });

      const getRobustKey = (author: string, title: string) => {
        // Try normalizing the whole author string first (for cases like "Liu Cixin, Ken Liu (tłumacz)")
        const normalizedAuthor = normalizeData(author || "", 'author');
        
        // Split, clean and sort authors for robust matching
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

        // Pusty tytuł → pusty klucz, żeby .filter(Boolean) go odrzucił.
        // Klucz "|autor" scalałby różne książki tego samego autora.
        if (!normTitle) return "";

        return `${normTitle}|${normAuthor}`;
      };

      // --- PERFORM CHECKS ---

      // A. Lp Uniqueness
      const lpMap = new Map<string, number>();
      notionBooks.forEach(b => {
        if (b.lp) lpMap.set(b.lp, (lpMap.get(b.lp) || 0) + 1);
      });
      const lpDuplicates = Array.from(lpMap.entries())
        .filter(([_, count]) => count > 1)
        .map(([lp, count]) => `Lp ${lp}: powtórzony ${count} razy`);

      // B. Original Title Uniqueness (per author)
      const origTitleMap = new Map<string, number>();
      notionBooks.forEach(b => {
        const key = getRobustKey(b.author || "", b.origTitle || "");
        if (b.origTitle) origTitleMap.set(key, (origTitleMap.get(key) || 0) + 1);
      });
      const origDuplicates = Array.from(origTitleMap.entries())
        .filter(([_, count]) => count > 1)
        .map(([key, count]) => `"${key.split('|')[0]}" (${key.split('|')[1]}): powtórzony ${count} razy`);

      // C. Polish Title Uniqueness (per author)
      const plTitleMap = new Map<string, number>();
      notionBooks.forEach(b => {
        const key = getRobustKey(b.author || "", b.plTitle || "");
        if (b.plTitle) plTitleMap.set(key, (plTitleMap.get(key) || 0) + 1);
      });
      const plDuplicates = Array.from(plTitleMap.entries())
        .filter(([_, count]) => count > 1)
        .map(([key, count]) => `"${key.split('|')[0]}" (${key.split('|')[1]}): powtórzony ${count} razy`);

      // D. Book Count per Year
      const IGNORED_LOCUS_TAGS = ["Powieść dla młodzieży", "Locus - Powieść dla młodzieży", "Locus YA"];
      
      const notionYearMap = new Map<string, number>();
      const mergedNotionBooksMap = new Map<string, { years: Set<string>, display: string, keys: string[] }>();
      const notionKeyToPrimaryKey = new Map<string, string>();

      notionBooks.forEach(b => {
        // Filter out books that don't have any of our tracked awards (Hugo, Nebula, Locus)
        // but also respect the Locus YA exclusion
        const hasTrackedAward = b.awards?.some(aw => {
          const lowerAw = aw.toLowerCase();
          if (lowerAw.includes("locus") && IGNORED_LOCUS_TAGS.some(tag => lowerAw.includes(tag.toLowerCase()))) return false;
          return ["hugo", "nebula", "locus"].some(kw => lowerAw.includes(kw));
        });
        if (!hasTrackedAward) return;

        const keys = [
          getRobustKey(b.author || "", b.origTitle || ""),
          getRobustKey(b.author || "", b.plTitle || "")
        ].filter(Boolean);
        
        if (keys.length === 0) return;

        // Try to find if any of these keys already exist in the map (to merge duplicates in Notion)
        let primaryKey = keys.find(k => notionKeyToPrimaryKey.has(k));
        if (primaryKey) {
          primaryKey = notionKeyToPrimaryKey.get(primaryKey)!;
        } else {
          primaryKey = keys[0];
          mergedNotionBooksMap.set(primaryKey, { 
            years: new Set(), 
            display: `"${b.origTitle || b.plTitle}" (${b.author})`,
            keys: keys
          });
        }
        
        const data = mergedNotionBooksMap.get(primaryKey)!;
        if (b.year) {
          const years = b.year.split(',').map(y => y.trim()).filter(Boolean);
          years.forEach(y => data.years.add(y));
        }
        
        keys.forEach(k => notionKeyToPrimaryKey.set(k, primaryKey!));
      });

      mergedNotionBooksMap.forEach((data) => {
        data.years.forEach(y => {
          notionYearMap.set(y, (notionYearMap.get(y) || 0) + 1);
        });
      });

      const wikiYearMap = new Map<string, number>();
      const mergedWikiBooksMap = new Map<string, { years: Set<string>, display: string, keys: string[] }>();
      const wikiKeyToPrimaryKey = new Map<string, string>();

      allWikiBooks.forEach(b => {
        const keys = [
          getRobustKey(b.author || "", b.originalTitle || ""),
          getRobustKey(b.author || "", b.polishTitle || "")
        ].filter(Boolean);
        
        if (keys.length === 0) return;

        let primaryKey = keys.find(k => wikiKeyToPrimaryKey.has(k));
        if (primaryKey) {
          primaryKey = wikiKeyToPrimaryKey.get(primaryKey)!;
        } else {
          primaryKey = keys[0];
          mergedWikiBooksMap.set(primaryKey, { 
            years: new Set(), 
            display: `"${b.originalTitle || b.polishTitle}" (${b.author})`,
            keys: keys
          });
        }
        
        const data = mergedWikiBooksMap.get(primaryKey)!;
        data.years.add(b.year.toString());
        keys.forEach(k => wikiKeyToPrimaryKey.set(k, primaryKey!));
      });

      mergedWikiBooksMap.forEach((data) => {
        data.years.forEach(y => {
          if (y) wikiYearMap.set(y, (wikiYearMap.get(y) || 0) + 1);
        });
      });

      const allYears = Array.from(new Set([...notionYearMap.keys(), ...wikiYearMap.keys()])).sort();
      const yearDiffs = allYears.map(y => {
        const notionCount = notionYearMap.get(y) || 0;
        const wikiCount = wikiYearMap.get(y) || 0;
        
        if (notionCount === wikiCount) return null;

        const notionBooksInYear = Array.from(mergedNotionBooksMap.values())
          .filter(data => data.years.has(y));
          
        const wikiBooksInYear = Array.from(mergedWikiBooksMap.values())
          .filter(data => data.years.has(y));

        // Track matches to find collisions
        const notionToWikiMatches = new Map<string, string[]>();
        const wikiToNotionMatches = new Map<string, string[]>();

        wikiBooksInYear.forEach(wb => {
          const matches = notionBooksInYear.filter(nb => nb.keys.some(k => wb.keys.includes(k)));
          matches.forEach(nb => {
            const key = nb.display;
            if (!notionToWikiMatches.has(key)) notionToWikiMatches.set(key, []);
            notionToWikiMatches.get(key)!.push(wb.display);
          });
        });

        notionBooksInYear.forEach(nb => {
          const matches = wikiBooksInYear.filter(wb => wb.keys.some(k => nb.keys.includes(k)));
          matches.forEach(wb => {
            const key = wb.display;
            if (!wikiToNotionMatches.has(key)) wikiToNotionMatches.set(key, []);
            wikiToNotionMatches.get(key)!.push(nb.display);
          });
        });

        // 1. Notion Only (in this year) - No matches in wikiBooksInYear
        const notionOnlyInYear = notionBooksInYear.filter(nb => !notionToWikiMatches.has(nb.display));

        // 2. Wiki Only (in this year) - No matches in notionBooksInYear
        const wikiOnlyInYear = wikiBooksInYear.filter(wb => !wikiToNotionMatches.has(wb.display));

        // 3. Collisions
        const collisions: { title: string, matches: string[] }[] = [];
        
        // Many Wiki -> One Notion
        notionToWikiMatches.forEach((matches, notionTitle) => {
          if (matches.length > 1) {
            collisions.push({ title: `Notion: ${notionTitle}`, matches: matches.map(m => `Wiki: ${m}`) });
          }
        });

        // Many Notion -> One Wiki
        wikiToNotionMatches.forEach((matches, wikiTitle) => {
          if (matches.length > 1) {
            collisions.push({ title: `Wiki: ${wikiTitle}`, matches: matches.map(m => `Notion: ${m}`) });
          }
        });

        // 4. Misplaced (exists in other database but in a different year)
        const misplaced: { title: string, otherYear: string }[] = [];
        const notionOnlyFinal: string[] = [];
        const wikiOnlyFinal: string[] = [];

        notionOnlyInYear.forEach(nb => {
          const wikiMatch = Array.from(mergedWikiBooksMap.values()).find(wb => 
            wb.keys.some(k => nb.keys.includes(k))
          );
          if (wikiMatch) {
            misplaced.push({ 
              title: nb.display, 
              otherYear: `Wiki mówi: ${Array.from(wikiMatch.years).join(", ")}` 
            });
          } else {
            notionOnlyFinal.push(nb.display);
          }
        });

        wikiOnlyInYear.forEach(wb => {
          const notionMatch = Array.from(mergedNotionBooksMap.values()).find(nb => 
            nb.keys.some(k => wb.keys.includes(k))
          );
          if (notionMatch) {
            misplaced.push({ 
              title: wb.display, 
              otherYear: `Notion mówi: ${Array.from(notionMatch.years).join(", ")}` 
            });
          } else {
            wikiOnlyFinal.push(wb.display);
          }
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

      // E. Award Count Match
      const notionAwardMap = new Map<string, { count: number, books: string[] }>();
      notionBooks.forEach(b => {
        (b.awards || []).forEach(aw => {
          if (aw !== "Wszystkie") {
            if (!notionAwardMap.has(aw)) notionAwardMap.set(aw, { count: 0, books: [] });
            const data = notionAwardMap.get(aw)!;
            data.count++;
            data.books.push(`"${b.origTitle || b.plTitle}" (${b.author})`);
          }
        });
      });

      const wikiAwardMap = new Map<string, { count: number, books: string[] }>();
      allWikiBooks.forEach(b => {
        if (!wikiAwardMap.has(b.award)) wikiAwardMap.set(b.award, { count: 0, books: [] });
        const data = wikiAwardMap.get(b.award)!;
        data.count++;
        data.books.push(`"${b.originalTitle || b.polishTitle}" (${b.author})`);
      });

      const awardDiffs = Array.from(new Set([...notionAwardMap.keys(), ...wikiAwardMap.keys()])).map(aw => {
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

      const result: IntegrityCheckResult = {
        lpUniqueness: { status: lpDuplicates.length === 0, duplicates: lpDuplicates },
        yearCountMatch: { status: yearDiffs.length === 0, diffs: yearDiffs },
        originalTitleUniqueness: { status: origDuplicates.length === 0, duplicates: origDuplicates },
        polishTitleUniqueness: { status: plDuplicates.length === 0, duplicates: plDuplicates },
        awardCountMatch: { status: awardDiffs.length === 0, diffs: awardDiffs }
      };

      sendEvent({ type: "complete", result });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}
