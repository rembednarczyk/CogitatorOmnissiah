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
- **Cycle criteria** (`checkCycleInWikitext`): the wikitext contains a non-empty `|cykl=` / `|cykle=` parameter (confirmed against a real `{{Książka}}` infobox raw: `| cykl = Childe`) or a cycle navigation template. The template regex is `\{\{\s*cykl[\s|}]` — it matches `{{Cykl|...}}`, a bare `{{Cykl}}`, and `{{Cykl nawigacja|...}}`, while still rejecting unrelated names like `{{Cyklista}}` (a boundary char — whitespace, pipe or `}` — must follow "cykl"). `|seria=` is deliberately ignored: on the Encyclopedia it's the publisher imprint (e.g. "Kanon science fiction"), not a story cycle, so counting it would produce false positives.
- **Action**: Sets the **"Część cyklu"** checkbox to match the detection result (both directions).

## 3. Implementation Details
- **Comparison**: Only updates the Notion record if the current checkbox value differs from the expected one.
- **Concurrency**: Uses `p-limit(3)` to throttle Notion API calls.
- **Honest skip reporting**: A book is only *evaluated* when a page passes the author gate. Previously, a book whose page couldn't be found (title mismatch) or whose author didn't match was `return`-ed silently — the run reported success and the user had no idea it wasn't checked (the root cause behind "cycle marking sometimes misses"). Now every un-evaluated book is recorded in `summary.skipped` with a reason (`nie znaleziono strony` vs `autor się nie zgadza — strona pominięta`), and the `complete` result carries `cyclesDetected` (how many books were positively detected) and `skipped` (count). The UI renders the skipped list in `SyncSummaryResult` so the gaps are visible and diagnosable — a book missing from `skipped` but still unmarked points at the marker/wikitext, not at coverage.
- **Failure reporting**: Titles that failed to fetch in bulk are listed in the result's `errors`; per-book fetch failures are recorded per title.
- **Neighbor-volume hint**: the same `{{Książka}}` infobox also carries `|poprzednia=` / `|następna=` (previous/next volume titles) alongside `|cykl=` — a ready-made prev/next chain for the future "cykl: sąsiednie tomy" feature (see `backlog.md`).
- **Progress Reporting**: Sends SSE events for each batch of books being processed.
- **Output**: Returns a summary of how many books were updated and any errors encountered, with `success: false` when the run was cancelled.
