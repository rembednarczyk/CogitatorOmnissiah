import { describe, it, expect } from "vitest";
import { parseOpacResults, findBookMatch } from "../opacParser";

const ICON = { book: "pdt-p-book", movie: "pdt-p-movie", audiobook: "pdt-p-audiobook" } as const;
const article = (id: string, title: string, author: string, icon: keyof typeof ICON) => `
<article data-item-id="${id}" data-type="cataloged" class="fixed-height-article">
  <dl class="dl-horizontal">
    <dt  >Tytuł:</dt><dd ><span class="">${title} </span><br /></dd>
    ${author ? `<dt  >Autorzy:</dt><dd ><span class=""><a href="/search/description?q=x&amp;index=3">${author}</a></span><br /></dd>` : ""}
    <dt  >Wydawca:</dt><dd ><span class="">Poznań : Zysk i S-ka</span></dd>
  </dl>
  <div class="document-type document-type-result-list "><span class="${ICON[icon]}"></span><div class="document-type-text ">x</div></div>
</article>`;
const page = (...a: string[]) => `<div class="result-box">${a.join("")}</div>`;

describe("parseOpacResults", () => {
  it("extracts id, title, author (from Autorzy:) and document type per <article>", () => {
    const html = page(
      article("111", "Gra o tron", "Martin, George R. R. (1948- )", "audiobook"),
      article("222", "Rycerz Siedmiu Królestw", "Martin, George R. R. (1948- )", "book"),
      article("333", "Game of thrones. Sezon 1 = Gra o tron", "", "movie"),
    );
    const recs = parseOpacResults(html);
    expect(recs).toHaveLength(3);
    expect(recs[0]).toEqual({ id: "111", title: "Gra o tron", author: "Martin, George R. R. (1948- )", documentType: "audiobook" });
    expect(recs[1].documentType).toBe("ksiazka");
    expect(recs[2].documentType).toBe("film");
    expect(recs[2].author).toBe(""); // films have no Autorzy field
  });

  it("returns [] for an empty result box", () => {
    expect(parseOpacResults(`<div class="result-box"></div>`)).toEqual([]);
  });
});

describe("findBookMatch", () => {
  it("matches the physical book and ignores same-title film/audiobook", () => {
    const recs = parseOpacResults(page(
      article("a", "Solaris", "", "movie"),
      article("b", "Solaris", "Lem, Stanisław", "audiobook"),
      article("c", "Solaris", "Lem, Stanisław (1921-2006)", "book"),
    ));
    const hit = findBookMatch(recs, "Solaris", "Stanisław Lem");
    expect(hit?.id).toBe("c");
    expect(hit?.documentType).toBe("ksiazka");
  });

  it('returns null when the library holds only the audiobook/film + other titles by the author', () => {
    const recs = parseOpacResults(page(
      article("a", "Gra o tron", "Martin, George R. R. (1948- )", "audiobook"),
      article("b", "Game of thrones. Sezon 1 = Gra o tron", "", "movie"),
      article("c", "Rycerz Siedmiu Królestw", "Martin, George R. R. (1948- )", "book"),
    ));
    expect(findBookMatch(recs, "Gra o tron", "George R. R. Martin")).toBeNull();
  });

  it("can opt into audiobooks when asked", () => {
    const recs = parseOpacResults(page(article("a", "Gra o tron", "Martin, George R. R. (1948- )", "audiobook")));
    expect(findBookMatch(recs, "Gra o tron", "George R. R. Martin")).toBeNull();
    expect(findBookMatch(recs, "Gra o tron", "George R. R. Martin", { includeAudiobook: true })?.id).toBe("a");
  });

  it("rejects a different book by the same author (title guard)", () => {
    const recs = parseOpacResults(page(article("c", "Ogień i krew", "Martin, George R. R. (1948- )", "book")));
    expect(findBookMatch(recs, "Gra o tron", "George R. R. Martin")).toBeNull();
  });
});
