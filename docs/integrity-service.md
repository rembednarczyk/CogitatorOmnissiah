# Data Integrity & Sanctity Algorithm (IntegrityService)

## 1. Overview
Performs a comprehensive cross-reference check between the Notion database and the Archiwum Encyklopedii (Wiki) to ensure data "sanctity" and consistency.

> **Module layout.** `runIntegrityCheck` is a ~45-line orchestrator (fetch Notion + wiki → run checks → assemble result). Each check is a focused private method — `checkLpUniqueness`, `checkTitleDuplicates` (shared by original/Polish via a selector), `computeYearDiffs`, `computeAwardDiffs` — plus `robustKey` and a `mergeBooksByKey` helper shared by the Notion/wiki sides.

## 2. Verification Logic (`runIntegrityCheck`)
- **Source**: All records from Notion and all predefined award pages from Wiki (Hugo, Nebula, Locus).
- **Matching Strategy**:
  - Uses a "Robust Key": `Lower(NormalizedTitle|NormalizedAuthor)`.
  - Normalizes titles by removing punctuation and extra spaces.
  - Normalizes authors using `dataNormalizer`.

## 3. Specific Checks
- **Lp Uniqueness**:
  - Scans for duplicate "Lp" values in Notion.
- **Title Uniqueness (per Author)**:
  - Scans for duplicate Polish or Original titles for the same author in Notion.
- **Book Count per Year**:
  - Compares the number of books per year in Notion vs. Wiki.
  - **Exclusion**: Ignores "Locus YA" (Powieść dla młodzieży) category as it's not tracked in the main database.
  - **Misplaced Detection**: Identifies books that exist in both databases but have different years.
  - **Notion Only / Wiki Only**: Lists books that are missing from one of the databases for a specific year.
  - **Collisions**: Identifies same-book candidates across years via robust-key set intersection (normalized `title|author` keys shared between entries).
- **Award Count Match**:
  - Compares the count of books for each award (Hugo, Nebula, Locus) in Notion vs. Wiki.
  - Identifies specific books that are missing the award tag in Notion.

## 4. Implementation Details
- **Robust Matching**: Handles minor title variations (e.g., "The Mule" vs "Mule") by stripping punctuation and normalizing spaces.
- **Output**: Returns a detailed `IntegrityCheckResult` object with status (boolean) and a list of specific discrepancies for each check.
