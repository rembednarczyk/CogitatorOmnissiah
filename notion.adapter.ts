import { Client } from "@notionhq/client";
import { withRetry } from "./retry";
import { sanitizeNotionString, sanitizeNotionTag } from "./utils";
import { NotionPage, NotionBook } from "./src/types";
import { mapPageToBook } from "./notionMapper";

// Short cache of the full book list for the scanners' READ-ONLY paths
// (the library „Skanuj wszystkie" would query Notion once per branch). The cache is
// opt-in (`{ cache: true }`), so stats (`/api/stats`) always read fresh data, and
// every book write invalidates it. The TTL is only a safeguard against edits made
// outside the app.
const BOOKS_CACHE_TTL_MS = 5 * 60 * 1000;

export class NotionAdapter {
  private notion: Client;
  private actualDataSourceId: string | null = null;
  private isDataSource: boolean = true;
  private initPromise: Promise<void> | null = null;
  private booksCache: { data: NotionBook[]; expiresAt: number } | null = null;

  constructor(apiKey: string, private databaseId: string) {
    this.notion = new Client({ auth: apiKey });
  }

  /** Invalidates the book-list cache — called after every write that changes books. */
  private invalidateBooksCache(): void {
    this.booksCache = null;
  }

  async init(): Promise<void> {
    if (this.actualDataSourceId) return; // Already initialized
    // Deduplicate concurrent init() calls — a single in-flight initialization
    if (!this.initPromise) {
      this.initPromise = this.doInit().catch((err) => {
        this.initPromise = null; // allow retrying after an error
        throw err;
      });
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      // Try as data_source first (withRetry doesn't retry 404 — only 429/5xx/network)
      await withRetry(() => (this.notion as any).dataSources.retrieve({ data_source_id: this.databaseId }));
      this.actualDataSourceId = this.databaseId;
      this.isDataSource = true;
    } catch (e: any) {
      // Fallback to database
      try {
        const database = await withRetry(() => this.notion.databases.retrieve({ database_id: this.databaseId })) as any;
        if (database.data_sources && database.data_sources.length > 0) {
          this.actualDataSourceId = database.data_sources[0].id;
          this.isDataSource = true;
        } else {
          // It's a regular database
          this.actualDataSourceId = this.databaseId;
          this.isDataSource = false;
        }
      } catch (dbError: any) {
        // "No access" only on a genuine 404 — a timeout isn't a permissions problem
        if (dbError?.code === "object_not_found" || dbError?.status === 404) {
          throw new Error(`Nie można znaleźć bazy danych ani źródła danych o ID: ${this.databaseId}. Upewnij się, że integracja ma dostęp.`);
        }
        throw new Error(`Błąd połączenia z Notion podczas inicjalizacji: ${dbError?.message || dbError}`);
      }
    }
  }

  // --- Dual-mode helpers ---
  // Notion exposes the base as a "data source" (new API) or a classic "database".
  // These three helpers encapsulate the isDataSource branching, which was previously
  // duplicated across ~7 methods.

  private async retrieveSource(id: string): Promise<any> {
    return this.isDataSource
      ? await withRetry(() => (this.notion as any).dataSources.retrieve({ data_source_id: id }))
      : await withRetry(() => this.notion.databases.retrieve({ database_id: id }));
  }

  private async updateSource(id: string, properties: any): Promise<void> {
    if (this.isDataSource) {
      await withRetry(() => (this.notion as any).dataSources.update({ data_source_id: id, properties }));
    } else {
      await withRetry(() => this.notion.databases.update({ database_id: id, properties } as any));
    }
  }

  private async querySource(startCursor?: string): Promise<any> {
    return this.isDataSource
      ? await withRetry(() => (this.notion as any).dataSources.query({ data_source_id: this.actualDataSourceId!, start_cursor: startCursor }))
      : await withRetry(() => (this.notion.databases as any).query({ database_id: this.actualDataSourceId!, start_cursor: startCursor }));
  }

  async getSchema(): Promise<any> {
    await this.init();
    const source = await this.retrieveSource(this.actualDataSourceId!);
    return source.properties;
  }

  async updateSchema(propertyName: string, propertyType: string, newOptions: any): Promise<void> {
    await this.init();
    await this.updateSource(this.actualDataSourceId!, {
      [propertyName]: { [propertyType]: { options: newOptions } }
    });
  }

  async createColumnIfNeeded(columnName: string, type: string = "rich_text"): Promise<void> {
    await this.init();
    const schema = await this.getSchema();
    if (!schema[columnName]) {
      await this.updateSource(this.actualDataSourceId!, { [columnName]: { [type]: {} } });
    }
  }

