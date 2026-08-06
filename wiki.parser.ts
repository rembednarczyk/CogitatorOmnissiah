export class WikiParser {
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

    // 1. Pobierz wartości ogólne z {{Książka}} (jako fallback)
    // Wartość może zawierać linki z pipe ([[Cel|Etykieta]]) — dopasowuj całe [[...]]
    const wydawcaMatch = wikitext.match(/\|\s*wydawca\s*=\s*((?:\[\[[^\]]*\]\]|[^\n|])+)/i);
    if (wydawcaMatch) wydawca = this.cleanWikitext(wydawcaMatch[1]);

    const seriaMatch = wikitext.match(/\|\s*seria\s*=\s*((?:\[\[[^\]]*\]\]|[^\n|])+)/i);
    if (seriaMatch) seria = this.cleanWikitext(seriaMatch[1]);

    // 2. Pobierz wartości z {{tabela wydania}} (infowydanie) - priorytet dla najwyższego N z danymi
    const infoRegex = /\|\s*informacja(\d+)\s*=\s*\{\{infowydanie\s*\|([\s\S]*?)\}\}/gi;
    
    let match;
    const infos: { n: number, content: string }[] = [];
    while ((match = infoRegex.exec(wikitext)) !== null) {
      infos.push({ n: parseInt(match[1], 10), content: match[2] });
    }

    // Sortuj od najwyższego N, aby znaleźć najnowsze wydanie z danymi
    infos.sort((a, b) => b.n - a.n);

    for (const info of infos) {
      // Kotwica (?:^|\|) — nie dopasowuj wewnątrz innych parametrów (np. "współwydawca")
      const infoWydawcaMatch = info.content.match(/(?:^|\|)\s*wydawca\s*=\s*((?:\[\[[^\]]*\]\]|[^\n|])+)/i);
      const infoSeriaMatch = info.content.match(/(?:^|\|)\s*seria\s*=\s*((?:\[\[[^\]]*\]\]|[^\n|])+)/i);

      const foundWydawca = infoWydawcaMatch ? this.cleanWikitext(infoWydawcaMatch[1]) : "";
      const foundSeria = infoSeriaMatch ? this.cleanWikitext(infoSeriaMatch[1]) : "";

      if (foundWydawca || foundSeria) {
        if (foundWydawca) wydawca = foundWydawca;
        if (foundSeria) seria = foundSeria;
        // Znaleźliśmy najnowsze wydanie z danymi, przerywamy szukanie głębiej
        break;
      }
    }

    return { wydawca, seria };
  }

  static extractAuthor(wikitext: string): string {
    // Look for autor, twórca, or redaktor in infoboxes
    const authorRegex = /\|\s*(autor|twórca|redaktor|scenariusz|tekst)\s*=\s*([^\n|]+)/gi;
    let match;
    let authors: string[] = [];
    
    while ((match = authorRegex.exec(wikitext)) !== null) {
      let rawAuthor = match[2];
      rawAuthor = rawAuthor.replace(/\{\{sortname\|([^|}]+)\|([^|}]+)(?:\|[^}]+)?\}\}/gi, '$1 $2');
      rawAuthor = rawAuthor.replace(/\{\{Autor\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$1');
      authors.push(this.cleanWikitext(rawAuthor));
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

  static checkCycle(wikitext: string): boolean {
    if (!wikitext) return false;
    
    // 1. Parameters in infoboxes
    const hasCycleParam = /\|\s*(cykl(e)?|seria)\s*=\s*[^\s|}]/i.test(wikitext);
    if (hasCycleParam) return true;
    
    // 2. Templates
    const hasCycleTemplate = /\{\{(C|c)ykl\s*\|/i.test(wikitext);
    if (hasCycleTemplate) return true;
    
    const hasSeriaTemplate = /\{\{(S|s)eria\s*\|/i.test(wikitext);
    if (hasSeriaTemplate) return true;
    
    // 3. Specific Cycle/Series Infoboxes
    const hasCycleInfobox = /\{\{(Cykl|Seria)\s+infobox/i.test(wikitext);
    if (hasCycleInfobox) return true;
    
    // 4. Categories (excluding general lists)
    const hasCycleCategory = /\[\[Kategoria:\s*(Cykl|Seria)(?!e)/i.test(wikitext);
    if (hasCycleCategory) return true;
    
    return false;
  }

  static extractBooksFromAwardTable(wikitext: string, awardName: string): any[] {
    const books: any[] = [];
    let processedWikitext = wikitext;
    
    // Ignorowanie wybranych tabel dla nagrody Locus
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
    
    let colMap = {
      rok: 0,
      autor: 1,
      tytulOryginalny: 2,
      tytulPolski: 3,
      expectedLength: 4
    };

    const parseCell = (cell: string, extractLink = false, extractItalics = false) => {
      if (!cell) return extractLink ? { text: "", link: null } : "";
      let text = cell.trim();

      // Remove table cell attributes (e.g., rowspan="2"|, style="..."|, etc.)
      // Attributes are separated from content by a single pipe '|'.
      // We only strip if the part before '|' contains an '=' and doesn't contain brackets.
      const pipeIndex = text.indexOf('|');
      if (pipeIndex > 0) {
        const potentialAttr = text.substring(0, pipeIndex);
        if (potentialAttr.includes('=') && !potentialAttr.includes('[[') && !potentialAttr.includes('{{')) {
          text = text.substring(pipeIndex + 1).trim();
        }
      }

      let link = null;

      if (extractLink) {
        const linkMatch = text.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
        if (linkMatch) {
          link = linkMatch[1];
          text = linkMatch[2] || linkMatch[1];
        } else {
          text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');
        }
      } else {
        text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');
      }

      if (extractItalics) {
        const italicMatch = text.match(/''([^']+)''/);
        if (italicMatch) {
          text = italicMatch[1];
        }
      }

      text = text.replace(/''+/g, '')
                 .replace(/\{\{[^}]+\}\}/g, '')
                 .replace(/<[^>]+>/g, '')
                 .trim();

      return extractLink ? { text, link } : text;
    };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i].trim();
      if (!row || row.startsWith('!')) continue;

      const cells = row.split(/\n\||\|\|/).map(c => c.replace(/^\|/, '').trim());
      
      if (cells.length === 0) continue;

      let yearCell = cells[0];
      let yearMatch = yearCell.match(/\[\[(\d{4})\]\]/);
      if (!yearMatch) yearMatch = yearCell.match(/(\d{4})/);
      
      let year = yearMatch ? yearMatch[1] : "";
      
      if (year && cells.length < colMap.expectedLength) {
        lastYear = year;
        continue;
      }

      if (!year && lastYear) {
        year = lastYear;
      } else if (year) {
        lastYear = year;
      }

      let authorIndex = colMap.autor;
      let origTitleIndex = colMap.tytulOryginalny;
      let plTitleIndex = colMap.tytulPolski;

      if (cells.length === colMap.expectedLength - 1 && lastYear) {
        authorIndex--;
        origTitleIndex--;
        plTitleIndex--;
      }

      const author = parseCell(cells[authorIndex]) as string;
      const origTitleData = parseCell(cells[origTitleIndex], true, true) as { text: string, link: string | null };
      const plTitleData = parseCell(cells[plTitleIndex], true, true) as { text: string, link: string | null };

      let origTitle = origTitleData.text;
      let plTitle = plTitleData.text;
      
      if (!origTitle && !plTitle) continue;

      if (origTitle && !plTitle && awardName === "Nagroda im. Janusza A. Zajdla") {
        plTitle = origTitle;
        origTitle = "";
      }

      books.push({
        rok: year,
        autor: author,
        tytulOryginalny: origTitle,
        tytulPolski: plTitle,
        linkOryginalny: origTitleData.link,
        linkPolski: plTitleData.link
      });
    }

    return books;
  }
}
