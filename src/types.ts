export interface Book {
  year: string;
  author: string;
  polishTitle: string;
  originalTitle: string;
  polishTitleLink: string | null;
  award: string;
  awards?: string[];
}

export interface NotionRichTextItem {
  plain_text: string;
  href?: string | null;
  text?: { content: string; link?: { url: string } | null };
}

export interface NotionProperty {
  id?: string;
  type?: string;
  title?: NotionRichTextItem[];
  rich_text?: NotionRichTextItem[];
  number?: number;
  select?: { name: string; color?: string } | null;
  multi_select?: { name: string; color?: string }[];
  checkbox?: boolean;
  url?: string | null;
  name?: string;
}

export interface NotionPageProperties {
  [key: string]: NotionProperty;
}

export interface NotionPage {
  id: string;
  properties: NotionPageProperties;
}

export interface NotionBook {
  id: string;
  plTitle: string;
  origTitle: string;
  awards: string[];
  year?: string;
  author?: string;
  currentWydawnictwo?: string;
  currentSeria?: string;
  currentCzesccyklu?: boolean;
  /** Kategoria wiersza: „Nagroda" (domyślnie/pusto) vs „Tom cyklu" (poboczny tom cyklu). */
  kategoria?: string;
  lp?: string;
  zrodlo?: string[];
  plTitleRichText?: NotionRichTextItem[];
  origTitleRichText?: NotionRichTextItem[];
  /** Blob JSON składowanych wyników Vinted (pole „VintedData") — parsowany przez vintedStore. */
  vintedData?: string;
  /** Nazwa cyklu (pole „Cykl") — grupuje wiersze jednego cyklu (kotwica + poboczne tomy). */
  cykl?: string;
  /** Pozycja w cyklu (pole „CyklNr", number) — kolejność czytania. */
  cyklNr?: number;
  /** Ręczny klucz porządku na regale (kolumna „ShelfOrder"; skala ułamkowych lat). */
  shelfOrder?: number;
}

/**
 * Odchudzony rekord książki dla wyszukiwarki „Skryptorium" (`GET /api/books`).
 * Świadomie BEZ ciężkich pól (`vintedData` blob, `*RichText`) — to indeks do
 * filtrowania client-side, nie pełny model. Współdzielony przez serwer i front.
 */
export interface BookIndexEntry {
  id: string;
  plTitle: string;
  origTitle: string;
  author: string;
  year: string;
  awards: string[];
  zrodlo: string[];
  series: string;
  partOfCycle: boolean;
  /** Ręczny klucz porządku na regale (precyzyjny drag&drop); brak → sort po roku. */
  shelfOrder?: number;
}

export interface SyncState {
  loading: boolean;
  result: any | null;
  error: string | null;
  statusMessage: string | null;
  progress: { current: number; total: number } | null;
  startTime: number | null;
  awardName?: string;
  pageTitle?: string;
  isSyncAll?: boolean;
  color?: string;
}

export interface SyncEvent {
  // "match" / "search_attempt" są emitowane przez skanery (Vinted/Biblioteka)
  // "seller_resolved" — grupowanie Vinted per sprzedawca (dociąganie sprzedawcy oferty)
  type: "status" | "progress" | "complete" | "error" | "match" | "search_attempt" | "seller_resolved";
  message?: string;
  error?: string;
  current?: number;
  total?: number;
  result?: any;
}

export interface SyncParams {
  awardName?: string;
  pageTitle?: string;
  syncAll?: boolean;
}

export interface IntegrityCheckResult {
  lpUniqueness: { status: boolean; duplicates: string[] };
  yearCountMatch: { 
    status: boolean; 
    diffs: { 
      year: string; 
      notion: number; 
      wiki: number;
      notionOnly?: string[];
      wikiOnly?: string[];
      misplaced?: { title: string, otherYear: string }[];
      collisions?: { title: string, matches: string[] }[];
    }[] 
  };
  originalTitleUniqueness: { status: boolean; duplicates: string[] };
  polishTitleUniqueness: { status: boolean; duplicates: string[] };
  awardCountMatch: {
    status: boolean;
    diffs: {
      award: string;
      notion: number;
      wiki: number;
      notionOnly?: string[];
      wikiOnly?: string[];
    }[]
  };
}
