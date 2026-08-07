import { Client } from "@notionhq/client";
import { withRetry } from "./retry";
import { sanitizeNotionString, sanitizeNotionTag } from "./utils";
import { NotionPage, NotionBook } from "./src/types";
import { mapPageToBook } from "./notionMapper";

export class NotionAdapter {
  private notion: Client;
  private actualDataSourceId: string | null = null;
  private isDataSource: boolean = true;
  private initPromise: Promise<void> | null = null;

  constructor(apiKey: string, private databaseId: string) {
    this.notion = new Client({ auth: apiKey });
  }

  async init(): Promise<void> {
    if (this.actualDataSourceId) return; // Already initialized
    // Deduplikuj równoległe wywołania init() — jedna inicjalizacja w locie
    if (!this.initPromise) {
      this.initPromise = this.doInit().catch((err) => {
        this.initPromise = null; // pozwól spróbować ponownie po błędzie
        throw err;
      });
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      // Try as data_source first (withRetry nie ponawia 404 — tylko 429/5xx/sieć)
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
        // "Brak dostępu" tylko przy prawdziwym 404 — timeout to nie problem uprawnień
        if (dbError?.code === "object_not_found" || dbError?.status === 404) {
          throw new Error(`Nie można znaleźć bazy danych ani źródła danych o ID: ${this.databaseId}. Upewnij się, że integracja ma dostęp.`);
        }
        throw new Error(`Błąd połączenia z Notion podczas inicjalizacji: ${dbError?.message || dbError}`);
      }
    }
  }

  // --- Dual-mode helpers ---
  // Notion udostępnia bazę jako "data source" (nowe API) lub klasyczną "database".
  // Te trzy helpery kapsułkują rozgałęzienie isDataSource, które wcześniej było
  // powielone w ~7 metodach.

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
      // Zabezpieczenie: has_more === true bez kursora oznaczałoby ponowne pobranie
      // strony 1 od początku w kółko (i podwójne liczenie). Przerwij zamiast zawisnąć.
      if (hasMore && !nextCursor) break;
      if (onProgress) onProgress(allBooks.length);
    }

    return allBooks;
  }

  async getBooksForStats(onProgress?: (count: number) => void, checkCancellation?: () => boolean): Promise<NotionBook[]> {
    // Ta sama pętla co queryAllBooks — jedna implementacja, żeby skany
    // biblioteki/Vinted też dało się anulować w fazie pobierania z Notion
    return this.queryAllBooks(onProgress, checkCancellation);
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
  }

  async updateLp(pageId: string, lp: string): Promise<void> {
    await withRetry(() => this.notion.pages.update({
      page_id: pageId,
      properties: {
        "Lp": { title: [{ text: { content: lp } }] }
      }
    }));
  }

  async addTagToMultiSelect(pageId: string, propertyName: string, tag: string): Promise<void> {
    await this.init();
    
    // 1. Get current tags
    const page = await withRetry(() => this.notion.pages.retrieve({ page_id: pageId })) as any;
    const prop = page.properties[propertyName];
    
    if (!prop || prop.type !== "multi_select") {
      throw new Error(`Property ${propertyName} is not a multi_select`);
    }
    
    const currentTags = prop.multi_select.map((t: any) => ({ name: t.name }));
    
    // 2. Check if tag already exists
    if (currentTags.some((t: any) => t.name === tag)) {
      return; // Already has the tag
    }
    
    // 3. Add new tag
    currentTags.push({ name: tag });
    
    // 4. Update page
    await withRetry(() => this.notion.pages.update({
      page_id: pageId,
      properties: {
        [propertyName]: { multi_select: currentTags }
      }
    }));
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
  }

  async addRow(properties: any): Promise<any> {
    await this.init();
    const parent = this.isDataSource
      ? { type: "data_source_id", data_source_id: this.actualDataSourceId! }
      : { type: "database_id", database_id: this.actualDataSourceId! };

    // idempotent=false: pages.create tworzy nowy wiersz — po błędzie sieci/5xx
    // ponowienie mogłoby zdublować książkę (błąd resetu socketu po zapisie).
    // 429 nadal jest ponawiane (żądanie odrzucone przed przetworzeniem).
    const response = await withRetry(() => this.notion.pages.create({
      parent: parent,
      properties
    } as any), 3, 1000, 2, false);
    return response;
  }
}
