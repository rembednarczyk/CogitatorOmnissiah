# Vinted Scanner (Market Search)

## 1. Overview
Searches **vinted.pl** for physical, second-hand copies of the tracked books. This is a direct HTML scraper — it fetches Vinted's catalog search page over HTTP and parses the response. **It does not use any AI / LLM.** (An earlier design intended a Gemini-based search; it was never implemented, and the `@google/genai` dependency and any `GEMINI_API_KEY` reference have been removed.)

## 2. Search Logic (`VintedSyncService.runVintedCheck` in `services/vintedSyncService.ts`)
- **Candidates**: Books from Notion that are NOT already read/owned (excludes the `Przeczytane`, `Biblioteka`, `Biblioteka 9`, `Posiadam` source tags), with a non-empty Polish title.
- **Search URL**: `https://www.vinted.pl/catalog?catalog[]=2319&language_book_ids[]=6440&page=1&order=price_low_to_high&price_from=2&currency=PLN&search_text={title author}` (books category, cheapest first).
- **Request shaping**: Rotates a realistic browser `User-Agent` and sends browser-like headers (`Referer`, `Sec-Fetch-*`, etc.) to reduce bot blocking.
- **Result parsing**: the scanner inspects the HTML for status markers and delegates item extraction to the pure `parseVintedItems(html, title, author)` in `services/vintedParser.ts` (unit-tested on captured HTML/JSON).
  - Bot/anti-scrape markers (`cloudflare`, `captcha`, "robot") → reported as `blocked`.
  - "Brak wyników" / "Nie znaleźliśmy żadnych przedmiotów" → `no_results`.
  - Otherwise `parseVintedItems` extracts up to 5 relevant listing items (title, price, currency, url) via four cascading paths: the `data-component-name="Catalog"` JSON blob, an `"items":[…]` regex with bracket matching, `feed-grid__item` blocks, then a global `href=/items/…` regex.

## 3. Reliability & Anti-Bot Pacing
- **Timeout**: 45 000 ms per request (via a keep-alive `https.Agent`).
- **Throttling**: 3–5 s delay (with jitter) between books — applied on **every** path, including the no-results case, to avoid the request bursts that trigger Cloudflare blocks.
- **429 handling**: On HTTP 429 waits ~5 s before continuing; 403 is surfaced as a Cloudflare block.
- **Cancellation**: Cooperative — checks the cancellation token each iteration and reports `cancelled: true` on the `complete` event when stopped.

## 4. Frontend Integration
- **Hook**: `useVintedCheck` opens the SSE stream and renders progress, per-book search attempts, and matched listings.
- **Trigger**: The "Skaner Artefaktów Vinted" section (Vinted tab).
- **Output**: A `search_attempt` event per book (status + item count) plus `match` events with the found listings.

## 5. Notes
- Vinted's markup and anti-bot behaviour change over time; treat the HTML parsing as best-effort and expect occasional `blocked` results from a datacenter IP.
