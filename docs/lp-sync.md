# Lp (Position) Synchronization Algorithm (LpSyncService)

## 1. Overview
Re-numbers the "Lp" column in the Notion database based on a specific sorting order (Year, then Title).

## 2. Sorting Logic (`runLpSync`)
- **Source**: All records from the Notion database.
- **Filter**: Only books with a non-empty Polish title, original title, or author are considered.
- **Sorting Criteria**:
  - **Primary**: Year (ascending).
  - **Secondary**: Polish Title (or Original Title if Polish is missing) (alphabetical).
- **Year Handling**:
  - Parses the first year from the multi-select string (e.g., "1990, 1991" -> 1990).
  - Default year for sorting missing values is 0.

## 3. Re-numbering Logic
- **Expected Lp**: The book's index in the sorted list + 1.
- **Update Logic**: Only updates the Notion record if the current "Lp" value differs from the expected one.

## 4. Implementation Details
- **Concurrency**: Uses `p-limit(3)` to throttle Notion API calls.
- **Progress Reporting**: Sends SSE events for each book being re-numbered.
- **Output**: Returns a summary of how many books were re-numbered and any errors encountered.
