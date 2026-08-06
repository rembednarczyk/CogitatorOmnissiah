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
  lp?: string;
  zrodlo?: string[];
  plTitleRichText?: NotionRichTextItem[];
  origTitleRichText?: NotionRichTextItem[];
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
  type: "status" | "progress" | "complete" | "error" | "match" | "search_attempt";
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
