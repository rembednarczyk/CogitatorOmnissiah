import { createLogger } from "../logger";

const log = createLogger("VintedParse");

export interface VintedItem {
  id?: string | number;
  title: string;
  price: string | number;
  /** Cena jako liczba (do sortowania). null, gdy nieznana (placeholder „Sprawdź"/„??"). */
  priceValue: number | null;
  currency: string;
  url: string;
  /** Miniatura oferty z katalogu Vinted (tylko ścieżka JSON — fallbacki HTML jej nie mają). */
  photo?: string | null;
  /** Sprzedawca — dociągany on-demand ze strony oferty (nie ma go w katalogu). */
  seller?: VintedSeller | null;
}

export interface VintedSeller {
  /** Numeryczne ID profilu (`/member/{id}`) — klucz grupowania. */
  id: string;
  /** Widoczny login sprzedawcy. */
  login: string;
  /** Link do profilu. */
  url: string;
}

/**
 * Normalizuje surową cenę Vinted do liczby: „15" → 15, „25,00" → 25, „12.90" → 12.9,
 * liczba → liczba. Placeholdery („??", „Sprawdź", puste) i wartości nieliczbowe → null,
 * żeby oferty bez ceny dało się posortować na koniec zamiast psuć porównania.
 */
/**
 * Odcina string od rodzica. V8 NIE kopiuje podstringów: `str.match()`/`.split()` na
 * wielkim HTML (~7 MB) zwraca SlicedString trzymający wskaźnik do CAŁEGO rodzica.
 * Gdy takie pole trafia do długo żyjącej tablicy (`results` skanera), pinuje cały
 * HTML — po ~26 stronach to OOM (potwierdzone logami Rendera). `Buffer.from(...)`
 * tworzy samodzielną kopię bajtów, odcinając referencję do 7 MB rodzica. Pola oferty
 * są krótkie, więc koszt kopii jest pomijalny.
 */
function detach(s: string): string {
  return Buffer.from(s, "utf8").toString("utf8");
}

