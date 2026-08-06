# Statistics Generation Algorithm (StatsService)

## 1. Overview
Generates comprehensive statistics for the dashboard by aggregating data from the Notion database.

## 2. Aggregation Logic (`getStats`)
- **Source**: All records from the Notion database.
- **Global Filter**: Only books with a non-empty Polish title are considered.
- **Author Progress**:
  - Splits authors by comma and trims.
  - Counts total books per author and how many are marked as "Przeczytane".
  - Sorts authors by "Read" count and returns the top 15.
- **Award Books Progress**:
  - Counts total books and how many are marked as "Przeczytane".
- **Owned but Unread**:
  - Filters books marked as "Posiadam" but NOT "Przeczytane".
  - Sorts by year (earliest first).
- **Award Coverage Progress**:
  - Counts how many books have each specific award tag (e.g., Hugo, Nebula, Locus).
- **"All" Awards Progress**:
  - Specifically tracks books with the "Wszystkie" tag (Hugo + Nebula + Locus).
- **Yearly Progress**:
  - Groups books by year and counts "Read" vs. "Total".
  - Sorts by year (chronological).
- **Library Stats**:
  - Specifically tracks books marked as "Biblioteka" (Felin) and "Biblioteka 9" (Bronowice).

## 3. Implementation Details
- **Sorting**:
  - Year sorting handles multi-year strings (e.g., "1990, 1991") by taking the first year.
  - Default year for sorting missing values is "9999".
- **Memory Efficiency**: Aggregates data in-memory after a single Notion query.
- **Output**: Returns a structured JSON object with all statistics ready for the dashboard.
