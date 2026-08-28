# Schema Validation & Initialization Algorithm (SchemaValidationService)

## 1. Overview
Ensures the Notion database has the correct structure (columns and types) required for synchronization.

## 2. Validation Logic (`runSchemaValidation`)
- **Source**: Notion database metadata.
- **Required Properties** (source of truth: `requiredProps` in `services/schemaValidationService.ts`):
  - `Lp`: `title` (Primary column)
  - `Autor`: `multi_select`
  - `Rok`: `multi_select`
  - `Tytuł polski`: `rich_text`
  - `Tytuł oryginalny`: `rich_text`
  - `Wydawnictwo`: `multi_select`
  - `Seria`: `multi_select`
  - `Nagroda`: `multi_select`
  - `Źródło`: `multi_select` (read/ownership/library tags)
  - `Data przeczytania`: `date` (stamped on „Przeczytane", cleared on unmark; feeds reading-velocity stats)
  - `Część cyklu`: `checkbox`
  - `Kategoria`: `select` (row category: „Tom cyklu" vs award)
  - `Cykl`: `rich_text` · `CyklNr`: `number` (cycle grouping)
  - `VintedData`: `rich_text` (stored Vinted results blob)
  - `ShelfOrder`: `number` (manual shelf ordering)
  - `ISBN`: `rich_text` (canonical ISBN-13s from the enrichment ritual)

## 3. Initialization Steps
- **Primary Column Renaming**:
  - If the primary column (type `title`) is NOT named "Lp", it's renamed to "Lp".
- **Column Creation**:
  - If a required column is missing, it's created with the correct type.
- **Type Correction**:
  - If a column exists but has the wrong type, it's updated to the correct type.
  - **Note**: This may result in data loss if the types are incompatible (e.g., `text` to `checkbox`).

## 4. Implementation Details
- **Notion API**: Uses `updateDatabaseProperty` and `renameProperty` to modify the database schema.
- **Database Resolution**: The adapter resolves the effective data source at `init()` (data-source vs. classic database); the schema-management methods (`retrieveDataSource`/`updateDatabaseProperty`/`renameProperty`) target that resolved source directly — the service no longer passes an id.
- **Progress Reporting**: Sends SSE events for each schema modification.
- **Output**: Returns a summary of which columns were added or updated.
