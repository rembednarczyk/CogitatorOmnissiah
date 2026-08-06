# Book Synchronization Algorithm (BookSyncService)

## 1. Overview
Synchronizes book data from MediaWiki award tables (Hugo, Nebula, Locus) to a Notion database. It handles extraction, merging, and duplicate detection.

## 2. Extraction Logic (`fetchBooksFromMediaWiki`)
- **Source**: MediaWiki wikitext of award pages.
- **Parsing Strategy**:
  - Splits wikitext into rows using `|-`.
  - Identifies column mapping (Year, Author, Original Title, Polish Title) by looking for header keywords.
  - **Year Handling**: Remembers the last encountered year to fill empty year cells in subsequent rows.
  - **Cell Cleaning**:
    - Removes table attributes (e.g., `rowspan`, `style`).
    - Strips wiki links `[[Page|Text]]` -> `Text`.
    - Extracts links for Polish titles to use as Notion URLs.
    - Handles special cases like "Nagroda Locus": only the "Powieść dla młodzieży" (YA) category is excluded. All other Locus categories — Powieść, Powieść SF, Powieść fantasy, Pierwsza powieść, and Horror/Dark Fantasy — are intentionally included and tagged "Nagroda Locus".
- **Normalization**: Original titles and authors are normalized using `dataNormalizer`.

## 3. Comparison & Update Logic (`compareBooks`)
- **Comparison**: Performs field-by-field comparisons of sanitized values, ensuring updates are only made when meaningful changes occur.
- **Polish Title**: Updates if the Wiki title differs from Notion. Preserves existing links if valid.
- **Original Title**: Fills if empty in Notion.
- **Author**: Merges authors as a union of Notion and Wiki values (never removes authors added manually in Notion), ensuring a unique list (max 100). Normalizes names (e.g., "Liu Cixin" -> "Liu Cixin, Ken Liu").
- **Awards**: Combines existing awards with new ones. Automatically adds "Wszystkie" tag if Hugo, Nebula, and Locus are all present.
- **Year**: Appends new years to the multi-select list.

## 4. Duplicate Detection (In-Sync)
- **Primary Key**: `Lower(Title|Author)`.
- **Fuzzy Matching**:
  - If no exact match is found, it scans the existing Notion database.
  - **Criteria**: Same author (similarity > 0.85) AND at least 2 common significant words in the original title.
  - **Stop Words**: Common Polish/English prepositions/conjunctions are ignored during word counting.

## 5. Implementation Details
- **Concurrency**: Uses `p-limit` to throttle Notion API calls.
- **Cancellation**: Checks a cancellation token before every major operation.
- **Progress Reporting**: Sends SSE events for status, progress, and completion.
