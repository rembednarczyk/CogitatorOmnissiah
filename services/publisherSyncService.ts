import { NotionAdapter } from "../notion.adapter";
import { WikiAdapter } from "../wiki.adapter";
import { SyncEvent } from "../src/types";
import { WikiFieldSyncService, PUBLISHER_FIELD } from "./wikiFieldSyncService";

/**
 * Synchronizacja wydawcy ze stron książek. Cienkie opakowanie nad
 * WikiFieldSyncService (wspólny potok, konfiguracja pola "Wydawnictwo").
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
