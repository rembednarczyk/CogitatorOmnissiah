# Book Cycles Detection Algorithm (CyclesSyncService)

## 1. Overview
Automatically identifies and marks books that belong to a literary cycle or series in the Notion database.

## 2. Detection Logic (`runCyclesCheck`)
- **Source**: All records from the Notion database.
- **Criteria**:
  - A book is considered part of a cycle if it has a non-empty value in the **"Seria"** column.
- **Action**:
  - Sets the **"Część cyklu"** checkbox to `true` if a series is present.
  - Sets it to `false` if the series column is empty.

## 3. Implementation Details
- **Comparison**: Only updates the Notion record if the current checkbox value differs from the expected one.
- **Concurrency**: Uses `p-limit(3)` to throttle Notion API calls.
- **Progress Reporting**: Sends SSE events for each book being processed.
- **Output**: Returns a summary of how many books were updated and any errors encountered.