  /**
   * Writes manual shelf ordering keys (column „ShelfOrder", number) for a batch of
   * books — precise drag&drop sends 1 entry (the inserted one), and several when
   * renumbering ties. The column is created on first write. Sequential (not parallel)
   * — batches are small, and Notion's rate limit is sensitive to bursts.
   */
  async setShelfOrders(entries: { pageId: string; order: number }[]): Promise<void> {
    await this.init();
    await this.createColumnIfNeeded("ShelfOrder", "number");
    for (const e of entries) {
      await withRetry(() => this.notion.pages.update({
        page_id: e.pageId,
        properties: { "ShelfOrder": { number: e.order } },
      }));
    }
    this.invalidateBooksCache();
  }

  /** Name of the column that carries the app config (the JSON blob lives in its DESCRIPTION, not in rows). */
  private static readonly APP_CONFIG_COLUMN = "AppConfig";

  /**
   * Reads the config blob from the `AppConfig` column's description. Missing column/description → null
   * (the app runs on defaults from `configSchema`). The column description was chosen over a
   * sentinel row, because the rituals (purification/integrity/LP) iterate over all rows
   * and a sentinel would leak into them.
   */
  async getAppConfigRaw(): Promise<string | null> {
    const schema = await this.getSchema();
    const desc = schema?.[NotionAdapter.APP_CONFIG_COLUMN]?.description;
    return typeof desc === "string" && desc.trim() ? desc : null;
  }

  /** Writes the config blob to the `AppConfig` column's description (creates the column on first write). */
  async saveAppConfigRaw(json: string): Promise<void> {
    await this.init();
    await this.updateSource(this.actualDataSourceId!, {
      [NotionAdapter.APP_CONFIG_COLUMN]: { rich_text: {}, description: json },
    });
  }

