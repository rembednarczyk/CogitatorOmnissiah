# Library Availability Check Algorithm (server.ts)

## 1. Overview
Scrapes the OPAC (Online Public Access Catalog) of the Municipal Public Library in Lublin (MBP Lublin) to check the availability of books in specific branches.

## 2. Scraping Logic (`checkLibraryAvailability`)
- **Source**: `https://opac.mbp.lublin.pl/search/description?q={title}&index=1&scope=full&f2%5B0%5D={libraryCode}`.
- **Target**: Books in Notion that are NOT marked as "Przeczytane", "Biblioteka", "Biblioteka 9", or "Posiadam".
- **Parsing Strategy**:
  - Fetches the HTML content of the search results page.
  - **Availability Check**:
    - If the HTML contains "Brak wyników" or "Nie znaleziono", the book is marked as unavailable.
    - If the HTML contains `class="record"` or "Szczegóły", the book is considered potentially available.
  - **Title Extraction**:
    - Uses a regex to extract the title from the OPAC page: `<dt[^>]*>\s*Tytuł:\s*<\/dt>\s*<dd[^>]*>\s*<span[^>]*>(.*?)<\/span>/i`.
    - This helps verify if the search result actually matches the book being checked.

## 3. Reliability & Performance
- **Retry Pattern**: Uses `withRetry` (3 attempts, 2000ms delay) to handle network timeouts or temporary OPAC unavailability.
- **Concurrency**: Sequential — one book at a time. The scan is fail-fast on network errors to surface problems early rather than hammering the OPAC.
- **Throttling**: Adds a 500ms delay between requests to ensure a steady, non-aggressive scraping pace.
- **Timeout**: The keep-alive `https.Agent` uses a 45 000 ms socket timeout.
- **Input safety**: `libraryCode` is URL-encoded before being interpolated into the OPAC query.

## 4. Implementation Details
- **HTTPS Agent**: A keep-alive `https.Agent` with normal TLS verification (both OPAC and the app use valid certificates).
- **Progress Reporting**: Sends SSE events for each book being checked, including the current progress (e.g., "Sprawdzanie: Tytuł (5/100)").
- **Output**: Returns a list of available books with their extracted titles and authors.
