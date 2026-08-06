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

}
