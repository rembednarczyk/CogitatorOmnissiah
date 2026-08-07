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
  - Otherwise `parseVintedItems` extracts up to 5 relevant listing items via four cascading paths: the `data-component-name="Catalog"` JSON blob (legacy — not emitted by the current Next.js page), an `"items":[…]` regex with bracket matching, `feed-grid__item` grid tiles, then a global `href=/items/…` regex. The current live DOM lands on the grid-tile path: Vinted hashes its CSS-module class names (e.g. `Grid-module-scss-module__…__feed-grid__item`), so tiles are matched on the stable `feed-grid__item"` suffix rather than a fixed class, and each tile yields URL (query stripped), title, structural price, currency and thumbnail.
  - **Per item**: `title`, `price` (raw string), `priceValue` (numeric, for sorting — `null` when only a placeholder like "Sprawdź"/"??" is available), `currency`, `url`, and `photo` (an `images1.vinted.net` thumbnail URL; present on the JSON and grid-tile paths, absent on the bare `href` fallback). `parseVintedPrice` normalizes `"25,00"` / `"12.90"` / numbers → a number, placeholders → `null`. When no structural price is found, the item price is recovered from the offer's `title` text (Vinted embeds `…, {price} zł, {price with buyer protection} zł`; the lower of the pair is the item price).

## 2b. Grouping by Seller (on-demand)
Second, opt-in phase for finding "low-hanging fruit" — books available from the **same seller**, so one order can bundle several.
- **Why a separate phase**: the seller is **not** in the catalog tiles (only `url`/title/price/photo); it lives on the individual offer page. Resolving it needs an extra fetch per offer, so it runs only when the user clicks **"Grupuj per sprzedawca"**, never during the main scan.
- **Two modes**: **Najtańsze** looks up only the cheapest offer per matched book (1 fetch/book, fast); **Wszystkie oferty** looks up every offer of every matched book, revealing many-to-many bundles (pay a little more per book but consolidate one shipment). Both reuse the scanner's throttling / `withRetry` / block detection; the request volume is capped at **150** (the frontend also caps and reports how many offers were skipped — no silent truncation).
- **Premium annotation**: `groupBySeller` keeps each seller's **cheapest copy per book** and computes the **premium vs the book's global-cheapest** offer, so the UI shows the shipping-vs-item tradeoff per book and per bundle (`premium` / `totalPremium`).
- **Seller extraction**: `extractVintedSeller(html)` reads two stable, unique markers from the offer page — the profile link `href="/member/{id}"` (id) and `data-testid="profile-username"` (login) — returning `{ id, login, url }` (login `detach`-ed, since the offer page is ~2 MB).
- **Flow**: `POST /api/vinted-group` with `{ items: [{ url }] }` → `VintedSyncService.resolveSellers` streams a `seller_resolved` event (`{ url, seller }`) per offer → the frontend maps `url → seller` and the pure `groupBySeller` returns sellers holding **≥2 distinct books**. Grouping/rendering is entirely client-side.

## 2c. Persistence (Notion blob) — decouples acquisition from analysis
Scraping is rate-limited and unreliable (Cloudflare); analysis (grouping) is cheap and repeatable. Persisting scan results into Notion separates the two: scrape once, analyse many times, and make the scan **resumable** across runs (the ~160-books-per-run limit stops losing progress).
- **Store**: a compact JSON blob in a `VintedData` rich_text property on each book row (`services/vintedStore.ts`: `StoredVintedData = { scannedAt, offers[] }`). The adapter chunks it into ≤2000-char rich_text segments (`saveVintedData`); the mapper rejoins them (`getPlainText` → `NotionBook.vintedData`).
- **Write path** (stage 1): the scan persists per book best-effort (`persistBookOffers`) after each response — matches, or an empty-offers record that still stamps `scannedAt` (scan coverage). `createColumnIfNeeded("VintedData")` ensures the property once per run; a failure disables persistence without failing the scan.
- **Merge**: `mergeOffers` keeps a previously-resolved **seller** for any offer whose URL still exists, so a re-scan doesn't wipe seller data captured separately; vanished offers drop, new ones enter without a seller.
- **Seller resolution** (stage 2): `resolveSellersToStore` walks stored offers whose `seller` is `null`, fetches each offer page, and writes the seller back into the blob (one Notion write per book). It's **incremental and resumable** — resolved sellers persist, so each run (capped, default 150 fetches) only tackles remaining `null`s; re-run until `remaining` is 0. Task `vinted-resolve-sellers` / `POST /api/vinted-resolve-sellers`; UI button "Ustal sprzedawców (baza)".
- **Stage 3** (planned): grouping and the tile view read straight from the blob (no re-scrape) with a `scannedAt` freshness marker.

## 3. Reliability & Anti-Bot Pacing
- **Timeout**: 45 000 ms per request (via a keep-alive `https.Agent`).
- **Throttling**: 3–5 s delay (with jitter) between books — applied on **every** path, including the no-results case, to avoid the request bursts that trigger Cloudflare blocks.
- **429 handling**: On HTTP 429 waits ~5 s before continuing; 403 is surfaced as a Cloudflare block.
- **Cancellation**: Cooperative — checks the cancellation token each iteration and reports `cancelled: true` on the `complete` event when stopped.

## 4. Frontend Integration
- **Hook**: `useVintedCheck` opens the SSE stream and renders progress, per-book search attempts, and matched listings.
- **Trigger**: The "Skaner Artefaktów Vinted" section (Vinted tab).
- **Output**: A `search_attempt` event per book (status + item count) plus `match` events with the found listings.
- **Offer display** (`VintedCheckItem`): per book the offers are sorted cheapest → dearest via `sortOffersByPrice` (price-less offers sink to the end); the card header shows `od {min} zł · {count}` (`offersPriceSummary`), the cheapest offer is badged "najtańsza", and each row renders the offer thumbnail (falling back to a placeholder icon), the formatted price (`formatVintedPrice`, Polish style), and the offer title. Helpers live in `src/utils/vintedOffers.ts` (pure, unit-tested).

## 5. Notes
- Vinted's markup and anti-bot behaviour change over time; treat the HTML parsing as best-effort and expect occasional `blocked` results from a datacenter IP.
