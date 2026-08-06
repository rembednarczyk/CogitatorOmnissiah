import { Client } from "@notionhq/client";
import { withRetry } from "./retry";
import { sanitizeNotionString, sanitizeNotionTag } from "./utils";
import { NotionPage, NotionProperty, NotionPageProperties, NotionBook } from "./src/types";

export class NotionAdapter {
  private notion: Client;
  private actualDataSourceId: string | null = null;
  private isDataSource: boolean = true;

  constructor(apiKey: string, private databaseId: string) {
    this.notion = new Client({ auth: apiKey });
  }

  async init(): Promise<void> {
    if (this.actualDataSourceId) return; // Already initialized

    try {
      // Try as data_source first
      await (this.notion as any).dataSources.retrieve({ data_source_id: this.databaseId });
      this.actualDataSourceId = this.databaseId;
      this.isDataSource = true;
    } catch (e: any) {
      // Fallback to database
      try {
        const database = await this.notion.databases.retrieve({ database_id: this.databaseId }) as any;
        if (database.data_sources && database.data_sources.length > 0) {
          this.actualDataSourceId = database.data_sources[0].id;
          this.isDataSource = true;
        } else {
          // It's a regular database
          this.actualDataSourceId = this.databaseId;
          this.isDataSource = false;
        }
      } catch (dbError: any) {
        throw new Error(`Nie można znaleźć bazy danych ani źródła danych o ID: ${this.databaseId}. Upewnij się, że integracja ma dostęp.`);
      }
    }
  }

  async getSchema(): Promise<any> {
    await this.init();
    if (this.isDataSource) {
      const dataSource = await withRetry(() => (this.notion as any).dataSources.retrieve({
        data_source_id: this.actualDataSourceId!,
      }));
      return (dataSource as any).properties;
    } else {
      const database = await withRetry(() => this.notion.databases.retrieve({
        database_id: this.actualDataSourceId!,
      }));
      return (database as any).properties;
    }
  }

  async updateSchema(propertyName: string, propertyType: string, newOptions: any): Promise<void> {
    await this.init();
    const propertiesPayload: any = {
      [propertyName]: {
        [propertyType]: {
          options: newOptions
        }
      }
    };

    if (this.isDataSource) {
      await withRetry(() => (this.notion as any).dataSources.update({
        data_source_id: this.actualDataSourceId!,
        properties: propertiesPayload
      }));
    } else {
      await withRetry(() => this.notion.databases.update({
        database_id: this.actualDataSourceId!,
        properties: propertiesPayload
      } as any));
    }
  }

  async createColumnIfNeeded(columnName: string, type: string = "rich_text"): Promise<void> {
    await this.init();
    const schema = await this.getSchema();
    if (!schema[columnName]) {
      if (this.isDataSource) {
        await withRetry(() => (this.notion as any).dataSources.update({
          data_source_id: this.actualDataSourceId!,
          properties: {
            [columnName]: { [type]: {} }
          }
        }));
      } else {
        await withRetry(() => this.notion.databases.update({
          database_id: this.actualDataSourceId!,
          properties: {
            [columnName]: { [type]: {} }
          }
        } as any));
      }
    }
  }

  private getProp(props: NotionPageProperties, name: string): NotionProperty | undefined {
    if (props[name]) return props[name];
    const lowerName = name.toLowerCase();
    for (const key in props) {
      if (key.toLowerCase() === lowerName) return props[key];
    }
    return undefined;
  }

  private getPlainText(prop?: NotionProperty): string {
    if (!prop) return "";
    const type = prop.type;
    if (type === "title") return prop.title?.map((t) => t.plain_text).join("") || "";
    if (type === "rich_text") return prop.rich_text?.map((t) => t.plain_text).join("") || "";
    if (type === "number") return prop.number !== undefined && prop.number !== null ? prop.number.toString() : "";
    if (type === "select") return prop.select?.name || "";
    if (type === "multi_select") return prop.multi_select?.map((x) => x.name).join(", ") || "";
    if (type === "checkbox") return prop.checkbox?.toString() || "";
    if (type === "url") return prop.url || "";
    return "";
  }