export function parseVintedPrice(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = raw.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Czysty parser wyników katalogu Vinted (HTML → oferty). Bez I/O ani zdarzeń SSE —
 * skaner tylko podaje surowy HTML, tytuł i autora, a dostaje do 5 dopasowanych
 * ofert. Cztery kaskadowe ścieżki: (1) blob JSON `data-component-name="Catalog"`,
 * (2) fallback po regexie `"items":[…]` z domykaniem nawiasów, (3) bloki
 * `feed-grid__item`, (4) globalny regex `href=/items/…`. Wyodrębnione, by tę
 * kruchą logikę dało się testować jednostkowo na utrwalonym HTML.
 */
export interface VintedDebug {
  /** Długość odpowiedzi HTML (znaki). Bardzo mała = możliwy blok/challenge. */
  chars: number;
  /** Czy strona zawiera blob JSON katalogu (ścieżka „bogata"). */
  hasCatalogJson: boolean;
  /** Czy są bloki feed-grid (ścieżka fallback). */
  hasFeedGrid: boolean;
  /** Ile linków /items/ jest w HTML (są oferty, nawet jeśli parser ich nie złapał). */
  itemLinks: number;
  /** Markery blokady bota (cloudflare/captcha/robot). */
  blockedMarker: boolean;
  /** Markery „brak wyników" Vinted. */
  noResultsMarker: boolean;
  /** Ile ofert faktycznie wyłuskał parser. */
  parsed: number;
}

// Realna strona wyników Vinted to megabajty HTML. Strona challenge/blokady
// Cloudflare jest MAŁA i niesie konkretny marker. Samo słowo „cloudflare"/
// „robot" występuje w normalnym HTML (analytics, meta), więc było fałszywym
// alarmem na każdej stronie — dlatego bramkujemy rozmiarem i frazą challenge.
const CHALLENGE_RE = /just a moment|attention required|cf-mitigated|checking your browser|verify you are human|enable javascript and cookies|please complete the security check/i;

export function looksBlocked(html: string): boolean {
  const h = html || "";
  return h.length < 100_000 && CHALLENGE_RE.test(h);
}

// Kafelek oferty w siatce katalogu. Vinted hashuje nazwy klas CSS-modules
// (`Grid-module-scss-module__HmDNda__feed-grid__item`), więc celujemy w stabilny
// suffiks `feed-grid__item"`. Trailing `"` odcina wariant `feed-grid__item-content`.
const FEED_GRID_RE = /feed-grid__item"/;

/**
 * Lekka diagnostyka odpowiedzi Vinted (bez I/O) — pomaga odróżnić realny brak
 * ofert od cichej blokady lub gubienia ofert przez parser. `itemLinks > 0` przy
 * `parsed === 0` i braku markerów = mocny sygnał, że parser coś przeoczył.
 */
export function vintedDiagnostics(html: string, parsed: number): VintedDebug {
  const h = html || "";
  return {
    chars: h.length,
    hasCatalogJson: h.includes('data-component-name="Catalog"'),
    // Vinted hashuje klasy CSS-modules (np. `Grid-module-scss-module__…__feed-grid__item`),
    // więc dopasowujemy stabilny suffiks `feed-grid__item"`, nie całą klasę.
    hasFeedGrid: FEED_GRID_RE.test(h),
    itemLinks: (h.match(/\/items\//g) || []).length,
    blockedMarker: looksBlocked(h),
    noResultsMarker: h.includes("Brak wyników") || h.includes("Nie znaleźliśmy żadnych przedmiotów"),
    parsed,
  };
}

export function parseVintedItems(html: string, title: string, author: string): VintedItem[] {
  const items: VintedItem[] = [];
  let rawItems: any[] = [];

  // 1. Blob JSON w atrybucie data-props / treści skryptu Catalog
  const catalogMatch = html.match(/data-component-name="Catalog"[^>]*data-props="([^"]+)"/s) ||
                       html.match(/data-component-name="Catalog"[^>]*>\s*({.*?})\s*<\/script>/s);

  if (catalogMatch) {
    try {
      // Atrybuty HTML używają &quot; zamiast "
      let jsonStr = catalogMatch[1];
      if (jsonStr.includes('&quot;')) {
        jsonStr = jsonStr.replace(/&quot;/g, '"')
                         .replace(/&amp;/g, '&')
                         .replace(/&lt;/g, '<')
                         .replace(/&gt;/g, '>')
                         .replace(/&#39;/g, "'");
      }
      const catalogData = JSON.parse(jsonStr);
      rawItems = catalogData.items?.list ||
                 catalogData.items ||
                 catalogData.catalog?.results?.items ||
                 catalogData.catalog?.items ||
                 [];
      log.info(`Znaleziono elementy w JSON`, { title, count: rawItems.length });
    } catch (e) {
      log.warn("Nie udało się sparsować JSON katalogu Vinted", { title });
    }
  }

  // 2. Fallback po starym regexie "items" (z domykaniem nawiasów tablicy)
  if (rawItems.length === 0) {
    const jsonMatch = html.match(/"items":\s*(\[.*?\])/);
    if (jsonMatch) {
      try {
        let bracketCount = 0;
        let endIndex = -1;
        const str = jsonMatch[1];
        for (let i = 0; i < str.length; i++) {
          if (str[i] === '[') bracketCount++;
          else if (str[i] === ']') {
            bracketCount--;
            if (bracketCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
        const jsonStr = endIndex !== -1 ? str.substring(0, endIndex) : str;
        rawItems = JSON.parse(jsonStr);
      } catch (e) {
        // Regex bywa zbyt prosty — trudno; przejdź do fallbacków HTML
      }
    }
  }

  if (Array.isArray(rawItems)) {
    for (const item of rawItems) {
      if (items.length >= 5) break;

      const itemTitle = (item.title || "").toLowerCase();
      const searchTitle = title.toLowerCase();
      const searchAuthor = (author || "").toLowerCase();

      // Elastyczne dopasowanie: tytuł oferty zawiera tytuł książki (lub odwrotnie),
      // albo tytuł oferty zawiera nazwisko autora.
      const hasTitle = itemTitle.includes(searchTitle) || searchTitle.includes(itemTitle);
      const hasAuthor = searchAuthor && itemTitle.includes(searchAuthor);

      if (hasTitle || hasAuthor) {
        const rawPrice = item.price?.amount || item.total_item_price?.amount || item.price?.amount_decimal || "??";
        const photo = item.photo?.url || item.photo?.thumbnails?.[0]?.url || item.photos?.[0]?.url || null;
        items.push({
          id: item.id,
          title: item.title || itemTitle,
          price: rawPrice,
          priceValue: parseVintedPrice(rawPrice),
          currency: item.price?.currency_code || item.currency || "PLN",
          url: item.url ? (item.url.startsWith('http') ? item.url : `https://www.vinted.pl${item.url}`) : `https://www.vinted.pl/items/${item.id}`,
          photo
        });
      }
    }
  }

  // 3. Fallback po kafelkach siatki feed-grid (aktualny DOM Vinted, klasy hashowane).
  // Dzielimy na `feed-grid__item"` — łapie stary `class="feed-grid__item"` i nowy
  // `class="Grid-module-scss-module__…__feed-grid__item"`. Z każdego kafelka bierzemy
  // URL, tytuł, cenę strukturalną i miniaturę (`images1.vinted.net`).
  if (items.length === 0) {
    const itemBlocks = html.split(FEED_GRID_RE);
    if (itemBlocks.length > 1) {
      const searchTitle = title.toLowerCase();
      const searchAuthor = (author || "").toLowerCase();
      for (let j = 1; j < itemBlocks.length && items.length < 5; j++) {
        const block = itemBlocks[j];
        // URL bez query (`?referrer=catalog`) — spójny z kanonicznym linkiem oferty.
        const urlMatch = block.match(/href="(\/items\/[^"?]+)/);
        const titleMatch = block.match(/title="([^"]+)"/);
        // Oba warianty mają group1 = kwota, group2 = waluta. Pierwsze trafienie
        // w kafelku to cena przedmiotu (drugie = cena z ochroną kupującego).
        const priceMatch = block.match(/aria-label="[^"]*?(\d+[.,]\d+)\s*([A-Z]{3}|zł)"/i) ||
                           block.match(/>(\d+[.,]\d+)\s*([A-Z]{3}|zł)</i);
        const photoMatch = block.match(/<img[^>]+?src="(https?:\/\/[^"]*vinted\.net\/[^"]+)"/i);

        if (urlMatch && titleMatch) {
          const itemTitle = titleMatch[1];
          const lower = itemTitle.toLowerCase();
          const hasTitle = lower.includes(searchTitle) || searchTitle.includes(lower);
          const hasAuthor = !!searchAuthor && lower.includes(searchAuthor);
          if (hasTitle || hasAuthor) {
            const rawPrice = priceMatch ? priceMatch[1] : "Sprawdź";
            // detach: wszystkie te pola to podstringi 7 MB HTML — bez kopii pinują rodzica.
            items.push({
              title: detach(itemTitle),
              url: detach(`https://www.vinted.pl${urlMatch[1]}`),
              price: detach(rawPrice),
              priceValue: parseVintedPrice(rawPrice),
              currency: priceMatch ? detach(priceMatch[2]) : "PLN",
              photo: photoMatch ? detach(photoMatch[1]) : null
            });
          }
        }
      }
    }
  }

  // 4. Ostateczność: prosty globalny regex
  if (items.length === 0) {
    const itemRegex = /href="(\/items\/[^"]+)"[^>]*title="([^"]+)"/g;
    let match;
    while ((match = itemRegex.exec(html)) !== null && items.length < 5) {
      const itemUrl = `https://www.vinted.pl${match[1]}`;
      const itemTitle = match[2];
      if (itemTitle.toLowerCase().includes(title.toLowerCase())) {
        // detach: itemTitle/itemUrl to podstringi HTML — bez kopii pinują 7 MB rodzica.
        items.push({ title: detach(itemTitle), url: detach(itemUrl), price: "Sprawdź", priceValue: null, currency: "PLN" });
      }
    }
  }

  // Ostatnia deska ratunku dla ceny: ścieżki HTML łapią atrybut title aukcji,
  // który Vinted buduje jako „Tytuł, Marka, Stan: …, {cena} zł, {cena z ochroną} zł".
  // Gdy nie mamy ceny strukturalnej, wyłuskujemy ją z tego tekstu (niższa z dwóch
  // = cena przedmiotu, wyższa = z ochroną kupującego).
  for (const item of items) {
    if (item.priceValue === null) {
      const fromText = extractPriceFromText(item.title);
      if (fromText !== null) {
        item.priceValue = fromText;
        item.price = String(fromText);
        item.currency = "zł";
      }
    }
  }

  return items;
}

/**
 * Wyłuskuje sprzedawcę ze strony pojedynczej oferty Vinted (`/items/{id}`).
 * Sprzedawcy NIE ma w kafelkach katalogu — pojawia się dopiero na stronie oferty.
 * Dwa stabilne, unikalne uchwyty (zweryfikowane na realnym HTML): link profilu
 * `/member/{id}` (ID) oraz `data-testid="profile-username"` (login). `detach` na
 * loginie — strona oferty to ~2 MB, podstring bez kopii pinowałby ją (jak w skanie).
 */
export function extractVintedSeller(html: string): VintedSeller | null {
  const idMatch = html.match(/href="\/member\/(\d+)"/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const loginMatch = html.match(/data-testid="profile-username">\s*([^<]+?)\s*<\/span>/);
  const login = loginMatch ? detach(loginMatch[1]) : `user-${id}`;
  return { id, login, url: `https://www.vinted.pl/member/${id}` };
}

/**
 * Wyłuskuje najniższą kwotę „NN[.,]NN zł/PLN" z tekstu (np. z atrybutu title
 * oferty). Zwraca cenę przedmiotu (niższą z pary cena/total) albo null.
 */
export function extractPriceFromText(text: string): number | null {
  if (!text) return null;
  // Uwaga: bez \b po „zł" — „ł" to nie-słowny znak, więc granica słowa nie zachodzi.
  const re = /(\d+(?:[.,]\d+)?)\s*(?:zł|PLN)/gi;
  const values: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = parseVintedPrice(m[1]);
    if (v !== null) values.push(v);
  }
  return values.length ? Math.min(...values) : null;
}
