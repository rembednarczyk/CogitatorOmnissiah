import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { SyncEvent } from "../src/types";
import { WikiFieldSyncService, SERIES_FIELD } from "./wikiFieldSyncService";

/**
 * Synchronizacja serii ze stron książek. Cienkie opakowanie nad
 * WikiFieldSyncService (wspólny potok, konfiguracja pola "Seria").
 */
export class SeriesSyncService {
  private field: WikiFieldSyncService;

  constructor(notion: NotionAdapter, wiki: WikiAdapter) {
    this.field = new WikiFieldSyncService(notion, wiki, SERIES_FIELD);
  }

  async runSeriesSync(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    return this.field.run(sendEvent, checkCancellation);
  }
}
