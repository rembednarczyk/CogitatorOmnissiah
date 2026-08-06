export interface Book {
  year: string;
  author: string;
  polishTitle: string;
  originalTitle: string;
  polishTitleLink: string | null;
  award: string;
  awards?: string[];
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
  type: "status" | "progress" | "complete" | "error";
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
  cycleCountMatch: { 
    status: boolean; 
    notionCount: number; 
    wikiCount: number;
    notionOnly?: string[];
    wikiOnly?: string[];
  };
}
