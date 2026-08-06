import pLimit from "p-limit";
import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { calculateSimilarity, countCommonWords, cleanTitle, sanitizeNotionString, sanitizeNotionTag, isValidUrl } from "../utils";
import { Book, NotionBook, SyncEvent, SyncParams } from "../src/types";
import { normalizeData } from "./dataNormalizer";

export class BookSyncService {
  constructor(private notion: NotionAdapter, private wiki: WikiAdapter) {}

  async fetchBooksFromMediaWiki(pageTitle: string, awardName: string, sendEvent: (data: SyncEvent) => void): Promise<Book[]> {
    sendEvent({ type: "status", message: `Inicjacja ekstrakcji danych z Archiwum Encyklopedii: ${awardName}...` });
    const wikitext = await this.wiki.fetchPageContent(pageTitle);
    
    sendEvent({ type: "status", message: `Dekodowanie tablic wyników: ${awardName}...` });
    const books: Book[] = [];
    
    let processedWikitext = wikitext;
    if (awardName === "Nagroda Locus") {
      processedWikitext = processedWikitext.replace(/={2,}\s*Zwycięzcy w kategorii Powieść dla młodzieży\s*={2,}[^]*?(?=\n==|$)/i, '');
    }

    let cleanedWiki = processedWikitext
      .replace(/\{\{sortname\|([^|}]+)\|([^|}]+)(?:\|[^}]+)?\}\}/gi, '$1 $2')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\|\}[\s\S]*?\{\|[^\n]*\n/g, '\n|-\n');

    const rows = cleanedWiki.split(/\|-/);
    let lastYear = "";
    let colMap = { rok: 0, autor: 1, tytulOryginalny: 2, tytulPolski: 3, expectedLength: 4 };

    const parseCell = (cell: string, extractLink = false, extractItalics = false) => {
      if (!cell) return extractLink ? { text: "", link: null } : "";
      let text = cell.trim();
      let link = null;
      
      if (extractLink) {
        const linkMatch = text.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
        if (linkMatch) {
          const pageName = linkMatch[1].trim().replace(/ /g, '_');
          link = `https://encyklopediafantastyki.pl/index.php?title=${encodeURIComponent(pageName)}`;
        }
      }
      
      if (extractItalics && !text.toLowerCase().includes("(aka")) {
        const italicsMatch = text.match(/''(.+?)''/);
        if (italicsMatch) text = italicsMatch[1];
      }
      
      text = text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
                 .replace(/\[\[([^\]]+)\]\]/g, '$1')
                 .replace(/''+/g, '')
                 .trim();
                 
      return extractLink ? { text, link } : text;
    };

    for (let i = 0; i < rows.length; i++) {
      let trimmedRow = rows[i].trim();
      const endTableIndex = trimmedRow.indexOf('|}');
      if (endTableIndex !== -1) trimmedRow = trimmedRow.substring(0, endTableIndex).trim();
      if (!trimmedRow || trimmedRow.startsWith('}')) continue;

      const isWinner = trimmedRow.toLowerCase().includes('background') || trimmedRow.toLowerCase().includes('bgcolor');
      const baseName = awardName.replace('Nagroda ', '').replace('Nominacja ', '');
      const currentAward = isWinner ? `Nagroda ${baseName}` : `Nominacja ${baseName}`;

      let rowContent = trimmedRow;
      if (!rowContent.startsWith('|') && !rowContent.startsWith('!')) rowContent = rowContent.replace(/^.*?\n/, '');
      rowContent = '\n' + rowContent;
      
      const cellsRaw = rowContent.split(/\n\||\n!|\|\|/);
      const cells = cellsRaw.map(c => {
        const pipeIndex = c.indexOf('|');
        if (pipeIndex !== -1 && c.substring(0, pipeIndex).includes('=')) return c.substring(pipeIndex + 1).trim();
        return c.trim().replace(/^!/, '').replace(/^\|/, '').trim();
      });

      if (cells.length > 0 && cells[0] === '') cells.shift();
      while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      
      if (cells.some(c => c.toLowerCase().includes('autor'))) {
        colMap.rok = cells.findIndex(c => c.toLowerCase().includes('rok'));
        colMap.autor = cells.findIndex(c => c.toLowerCase().includes('autor'));
        colMap.tytulOryginalny = cells.findIndex(c => c.toLowerCase().includes('oryginalny'));
        colMap.tytulPolski = cells.findIndex(c => c.toLowerCase().includes('polski'));
        colMap.expectedLength = cells.length;
        continue;
      }

      if (cells.length === 1) {
        if (books.length > 0) {
          let extraAuthor = parseCell(cells[0]) as string;
          extraAuthor = extraAuthor.replace(/\s*\(remis\)/gi, '').trim();
          books[books.length - 1].author += ", " + extraAuthor;
        }
        continue;
      }

      if (cells.length < 2) continue;

      let year = "", author = "", originalTitle = "", polishTitle = "", polishTitleLink = null;
      let isFullRow = false;
      if (colMap.rok !== -1) {
         const possibleYearCell = cells[colMap.rok];
         if (possibleYearCell) {
             const yearMatch = possibleYearCell.match(/^['\[]*(\d{4})/);
             if (yearMatch && !possibleYearCell.includes('{{sortname')) isFullRow = true;
         }
      } else {
         isFullRow = cells.length >= colMap.expectedLength;
      }

      const omittedColumns = isFullRow ? 0 : Math.max(1, colMap.autor);
      
      if (isFullRow) {
        const yearMatch = cells[colMap.rok]?.match(/^['\[]*(\d{4})/);
        year = yearMatch ? yearMatch[1] : cells[colMap.rok];
        lastYear = year;
        author = parseCell(cells[colMap.autor] || "") as string;
        originalTitle = parseCell(cells[colMap.tytulOryginalny] || "", false, true) as string;
        const plParsed = parseCell(cells[colMap.tytulPolski] || "", true, true) as {text: string, link: string | null};
        polishTitle = plParsed.text;
        polishTitleLink = plParsed.link;
      } else {
        year = lastYear;
        author = parseCell(cells[0] || "") as string;
        originalTitle = parseCell(cells[colMap.tytulOryginalny - omittedColumns] || "", false, true) as string;
        const plParsed = parseCell(cells[colMap.tytulPolski - omittedColumns] || "", true, true) as {text: string, link: string | null};
        polishTitle = plParsed.text;
        polishTitleLink = plParsed.link;
      }

      author = author.replace(/\s*\(remis\)/gi, '').trim();
      if (author || polishTitle || originalTitle) {
        books.push({ 
          year, 
          author, 
          polishTitle: cleanTitle(polishTitle), 
          originalTitle: normalizeData(cleanTitle(originalTitle), 'title'), 
          polishTitleLink, award: currentAward 
        });
      }
    }
    return books;
  }

  compareBooks(existingBook: NotionBook, book: Book): any {
    const updates: any = {};
    
    const cleanExistingPl = sanitizeNotionString(existingBook.plTitle);
    const cleanExistingOrig = sanitizeNotionString(existingBook.origTitle);
    const cleanNewPl = sanitizeNotionString(book.polishTitle);
    const cleanNewOrig = sanitizeNotionString(book.originalTitle);

    // Update Polish title if it differs from the wiki
    if (cleanNewPl && cleanExistingPl !== cleanNewPl) {
      const link = book.polishTitleLink;
      updates["Tytuł polski"] = { rich_text: [{ text: { content: cleanNewPl, ...(isValidUrl(link) ? { link: { url: link } } : {}) } }] };
    } else if (cleanExistingPl && existingBook.plTitle !== cleanExistingPl) {
      const link = book.polishTitleLink;
      updates["Tytuł polski"] = { rich_text: [{ text: { content: cleanExistingPl, ...(isValidUrl(link) ? { link: { url: link } } : {}) } }] };
    }

    if (cleanNewOrig && (!cleanExistingOrig || cleanExistingOrig === "")) {
      updates["Tytuł oryginalny"] = { rich_text: [{ text: { content: cleanNewOrig } }] };
    } else if (cleanExistingOrig && existingBook.origTitle !== cleanExistingOrig) {
      updates["Tytuł oryginalny"] = { rich_text: [{ text: { content: cleanExistingOrig } }] };
    }

    // Update Author if it differs
    const newAuthors = Array.from(new Set(
      normalizeData(book.author || "", 'author').split(',')
        .map((a: string) => sanitizeNotionTag(a))
        .filter(Boolean)
    ));
    const existingAuthors = (existingBook.author || "").split(',')
      .map((a: string) => sanitizeNotionTag(a))
      .filter(Boolean);
    
    const authorsChanged = newAuthors.length !== existingAuthors.length || 
                           newAuthors.some(a => !existingAuthors.includes(a)) ||
                           existingAuthors.some(a => !newAuthors.includes(a));

    if (authorsChanged && newAuthors.length > 0) {
      updates["Autor"] = { multi_select: newAuthors.slice(0, 100).map(name => ({ name })) };
    }
    
    const newAwards = (book.awards || []).map(sanitizeNotionTag).filter(Boolean);
    const existingAwards = (existingBook.awards || []).map(sanitizeNotionTag).filter(Boolean);
    
    const combinedAwardsSet = new Set([...existingAwards]);
    let awardsUpdated = false;

    for (const aw of newAwards) {
      if (!combinedAwardsSet.has(aw)) {
        combinedAwardsSet.add(aw);
        awardsUpdated = true;
      }
    }
    
    const hasHugo = combinedAwardsSet.has("Nagroda Hugo");
    const hasNebula = combinedAwardsSet.has("Nagroda Nebula");
    const hasLocus = combinedAwardsSet.has("Nagroda Locus");
    if (hasHugo && hasNebula && hasLocus && !combinedAwardsSet.has("Wszystkie")) {
      combinedAwardsSet.add("Wszystkie");
      awardsUpdated = true;
    }
    
    if (awardsUpdated) {
      updates["Nagroda"] = { multi_select: Array.from(combinedAwardsSet).map(name => ({ name })) };
    }

    // Update Year if it differs
    const newYear = (book.year || "").trim();
    const existingYears = (existingBook.year || "").split(',')
      .map((y: string) => y.trim())
      .filter(Boolean);
    
    if (newYear && !existingYears.includes(newYear)) {
      const updatedYears = Array.from(new Set([...existingYears, newYear]))
        .sort()
        .map(name => ({ name }));
      updates["Rok"] = { multi_select: updatedYears };
    }

    return updates;
  }

  private countCommonWords(title1: string, title2: string): number {
    const words1 = new Set(title1.toLowerCase().split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(title2.toLowerCase().split(/\s+/).filter(w => w.length > 0));
    let common = 0;
    for (const w1 of words1) {
      if (words2.has(w1)) common++;
    }
    return common;
  }

  async runBookSync(params: SyncParams, sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Inicjalizacja bazy Notion..." });
      await this.notion.init();
      let allBooksToSync: Book[] = [];
      if (params.syncAll) {
        const PREDEFINED_AWARDS = [
          { name: "Nagroda Hugo", title: "Hugo nagroda powieść" },
          { name: "Nagroda Nebula", title: "Nebula nagroda najlepsza powieść" },
          { name: "Nagroda Locus", title: "Locus nagroda powieść" }
        ];
        for (const aw of PREDEFINED_AWARDS) {
          if (checkCancellation()) break;
          const books = await this.fetchBooksFromMediaWiki(aw.title, aw.name, sendEvent);
          allBooksToSync = allBooksToSync.concat(books);
        }
      } else if (params.pageTitle && params.awardName) {
        allBooksToSync = await this.fetchBooksFromMediaWiki(params.pageTitle, params.awardName, sendEvent);
      }
      if (checkCancellation()) {
        sendEvent({ type: "error", error: "Synchronizacja przerwana przez użytkownika." });
        return;
      }
      const mergedBooksMap = new Map<string, Book>();
      for (const book of allBooksToSync) {
        const normalizedAuthor = normalizeData(book.author || "", 'author');
        const key = `${book.polishTitle || book.originalTitle}|${normalizedAuthor}`.trim().toLowerCase();
        if (!key) continue;
        if (mergedBooksMap.has(key)) {
          const existing = mergedBooksMap.get(key)!;
          if (!existing.awards?.includes(book.award)) existing.awards?.push(book.award);
        } else {
          book.awards = [book.award];
          book.author = normalizedAuthor; // Store normalized author
          mergedBooksMap.set(key, book);
        }
      }
      const booksToSync = Array.from(mergedBooksMap.values());
      sendEvent({ type: "status", message: "Skanowanie bazy danych Notion..." });
      const existingBooks = await this.notion.queryAllBooks(
        (count) => sendEvent({ type: "status", message: `Pobrano ${count} książek z Notion...` }),
        checkCancellation
      );

      const existingBooksMap = new Map<string, NotionBook>();
      for (const book of existingBooks) {
        const normalizedAuthor = normalizeData(cleanTitle(book.author || ""), 'author');
        const cleanedPl = normalizeData(cleanTitle(book.plTitle || ""), 'title');
        const cleanedOrig = normalizeData(cleanTitle(book.origTitle || ""), 'title');
        
        if (cleanedPl) {
          const key = `${cleanedPl}|${normalizedAuthor}`.toLowerCase();
          existingBooksMap.set(key, book);
        }
        if (cleanedOrig) {
          const key = `${cleanedOrig}|${normalizedAuthor}`.toLowerCase();
          existingBooksMap.set(key, book);
        }
      }
      let synced = 0, updated = 0;
      const syncSummary = { added: [] as string[], updated: [] as string[], skipped: [] as string[], duplicates: [] as string[] };
      const errors: any[] = [];
      
      const limit = pLimit(3);
      let processedCount = 0;

      const syncTasks = booksToSync.map((book) => limit(async () => {
        if (checkCancellation()) return;
        
        processedCount++;
        if (processedCount % 5 === 0 || processedCount === booksToSync.length) {
          sendEvent({ type: "progress", message: "Zapisywanie danych do bazy Notion...", current: processedCount, total: booksToSync.length });
        }
        
        try {
          const searchKeyPL = `${cleanTitle(book.polishTitle || "")}|${book.author}`.toLowerCase();
          const searchKeyOrig = `${cleanTitle(book.originalTitle || "")}|${book.author}`.toLowerCase();
          let existingBook = existingBooksMap.get(searchKeyPL) || existingBooksMap.get(searchKeyOrig);
          const bookDisplayName = `${book.polishTitle || book.originalTitle} - ${book.author} (${book.year})`;
          
          let isDuplicateFound = false;
          if (!existingBook) {
            // Check for potential duplicates
            for (const [titleWithAuthor, bookData] of existingBooksMap.entries()) {
              let isDuplicate = false;
              
              // Check if authors are similar
              const authorA = (book.author || "").toLowerCase().trim();
              const authorB = (bookData.author || "").toLowerCase().trim();
              const sameAuthor = authorA && authorB && (authorA === authorB || calculateSimilarity(authorA, authorB) > 0.85);

              // Strict rule: at least 2 common significant words in original title AND same author
              if (sameAuthor && book.originalTitle && bookData.origTitle && countCommonWords(book.originalTitle, bookData.origTitle) >= 2) {
                isDuplicate = true;
              }

              if (isDuplicate) {
                syncSummary.duplicates.push(`${bookDisplayName} (duplikat: ${bookData.origTitle || titleWithAuthor} - dopasowanie słów + autor)`);
                isDuplicateFound = true;
                break;
              }
            }
          }

          if (isDuplicateFound) return;

          if (existingBook) {
            const updates = this.compareBooks(existingBook, book);
            if (Object.keys(updates).length > 0) {
              await this.notion.updatePage(existingBook.id, updates);
              updated++;
              const updatedFields = Object.keys(updates).join(', ');
              syncSummary.updated.push(`${bookDisplayName} (Zaktualizowano: ${updatedFields})`);
            } else {
              syncSummary.skipped.push(bookDisplayName);
            }
          } else {
            const properties: any = {
              "Lp": { title: [{ text: { content: sanitizeNotionString(book.polishTitle || book.originalTitle || "Nowy") } }] },
              "Tytuł polski": { rich_text: [{ text: { content: sanitizeNotionString(book.polishTitle || ""), ...(isValidUrl(book.polishTitleLink) ? { link: { url: book.polishTitleLink } } : {}) } }] },
              "Tytuł oryginalny": { rich_text: [{ text: { content: sanitizeNotionString(book.originalTitle || "") } }] },
            };
            if (book.year) {
              properties["Rok"] = { multi_select: [{ name: book.year.toString() }] };
            }
            if (book.author) {
              const authors = Array.from(new Set(
                book.author.split(',')
                  .map((a: string) => sanitizeNotionTag(a))
                  .filter(Boolean)
              ));
              properties["Autor"] = { multi_select: authors.slice(0, 100).map(name => ({ name })) };
            }
            if (book.awards && book.awards.length > 0) {
              const awardsSet = new Set(book.awards.map(sanitizeNotionTag).filter(Boolean));
              const hasHugo = awardsSet.has("Nagroda Hugo");
              const hasNebula = awardsSet.has("Nagroda Nebula");
              const hasLocus = awardsSet.has("Nagroda Locus");
              if (hasHugo && hasNebula && hasLocus && !awardsSet.has("Wszystkie")) awardsSet.add("Wszystkie");
              properties["Nagroda"] = { multi_select: Array.from(awardsSet).map(name => ({ name })) };
            }
            await this.notion.addRow(properties);
            synced++;
            syncSummary.added.push(bookDisplayName);
          }
        } catch (err: any) {
          errors.push({ book: book.polishTitle, error: err.message });
        }
      }));

      await Promise.all(syncTasks);

      sendEvent({ type: "complete", result: { synced, updated, summary: syncSummary, errors: errors.map(e => `${e.book}: ${e.error}`) } });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}
