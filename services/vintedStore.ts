import { VintedItem, VintedSeller } from "./vintedParser";

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
}

export interface StoredVintedData {
  /** ISO timestamp ostatniego skanu tej książki (świeżość danych). */
  scannedAt: string;
  offers: StoredOffer[];
}

/** Widok składowanych danych książki (do renderu kafelków/paczek z bazy — etap 3). */
export interface StoredBookView {
  id: string;
  title: string;
  author: string;
  scannedAt: string;
  offers: StoredOffer[];
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
      return { scannedAt: typeof d.scannedAt === "string" ? d.scannedAt : "", offers: d.offers };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Scala świeżo zeskanowane oferty ze składowanymi, ZACHOWUJĄC rozpoznanego sprzedawcę
 * dla ofert, których URL nadal istnieje — dzięki temu re-scan nie kasuje danych
 * sprzedawcy dociągniętych w etapie 2. Oferty zniknięte z Vinted wypadają, nowe wchodzą
 * bez sprzedawcy (do dociągnięcia).
 */
export function mergeOffers(fresh: StoredOffer[], prev: StoredOffer[] | undefined): StoredOffer[] {
  const prevByUrl = new Map((prev ?? []).map(o => [o.url, o]));
  return fresh.map(o => {
    if (o.seller) return o;
    const old = prevByUrl.get(o.url);
    return old?.seller ? { ...o, seller: old.seller } : o;
  });
}
