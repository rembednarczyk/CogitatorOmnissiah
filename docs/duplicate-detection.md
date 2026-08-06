# Duplicate Detection & Management Algorithm (DuplicateSyncService)

## 1. Overview
Identifies potential duplicate records in the Notion database based on title and author similarity. It provides a summary of findings for manual or automated resolution.

## 2. Detection Logic (`runDuplicateCheck`)
- **Source**: All records from the Notion database.
- **Comparison Strategy**: $O(n^2)$ comparison of all book pairs.
- **Signals**:
  - **Exact Match (PL/Orig Title)**: `Lower(TitleA) === Lower(TitleB)`.
  - **High Similarity (PL/Orig Title)**: `calculateSimilarity(TitleA, TitleB) > 0.9`.
  - **Common Words + Same Author**:
    - Same author (similarity > 0.85).
    - At least 2 common significant words in the original or Polish title.
  - **Common Words (Orig/PL Title)**: At least 2 common significant words (even if authors differ).
- **Exclusions**:
  - Pairs with clearly different authors (similarity < 0.5) are skipped to avoid false positives from common titles.
  - Records with missing both Polish and original titles are ignored.

## 3. Similarity Algorithm (`calculateSimilarity`)
- **Method**: Levenshtein distance.
- **Normalization**: Similarity = (LongerLength - Distance) / LongerLength.
- **Range**: 0.0 (completely different) to 1.0 (identical).

## 4. Word Counting (`countCommonWords`)
- **Stop Words**: Ignores common Polish/English prepositions/conjunctions (e.g., "w", "na", "the", "of").
- **Significant Words**: Only words with length > 2 are considered.
- **Matching**: Case-insensitive set intersection.

## 5. Implementation Details
- **Batching**: Processes in batches to avoid blocking the event loop.
- **Progress Reporting**: Sends SSE events for status, progress, and completion.
- **Output**: Returns a list of duplicate pairs with the specific detection reason (e.g., "identyczny tytuł PL", "dopasowanie słów + ten sam autor").
