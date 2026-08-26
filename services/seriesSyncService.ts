import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { SyncEvent } from "../src/types";
import { WikiFieldSyncService, SERIES_FIELD } from "./wikiFieldSyncService";

/**
 * Series sync from book pages. A thin wrapper over
 * WikiFieldSyncService (shared pipeline, config for the "Seria" field).
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
