# Data Purification Algorithm (PurificationService)

## 1. Overview
Strips Wiki formatting and native Notion rich text formatting from book titles in the Notion database to ensure a clean and consistent data presentation.

## 2. Purification Logic (`runPurification`)
- **Source**: All records from the Notion database.
- **Target Fields**: "Tytuł polski" and "Tytuł oryginalny".
- **Wiki Formatting Removal (`stripWikiFormatting`)**:
  - Removes wiki italics/bold (`''+`).
  - Removes wiki links `[[Page|Text]]` -> `Text`.
  - Normalizes spaces and trims.
- **Notion Native Formatting Removal**:
  - Scans the `rich_text` array for any `annotations` (italic, bold, strikethrough, underline, code).
  - If any formatting is found, it's removed by re-writing the text as a plain string.
- **Link Preservation**:
  - If a title has a link (either from a Wiki link or a Notion URL field), it's preserved during the purification process.

## 3. Implementation Details
- **Sanitization (`sanitizeNotionString`)**:
  - Removes control characters (e.g., `\x00-\x08`).
  - Normalizes multiple spaces to a single space.
  - Trims and limits the length to 2000 characters (Notion API limit).
- **Update Logic**:
  - Only updates the Notion record if a difference is detected between the original and the purified title.
- **Progress Reporting**: Sends SSE events for each book being purified.
- **Output**: Returns a summary of how many books were cleaned and any errors encountered.