  private parseNotionPageToBook(page: NotionPage): NotionBook {
    const props = page.properties;
    
    const plTitle = this.getPlainText(this.getProp(props, "Tytuł polski"));
    const origTitle = this.getPlainText(this.getProp(props, "Tytuł oryginalny"));
    const author = this.getPlainText(this.getProp(props, "Autor"));
    
    const plTitleProp = this.getProp(props, "Tytuł polski");
    const origTitleProp = this.getProp(props, "Tytuł oryginalny");
    const plTitleRichText = plTitleProp?.type === "title" ? plTitleProp.title : plTitleProp?.rich_text || [];
    const origTitleRichText = origTitleProp?.type === "title" ? origTitleProp.title : origTitleProp?.rich_text || [];

    const yearProp = this.getProp(props, "Rok");
    let year: string | undefined = undefined;
    if (yearProp) {
      if (yearProp.type === "multi_select") {
        year = yearProp.multi_select?.map((x) => x.name).join(", ");
      } else if (yearProp.type === "number") {
        year = yearProp.number !== undefined && yearProp.number !== null ? yearProp.number.toString() : undefined;
      } else {
        year = this.getPlainText(yearProp).trim() || undefined;
      }
    }

    const currentWydawnictwo = this.getPlainText(this.getProp(props, "Wydawnictwo"));
    const currentSeria = this.getPlainText(this.getProp(props, "Seria"));
    const currentCzesccyklu = this.getProp(props, "Część cyklu")?.checkbox || false;
    const lp = this.getPlainText(this.getProp(props, "Lp"));

    const nagrodaProp = this.getProp(props, "Nagroda");
    const awards = nagrodaProp?.type === "multi_select"
      ? nagrodaProp.multi_select?.map((x) => x.name) || []
      : (nagrodaProp?.type === "select" && nagrodaProp.select?.name ? [nagrodaProp.select.name] : []);

    const zrodloProp = this.getProp(props, "Źródło");
    const zrodlo = zrodloProp?.type === "multi_select" 
      ? zrodloProp.multi_select?.map((x) => x.name) || []
      : (zrodloProp?.type === "select" && zrodloProp.select?.name ? [zrodloProp.select.name] : []);

    return { 
      id: page.id, 
      plTitle, 
      origTitle, 
      author, 
      year, 
      currentWydawnictwo, 
      currentSeria, 
      currentCzesccyklu, 
      lp, 
      awards, 
      zrodlo,
      plTitleRichText, 
      origTitleRichText 
    };
  }

  async queryAllBooks(onProgress?: (count: number) => void, checkCancellation?: () => boolean): Promise<NotionBook[]> {
    await this.init();
    const allBooks: NotionBook[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    while (hasMore) {
      if (checkCancellation && checkCancellation()) break;
      
      let response;
      if (this.isDataSource) {
        response = await withRetry(() => (this.notion as any).dataSources.query({
          data_source_id: this.actualDataSourceId!,
          start_cursor: nextCursor,
        }));
      } else {
        response = await withRetry(() => (this.notion.databases as any).query({
          database_id: this.actualDataSourceId!,
          start_cursor: nextCursor,
        }));
      }

      for (const page of response.results) {
        allBooks.push(this.parseNotionPageToBook(page as NotionPage));
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor ?? undefined;
      if (onProgress) onProgress(allBooks.length);
    }

    return allBooks;
  }

  async getBooksForStats(onProgress?: (count: number) => void): Promise<NotionBook[]> {
    await this.init();
    const allBooks: NotionBook[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    while (hasMore) {
      let response;
      if (this.isDataSource) {
        response = await withRetry(() => (this.notion as any).dataSources.query({
          data_source_id: this.actualDataSourceId!,
          start_cursor: nextCursor,
        }));
      } else {
        response = await withRetry(() => (this.notion.databases as any).query({
          database_id: this.actualDataSourceId!,
          start_cursor: nextCursor,
        }));
      }

      for (const page of response.results) {
        allBooks.push(this.parseNotionPageToBook(page as NotionPage));
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor ?? undefined;
      if (onProgress) onProgress(allBooks.length);
    }

    return allBooks;
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
    if (this.isDataSource) {
      return await withRetry(() => (this.notion as any).dataSources.retrieve({ data_source_id: dataSourceId }));
    } else {
      return await withRetry(() => this.notion.databases.retrieve({ database_id: dataSourceId }));
    }
  }

  async updateDatabaseProperty(databaseId: string, propertyName: string, propertyType: string): Promise<void> {
    await this.init();
    const propertiesPayload = {
      [propertyName]: { [propertyType]: {} }
    };
    if (this.isDataSource) {
      await withRetry(() => (this.notion as any).dataSources.update({
        data_source_id: databaseId,
        properties: propertiesPayload
      }));
    } else {
      await withRetry(() => this.notion.databases.update({
        database_id: databaseId,
        properties: propertiesPayload
      } as any));
    }
  }

  async renameProperty(databaseId: string, oldName: string, newName: string): Promise<void> {
    await this.init();
    const propertiesPayload = {
      [oldName]: { name: newName }
    };
    if (this.isDataSource) {
      await withRetry(() => (this.notion as any).dataSources.update({
        data_source_id: databaseId,
        properties: propertiesPayload
      }));
    } else {
      await withRetry(() => this.notion.databases.update({
        database_id: databaseId,
        properties: propertiesPayload
      } as any));
    }
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

    const response = await withRetry(() => this.notion.pages.create({
      parent: parent,
      properties
    } as any));
    return response;
  }
}