  async queryAllBooks(onProgress?: (count: number) => void, checkCancellation?: () => boolean): Promise<NotionBook[]> {
    await this.init();
    const allBooks: NotionBook[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    while (hasMore) {
      if (checkCancellation && checkCancellation()) break;

      const response = await this.querySource(nextCursor);

      for (const page of response.results) {
        allBooks.push(mapPageToBook(page as NotionPage));
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor ?? undefined;
      // Safeguard: has_more === true without a cursor would mean re-fetching
      // page 1 from the start over and over (and double counting). Break instead of hanging.
      if (hasMore && !nextCursor) break;
      if (onProgress) onProgress(allBooks.length);
    }

    return allBooks;
  }

  async getBooksForStats(
    onProgress?: (count: number) => void,
    checkCancellation?: () => boolean,
    opts?: { cache?: boolean },
  ): Promise<NotionBook[]> {
    // Same loop as queryAllBooks — one implementation, so library/Vinted scans
    // can also be cancelled during the Notion fetch phase.
    // `cache: true` shares a single fetch across successive scans
    // (e.g. both branches in „Skanuj wszystkie") — stats call without cache.
    if (opts?.cache && this.booksCache && this.booksCache.expiresAt > Date.now()) {
      return this.booksCache.data;
    }

    const books = await this.queryAllBooks(onProgress, checkCancellation);

    // Don't cache a list cut short by cancellation — it would be incomplete.
    const cancelled = checkCancellation ? checkCancellation() : false;
    if (opts?.cache && !cancelled) {
      this.booksCache = { data: books, expiresAt: Date.now() + BOOKS_CACHE_TTL_MS };
    }
    return books;
  }

  buildPropertyValue(value: string, type: string): any {
    if (!value) return null;
    if (type === "select") {
      return { select: { name: sanitizeNotionTag(value) } };
    } else if (type === "multi_select") {
      const tags = Array.from(new Set(
        value.split(',')
          .map(t => sanitizeNotionTag(t))
          .filter(t => t.length > 0)
      )).map(name => ({ name }));
      return { multi_select: tags };
    } else if (type === "title") {
      return { title: [{ text: { content: sanitizeNotionString(value) } }] };
    } else {
      return { rich_text: [{ text: { content: sanitizeNotionString(value) } }] };
    }
  }

  async updateBookPublisher(pageId: string, wydawnictwo: string, wydawnictwoPropType: string = "rich_text"): Promise<void> {
    const wydawnictwoPayload = this.buildPropertyValue(wydawnictwo, wydawnictwoPropType);

    await withRetry(() => this.notion.pages.update({
      page_id: pageId,
      properties: {
        "Wydawnictwo": wydawnictwoPayload
      }
    }));
    this.invalidateBooksCache();
  }

  async updateLp(pageId: string, lp: string): Promise<void> {
    await withRetry(() => this.notion.pages.update({
      page_id: pageId,
      properties: {
        "Lp": { title: [{ text: { content: lp } }] }
      }
    }));
    this.invalidateBooksCache();
  }

  /**
   * Shared core for mutating a multi_select field: fetches the current tags, passes them
   * through `transform` and writes the result. `transform` returns a new tag list or
   * `null` = no change (skip the write and cache invalidation). Add/remove are thin
   * cases on top of this core — one place for retrieve→mutate→update.
   */
  private async mutateMultiSelect(
    pageId: string,
    propertyName: string,
    transform: (current: { name: string }[]) => { name: string }[] | null,
  ): Promise<void> {
    await this.init();

    const page = await withRetry(() => this.notion.pages.retrieve({ page_id: pageId })) as any;
    const prop = page.properties[propertyName];
    if (!prop || prop.type !== "multi_select") {
      throw new Error(`Property ${propertyName} is not a multi_select`);
    }

    const currentTags = prop.multi_select.map((t: any) => ({ name: t.name }));
    const nextTags = transform(currentTags);
    if (nextTags === null) return; // no-op: tag already present / was absent

    await withRetry(() => this.notion.pages.update({
      page_id: pageId,
      properties: { [propertyName]: { multi_select: nextTags } },
    }));
    this.invalidateBooksCache();
  }

  /** Appends a tag to a multi_select field (skips if already present). */
  async addTagToMultiSelect(pageId: string, propertyName: string, tag: string): Promise<void> {
    return this.mutateMultiSelect(pageId, propertyName, (tags) =>
      tags.some((t) => t.name === tag) ? null : [...tags, { name: tag }]);
  }

  /** Removes a tag from a multi_select field (inverse of `addTagToMultiSelect`). */
  async removeTagFromMultiSelect(pageId: string, propertyName: string, tag: string): Promise<void> {
    return this.mutateMultiSelect(pageId, propertyName, (tags) => {
      const next = tags.filter((t) => t.name !== tag);
      return next.length === tags.length ? null : next;
    });
  }

  async resolveDataSourceId(databaseId: string): Promise<string> {
    await this.init();
    return this.actualDataSourceId!;
  }

  async retrieveDataSource(dataSourceId: string): Promise<any> {
    await this.init();
    return this.retrieveSource(dataSourceId);
  }

  async updateDatabaseProperty(databaseId: string, propertyName: string, propertyType: string): Promise<void> {
    await this.init();
    await this.updateSource(databaseId, { [propertyName]: { [propertyType]: {} } });
  }

  async renameProperty(databaseId: string, oldName: string, newName: string): Promise<void> {
    await this.init();
    await this.updateSource(databaseId, { [oldName]: { name: newName } });
  }

  async updatePage(pageId: string, properties: any): Promise<void> {
    await withRetry(() => this.notion.pages.update({
      page_id: pageId,
      properties
    }));
    this.invalidateBooksCache();
  }

  /**
   * Writes the stored Vinted results blob to the „VintedData" field (rich_text). The text
   * is split into segments ≤2000 chars (Notion's limit) — the mapper joins them back
   * with `join("")`. Does NOT use `buildPropertyValue` (it truncates to 2000 and would corrupt the JSON).
   */
  async saveVintedData(pageId: string, text: string): Promise<void> {
    const chunks: { text: { content: string } }[] = [];
    for (let i = 0; i < text.length; i += 2000) {
      chunks.push({ text: { content: text.slice(i, i + 2000) } });
    }
    if (chunks.length === 0) chunks.push({ text: { content: "" } });
    await withRetry(() => this.notion.pages.update({
      page_id: pageId,
      properties: { "VintedData": { rich_text: chunks } },
    }));
    this.invalidateBooksCache();
  }

  async addRow(properties: any): Promise<any> {
    await this.init();
    const parent = this.isDataSource
      ? { type: "data_source_id", data_source_id: this.actualDataSourceId! }
      : { type: "database_id", database_id: this.actualDataSourceId! };

    // idempotent=false: pages.create creates a new row — after a network/5xx error
    // a retry could duplicate the book (socket reset error after the write).
    // 429 is still retried (request rejected before processing).
    const response = await withRetry(() => this.notion.pages.create({
      parent: parent,
      properties
    } as any), 3, 1000, 2, false);
    this.invalidateBooksCache();
    return response;
  }
}
