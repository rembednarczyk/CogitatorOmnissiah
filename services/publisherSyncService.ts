import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { SyncEvent } from "../src/types";
import { WikiFieldSyncService, PUBLISHER_FIELD } from "./wikiFieldSyncService";

/**
 * Publisher sync from book pages. A thin wrapper over
 * WikiFieldSyncService (shared pipeline, config for the "Wydawnictwo" field).
 */
export class PublisherSyncService {
  private field: WikiFieldSyncService;

  constructor(notion: NotionAdapter, wiki: WikiAdapter) {
    this.field = new WikiFieldSyncService(notion, wiki, PUBLISHER_FIELD);
  }

  async runPublisherSync(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    return this.field.run(sendEvent, checkCancellation);
  }
}
