import { VintedItem, VintedSeller } from "./vintedParser";
import { NotionBook } from "../src/types";

/**
 * Trwałe składowanie wyników Vinted w Notion (blob JSON w polu tekstowym książki).
 * Rozdziela drogie/limitowane zdobywanie danych (scrape pod Cloudflare) od taniej,
 * powtarzalnej analizy (grupowanie per sprzedawca) — raz zescrapowane oferty żyją w
 * bazie, więc skan jest wznawialny, a analiza nie wymaga ponownego pobierania.
 * Zob. docs/vinted-scanner.md §5.
 */

export interface StoredOffer {
  url: string;
  title?: string;
  /** Cena jako liczba (priceValue). null = nieznana. */
  price: number | null;
  currency: string;
  photo?: string | null;
  /** Sprzedawca — null, dopóki nie dociągnięty osobnym krokiem (etap 2). */
  seller?: VintedSeller | null;
  /** Cena z POPRZEDNIEGO skanu (do wykrycia spadku). Ustawiana dla ofert, które przetrwały. */
  prevPrice?: number | null;
  /** ISO — kiedy ten URL oferty pojawił się po raz pierwszy (do znacznika „nowa"). */
  firstSeenAt?: string;
}

export interface StoredVintedData {
  /** ISO timestamp ostatniego skanu tej książki (świeżość danych). */
  scannedAt: string;
  /** ISO — kiedy zestaw ofert OSTATNIO się zmienił (nowa/zniknięta/inna cena). */
  changedAt?: string;
  offers: StoredOffer[];
}

/** Widok składowanych danych książki (do renderu kafelków/paczek z bazy — etap 3). */
export interface StoredBookView {
  id: string;
  title: string;
  author: string;
  /** Rok wydania (kolumna „Rok" w Notion) — metadana, prosto z bazy. */
  year?: string;
  /** Czy książka jest częścią cyklu (kolumna „Część cyklu", checkbox) — ryzyko „kolejny tom". */
  partOfCycle?: boolean;
  scannedAt: string;
  changedAt?: string;
  offers: StoredOffer[];
}

/** Podsumowanie zmian jednej książki między poprzednim a świeżym skanem. */
export interface OfferDiff {
  added: number;
  removed: number;
  priceDropped: number;
  priceRaised: number;
}

export const EMPTY_DIFF: OfferDiff = { added: 0, removed: 0, priceDropped: 0, priceRaised: 0 };

export function hasChanges(d: OfferDiff): boolean {
  return d.added > 0 || d.removed > 0 || d.priceDropped > 0 || d.priceRaised > 0;
}

/**
 * Polityka znacznika `changedAt`: bump do `scannedAt` TYLKO gdy istnieje poprzedni
 * stan (baseline) I faktycznie coś się zmieniło — inaczej pierwszy skan fałszywie
 * oznaczałby całą książkę jako „zmiana". Bez baseline / bez zmian: zachowaj stary.
 */
export function computeChangedAt(prevData: StoredVintedData | null, diff: OfferDiff, scannedAt: string): string | undefined {
  return prevData && hasChanges(diff) ? scannedAt : prevData?.changedAt;
}

/** Projekcja wiersza Notion + składowanych danych → widok kafelka/paczki (etap 3). */
export function toStoredBookView(book: NotionBook, data: StoredVintedData): StoredBookView {
  return {
    id: book.id,
    title: book.plTitle,
    author: book.author || "",
    year: book.year,
    partOfCycle: book.currentCzesccyklu,
    scannedAt: data.scannedAt,
    changedAt: data.changedAt,
    offers: data.offers,
  };
}

/** VintedItem (ze skanu) → StoredOffer (do zapisu). */
export function offerFromItem(item: VintedItem): StoredOffer {
  return {
    url: item.url,
    title: item.title,
    price: item.priceValue,
    currency: item.currency,
    photo: item.photo ?? null,
    seller: item.seller ?? null,
  };
}

export function serializeVintedData(data: StoredVintedData): string {
  return JSON.stringify(data);
}

/** Parsuje blob z Notion; zwraca null dla pustego/uszkodzonego (nie wywala skanu). */
export function parseVintedData(raw: string | null | undefined): StoredVintedData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d && typeof d === "object" && Array.isArray(d.offers)) {
      return {
        scannedAt: typeof d.scannedAt === "string" ? d.scannedAt : "",
        changedAt: typeof d.changedAt === "string" ? d.changedAt : undefined,
        offers: d.offers,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Scala świeżo zeskanowane oferty ze składowanymi ORAZ liczy diff (nowe / zniknięte /
 * zmiana ceny). ZACHOWUJE rozpoznanego sprzedawcę i `firstSeenAt` dla ofert o niezmienionym
 * URL (re-scan nie kasuje danych sprzedawcy z etapu 2), ustawia `prevPrice` = cena z
 * poprzedniego skanu (do wykrycia spadku), a nowym ofertom stempluje `firstSeenAt = scannedAt`.
 */
export function mergeAndDiff(
  fresh: StoredOffer[],
  prev: StoredOffer[] | undefined,
  scannedAt: string,
): { offers: StoredOffer[]; diff: OfferDiff } {
  const prevByUrl = new Map((prev ?? []).map(o => [o.url, o]));

  // Dedupe świeżych po URL — parser potrafi zwrócić tę samą ofertę dwa razy; bez tego
  // `added` i lista ofert puchną (duplikat renderowany 2× i liczony jako 2 „nowe").
  const uniqueFresh: StoredOffer[] = [];
  const freshUrls = new Set<string>();
  for (const o of fresh) {
    if (freshUrls.has(o.url)) continue;
    freshUrls.add(o.url);
    uniqueFresh.push(o);
  }

  let added = 0, priceDropped = 0, priceRaised = 0;
  const offers: StoredOffer[] = uniqueFresh.map(o => {
    const old = prevByUrl.get(o.url);
    if (!old) {
      added++;
      return { ...o, seller: o.seller ?? null, firstSeenAt: scannedAt };
    }
    // Oferta przetrwała: zachowaj sprzedawcę i ORYGINALNY firstSeenAt (może być undefined
    // dla starych blobów sprzed tej funkcji — wtedy NIE oznaczamy jej jako „nowa"), zapisz
    // poprzednią cenę do wykrycia spadku.
    const seller = o.seller ?? old.seller ?? null;
    const firstSeenAt = old.firstSeenAt;
    const prevPrice = typeof old.price === "number" ? old.price : null;
    if (typeof o.price === "number" && typeof old.price === "number" && o.price !== old.price) {
      if (o.price < old.price) priceDropped++; else priceRaised++;
    }
    return { ...o, seller, firstSeenAt, prevPrice };
  });

  const removed = (prev ?? []).filter(o => !freshUrls.has(o.url)).length;
  return { offers, diff: { added, removed, priceDropped, priceRaised } };
}
