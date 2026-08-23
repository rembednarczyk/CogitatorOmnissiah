import { Client } from "@notionhq/client";
import { withRetry } from "./retry";
import { sanitizeNotionString, sanitizeNotionTag } from "./utils";
import { NotionPage, NotionBook } from "./src/types";
import { mapPageToBook } from "./notionMapper";

// Krótki cache pełnej listy książek dla ścieżek TYLKO-DO-ODCZYTU skanerów
// (biblioteka „Skanuj wszystkie" odpytywałaby Notion raz na filię). Cache jest
// opt-in (`{ cache: true }`), więc statystyki (`/api/stats`) zawsze czytają
// świeże dane, a każdy zapis książki go unieważnia. TTL to tylko bezpiecznik na
// edycje spoza aplikacji.
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

  /** Unieważnia cache listy książek — wołane po każdym zapisie zmieniającym książki. */
  private invalidateBooksCache(): void {
    this.booksCache = null;
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

  async getBooksForStats(
    onProgress?: (count: number) => void,
    checkCancellation?: () => boolean,
    opts?: { cache?: boolean },
  ): Promise<NotionBook[]> {
    // Ta sama pętla co queryAllBooks — jedna implementacja, żeby skany
    // biblioteki/Vinted też dało się anulować w fazie pobierania z Notion.
    // `cache: true` współdzieli jedno pobranie między kolejnymi skanami
    // (np. obie filie w „Skanuj wszystkie") — statystyki wołają bez cache.
    if (opts?.cache && this.booksCache && this.booksCache.expiresAt > Date.now()) {
      return this.booksCache.data;
    }

    const books = await this.queryAllBooks(onProgress, checkCancellation);

    // Nie zapisuj listy urwanej przez anulowanie — byłaby niepełna.
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
   * Wspólny rdzeń mutacji pola multi_select: pobiera aktualne tagi, przepuszcza je
   * przez `transform` i zapisuje wynik. `transform` zwraca nową listę tagów albo
   * `null` = brak zmiany (pomiń zapis i inwalidację cache). Add/remove to cienkie
   * przypadki na tym rdzeniu — jedno miejsce na retrieve→mutate→update.
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
    if (nextTags === null) return; // no-op: tag już jest / nie było

    await withRetry(() => this.notion.pages.update({
      page_id: pageId,
      properties: { [propertyName]: { multi_select: nextTags } },
    }));
    this.invalidateBooksCache();
  }

  /** Dopisuje znacznik do pola multi_select (pomija, jeśli już jest). */
  async addTagToMultiSelect(pageId: string, propertyName: string, tag: string): Promise<void> {
    return this.mutateMultiSelect(pageId, propertyName, (tags) =>
      tags.some((t) => t.name === tag) ? null : [...tags, { name: tag }]);
  }

  /** Usuwa znacznik z pola multi_select (odwrotność `addTagToMultiSelect`). */
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
   * Zapis blobu składowanych wyników Vinted do pola „VintedData" (rich_text). Tekst
   * dzielony na segmenty ≤2000 znaków (limit Notion) — mapper skleja je z powrotem
   * przez `join("")`. NIE używa `buildPropertyValue` (obcina do 2000 i psułoby JSON).
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

    // idempotent=false: pages.create tworzy nowy wiersz — po błędzie sieci/5xx
    // ponowienie mogłoby zdublować książkę (błąd resetu socketu po zapisie).
    // 429 nadal jest ponawiane (żądanie odrzucone przed przetworzeniem).
    const response = await withRetry(() => this.notion.pages.create({
      parent: parent,
      properties
    } as any), 3, 1000, 2, false);
    this.invalidateBooksCache();
    return response;
  }
}
