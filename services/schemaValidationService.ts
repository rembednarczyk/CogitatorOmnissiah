import { NotionAdapter } from "../notion.adapter";
import { SyncEvent } from "../src/types";

export class SchemaValidationService {
  constructor(private notion: NotionAdapter) {}

  async runSchemaValidation(sendEvent: (data: SyncEvent) => void, checkCancellation: () => boolean) {
    try {
      sendEvent({ type: "status", message: "Inicjalizacja bazy Notion..." });
      await this.notion.init();

      const databaseId = process.env.NOTION_DATABASE_ID;
      if (!databaseId) throw new Error("Brak NOTION_DATABASE_ID w zmiennych środowiskowych.");
      
      const actualDataSourceId = await this.notion.resolveDataSourceId(databaseId);

      sendEvent({ type: "status", message: "Pobieranie schematu bazy..." });
      const db = await this.notion.retrieveDataSource(actualDataSourceId) as any;

      if (checkCancellation()) {
        sendEvent({ type: "status", message: "Przerwano inicjalizację schematu." });
        return;
      }

      const requiredProps = [
        { name: "Lp", type: "title" },
        { name: "Autor", type: "multi_select" },
        { name: "Rok", type: "multi_select" },
        { name: "Tytuł polski", type: "rich_text" },
        { name: "Tytuł oryginalny", type: "rich_text" },
        { name: "Wydawnictwo", type: "multi_select" },
        { name: "Seria", type: "multi_select" },
        { name: "Nagroda", type: "multi_select" },
        { name: "Źródło", type: "multi_select" },
        { name: "Część cyklu", type: "checkbox" },
        // Kolumny cykli (tomy jako wiersze) — dotąd tworzone leniwie przez Rytuał Żniw.
        { name: "Kategoria", type: "select" },
        { name: "Cykl", type: "rich_text" },
        { name: "CyklNr", type: "number" },
        // Domknięcie starego długu — dotąd tworzone leniwie przez skaner/regał.
        { name: "VintedData", type: "rich_text" },
        { name: "ShelfOrder", type: "number" }
      ];

      // 1. Handle primary (title) column renaming if necessary
      const titleProp = Object.values(db.properties).find((p: any) => p.type === "title") as any;
      if (titleProp && titleProp.name !== "Lp") {
        sendEvent({ type: "status", message: `Zmiana nazwy głównej kolumny z ${titleProp.name} na Lp...` });
        await this.notion.renameProperty(actualDataSourceId, titleProp.name, "Lp");
        // Refresh db properties after rename
        const updatedDb = await this.notion.retrieveDataSource(actualDataSourceId) as any;
        db.properties = updatedDb.properties;
      }

      let addedCount = 0;
      const summary = { added: [] as string[] };

      for (const prop of requiredProps) {
        if (checkCancellation()) break;
        
        // Skip title as it's already handled by renaming
        if (prop.type === "title") continue;

        const existingProp = db.properties[prop.name];
        if (!existingProp) {
          sendEvent({ type: "status", message: `Tworzenie brakującej kolumny: ${prop.name}...` });
          await this.notion.updateDatabaseProperty(actualDataSourceId, prop.name, prop.type);
          addedCount++;
          summary.added.push(prop.name);
        } else if (existingProp.type !== prop.type) {
          sendEvent({ type: "status", message: `Aktualizacja typu kolumny ${prop.name} z ${existingProp.type} na ${prop.type}...` });
          await this.notion.updateDatabaseProperty(actualDataSourceId, prop.name, prop.type);
          addedCount++;
          summary.added.push(`${prop.name} (zmiana typu)`);
        }
      }

      sendEvent({
        type: "complete",
        result: {
          found: requiredProps.length,
          synced: addedCount,
          updated: 0,
          summary: { added: summary.added },
          errors: []
        }
      });
    } catch (error: any) {
      sendEvent({ type: "error", error: error.message });
    }
  }
}
