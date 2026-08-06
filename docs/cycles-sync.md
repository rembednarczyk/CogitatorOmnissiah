# Book Cycles Detection Algorithm (CyclesSyncService)

## 1. Overview
Automatically identifies and marks books that belong to a literary cycle in the Notion database, based on the book's page in the "Archiwum Encyklopedii Fantastyki".

## 2. Detection Logic (`runCyclesSync`)
- **Source**: All records from the Notion database + wiki page content for each book.
- **Page lookup** (in priority order):
  1. **Bulk Fetch**: Polish and original titles are fetched in batches via `fetchPagesContentBulk`.
  2. **Multi-Search (PL)**: If not found, searches the wiki for `"{polish title} {author}"` (top 3 results).
  3. **Multi-Search (Orig)**: Same for the original title.
  4. **Direct Fetch**: Last-resort exact-title fetch of the Polish title.
- **Author verification**: Every candidate page is validated with `isWikiAuthorMatch` (shared helper in `dataNormalizer`) — normalized author comparison with substring and similarity (> 0.6) matching — to avoid reading data from a same-titled page about a different work. Pages are accepted when either side lacks an author.
- **Cycle criteria** (`checkCycleInWikitext`): the wikitext contains a non-empty `|cykl=` / `|cykle=` parameter or a `{{Cykl|...}}` template. `|seria=` is deliberately ignored to avoid false positives.
- **Action**: Sets the **"Część cyklu"** checkbox to match the detection result (both directions).

## 3. Implementation Details
- **Comparison**: Only updates the Notion record if the current checkbox value differs from the expected one.
- **Concurrency**: Uses `p-limit(3)` to throttle Notion API calls.
- **Failure reporting**: Titles that failed to fetch in bulk are listed in the result's `errors`; per-book fetch failures are recorded per title.
- **Progress Reporting**: Sends SSE events for each batch of books being processed.
- **Output**: Returns a summary of how many books were updated and any errors encountered, with `success: false` when the run was cancelled.
