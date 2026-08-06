# Publisher & Series Synchronization Algorithm (PublisherSyncService, SeriesSyncService)

## 1. Overview
Extracts publisher and series information from individual book pages in the Archiwum Encyklopedii (Wiki) and updates the corresponding Notion records.

## 2. Extraction Logic (`WikiParser.extractPublisherAndSeries`)
- **Source**: Wikitext of individual book pages.
- **Priority 1**: `{{tabela wydania}}` (infowydanie).
  - Scans for `informacjaN` where N is the highest index (e.g., `informacja3` > `informacja1`).
  - This ensures the *latest* Polish edition's data is used.
  - Extracts `wydawca` and `seria` from the `{{infowydanie}}` template.
- **Priority 2 (Fallback)**: `{{Książka}}` template.
  - Used only if no valid `infowydanie` is found.
  - Extracts `wydawca` and `seria` fields.
- **Cleaning**:
  - Strips wiki links `[[Page|Text]]` -> `Text`.
  - Removes HTML tags and MediaWiki special syntax.

## 3. Normalization (`dataNormalizer`)
- **Publisher**: Maps common variants to a canonical name (e.g., "Zysk" -> "Zysk i S-ka", "Prószyński" -> "Prószyński i S-ka").
- **Series**: Removes parenthetical suffixes (e.g., "Kameleon (seria)" -> "Kameleon") and maps variants (e.g., "Klasyka SF" -> "Klasyka Science Fiction").

## 4. Update Logic
- **Bulk Fetching**: Uses `WikiAdapter.fetchPagesContentBulk` to fetch multiple pages in a single request (MediaWiki API limit: 50 pages).
- **Diff Engine**: Uses `DiffEngine.isMultiSelectEqual` to compare current Notion values with extracted ones.
  - Splits by comma, trims, sorts, and joins for a stable comparison.
- **Notion Update**: Only updates if a difference is detected.

## 5. Implementation Details
- **Memory Efficiency**: Processes books in batches to avoid large memory footprints.
- **Progress Reporting**: Sends SSE events for status, progress, and completion.
- **Error Handling**: Collects errors per book and reports them in the final summary.
