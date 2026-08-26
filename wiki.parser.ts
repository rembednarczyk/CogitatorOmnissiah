import { Book } from "./src/types";
import { cleanTitle } from "./utils";
import { normalizeData } from "./services/dataNormalizer";

export class WikiParser {
  /**
   * Parses an award results table from wikitext ({{tabela wydania}} / wikitable)
   * into a list of books. A pure function (no I/O) — page fetching and SSE events
   * stay in BookSyncService.fetchBooksFromMediaWiki. `awardName` determines the
   * Nagroda/Nominacja label and the exclusion of the YA category for Locus.
   */
  static parseAwardTable(wikitext: string, awardName: string): Book[] {
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
        const cellText = parseCell(cells[0]) as string;
        const yearOnly = cellText.replace(/['\[\]]/g, '').trim().match(/^(\d{4})$/);
        if (yearOnly) {
          // A row containing only a year (rowspan) — this is a new year,
          // not an additional author of the previous book
          lastYear = yearOnly[1];
        } else if (books.length > 0) {
          const extraAuthor = cellText.replace(/\s*\(remis\)/gi, '').trim();
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

  static cleanWikitext(text: string): string {
    if (!text) return "";
    return text
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
      .replace(/\{\{sortname\|([^|}]+)\|([^|}]+)(?:\|[^}]+)?\}\}/gi, '$1 $2')
      .replace(/\{\{Autor\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$1')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/''+/g, '')
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static extractPublisherAndSeries(wikitext: string): { wydawca: string, seria: string } {
    let wydawca = "";
    let seria = "";

    // 1. Get the general values from {{Książka}} (as a fallback)
    // The value may contain piped links ([[Target|Label]]) — match the whole [[...]]
    const wydawcaMatch = wikitext.match(/\|\s*wydawca\s*=\s*((?:\[\[[^\]]*\]\]|[^\n|])+)/i);
    if (wydawcaMatch) wydawca = this.cleanWikitext(wydawcaMatch[1]);

    const seriaMatch = wikitext.match(/\|\s*seria\s*=\s*((?:\[\[[^\]]*\]\]|[^\n|])+)/i);
    if (seriaMatch) seria = this.cleanWikitext(seriaMatch[1]);

    // 2. Get the values from {{tabela wydania}} (infowydanie) - priority to the highest N with data
    const infoRegex = /\|\s*informacja(\d+)\s*=\s*\{\{infowydanie\s*\|([\s\S]*?)\}\}/gi;
    
    let match;
    const infos: { n: number, content: string }[] = [];
    while ((match = infoRegex.exec(wikitext)) !== null) {
      infos.push({ n: parseInt(match[1], 10), content: match[2] });
    }

    // Sort from the highest N, to find the newest edition with data
    infos.sort((a, b) => b.n - a.n);

    for (const info of infos) {
      // Anchor (?:^|\|) — don't match inside other parameters (e.g. "współwydawca")
      const infoWydawcaMatch = info.content.match(/(?:^|\|)\s*wydawca\s*=\s*((?:\[\[[^\]]*\]\]|[^\n|])+)/i);
      const infoSeriaMatch = info.content.match(/(?:^|\|)\s*seria\s*=\s*((?:\[\[[^\]]*\]\]|[^\n|])+)/i);

      const foundWydawca = infoWydawcaMatch ? this.cleanWikitext(infoWydawcaMatch[1]) : "";
      const foundSeria = infoSeriaMatch ? this.cleanWikitext(infoSeriaMatch[1]) : "";

      if (foundWydawca || foundSeria) {
        // The newest edition with data is authoritative in full — assign BOTH fields,
        // including empty ones. Don't let a series from an older edition (or from the
        // global {{Książka}} fallback) leak through when the newest edition lacks it.
        wydawca = foundWydawca;
        seria = foundSeria;
        break;
      }
    }

    return { wydawca, seria };
  }

  static extractAuthor(wikitext: string): string {
    // Look for autor, twórca, or redaktor in infoboxes.
    // The value may contain piped templates/links: {{sortname|Ursula K.|Le Guin}},
    // {{Autor|Jan Kowalski}}, [[Stanisław Lem|Lem, Stanisław]]. Match the whole
    // [[...]]/{{...}} as one token — otherwise the capture `[^\n|]+` cut the value at
    // the first `|` (e.g. down to "{{sortname"), so the template cleanup in
    // cleanWikitext never had anything to process.
    const authorRegex = /\|\s*(autor|twórca|redaktor|scenariusz|tekst)\s*=\s*((?:\[\[[^\]]*\]\]|\{\{[^{}]*\}\}|[^\n|])+)/gi;
    let match;
    let authors: string[] = [];

    while ((match = authorRegex.exec(wikitext)) !== null) {
      // cleanWikitext expands [[Target|Label]]→Label, {{sortname|a|b}}→"a b",
      // {{Autor|a}}→a and removes the remaining templates/markup.
      const cleaned = this.cleanWikitext(match[2]);
      // An empty parameter (e.g. "| redaktor = " with a space) matches — filter it out
      if (cleaned) authors.push(cleaned);
    }
    
    if (authors.length > 0) return authors.join(", ");

    // Fallback: look for author in the first paragraph if no infobox match
    const firstPara = wikitext.split('\n').find(l => l.trim().length > 50 && !l.trim().startsWith('{') && !l.trim().startsWith('|'));
    if (firstPara) {
      const authorLinkMatch = firstPara.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
      if (authorLinkMatch) return authorLinkMatch[2] || authorLinkMatch[1];
    }

    return "";
  }

  /**
   * Extracts cycle info from the `{{Książka}}` infobox: the cycle name (`|cykl=`),
   * neighboring volumes (`|poprzednia=` / `|następna=` — the prev/next chain, confirmed
   * on real raw) and — opportunistically — titles from links in the navigation
   * template `{{Cykl…}}`. Called in the cycle preview (no DB writes).
   * `|następna=`/`|nastepna=` both variants (the encyclopedia is sometimes inconsistent in the suffix).
   */
  static extractCycleInfo(wikitext: string): { cycleName: string; prev: string | null; next: string | null; templateVolumes: string[] } {
    if (!wikitext) return { cycleName: "", prev: null, next: null, templateVolumes: [] };

    // A single infobox parameter value (whole [[...]]/{{...}} as a token, cut at the next `|`).
    const field = (name: string): string => {
      const re = new RegExp(`\\|\\s*${name}\\s*=\\s*((?:\\[\\[[^\\]]*\\]\\]|\\{\\{[^{}]*\\}\\}|[^\\n|])+)`, "i");
      const m = wikitext.match(re);
      return m ? this.cleanWikitext(m[1]) : "";
    };

    const cycleName = field("cykl") || field("cykle");
    const prev = field("poprzednia") || field("poprzedni") || "";
    const next = field("następna") || field("nastepna") || field("następny") || field("nastepny") || "";

    // Navigation template {{Cykl…}} — collect the wikilink targets [[Tytuł]] in order.
    const templateVolumes: string[] = [];
    const tplMatch = wikitext.match(/\{\{\s*cykl[^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*\}\}/i);
    if (tplMatch) {
      const linkRe = /\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/g;
      let lm;
      while ((lm = linkRe.exec(tplMatch[0])) !== null) {
        const t = lm[1].trim();
        if (t && !templateVolumes.includes(t)) templateVolumes.push(t);
      }
    }

    return { cycleName, prev: prev || null, next: next || null, templateVolumes };
  }

}
