# Library Availability Check Algorithm (`services/libraryCheckService.ts`)

## 1. Overview
Scrapes the OPAC (Prolib Integro) of the Municipal Public Library in Lublin (MBP Lublin) to check whether a given branch holds the **book** edition of each unread/unowned title from Notion. The branch is selected via the `f2` query filter, so the OPAC already scopes results to that agenda — presence of a matching record means the branch has it in its collection.

## 2. Request
- **URL**: `https://opac.mbp.lublin.pl/search/description?q={title}&index=1&scope=full&f2%5B0%5D={libraryCode}` (all fields, extended scope, branch filter).
- **Target**: Notion books NOT tagged `Przeczytane`, `Biblioteka`, `Biblioteka 9`, or `Posiadam`, with a non-empty Polish title.
- **TLS**: the OPAC omits its intermediate certificate (Node → "unable to verify the first certificate"), so the library scanner uses a dedicated agent with `rejectUnauthorized: false` (public catalog, no secrets). The Vinted scanner keeps full verification.

## 3. Parsing (`services/opacParser.ts` — pure, unit-tested)
`parseOpacResults(html) → OpacRecord[]`. The results page lists each item as an `<article data-item-id="…">` containing a `<dl class="dl-horizontal">`:
- **Title** from `<dt>Tytuł:</dt>`.
- **Author** from `<dt>Autorzy:</dt>` (note: `Autorzy`, not `Autor`) — the value sits inside an `<a>` link.
- **Document type** from the media icon: `pdt-p-book` → *książka*, `pdt-p-audiobook` → *książka mówiona*, `pdt-p-movie` → *film*.

## 4. Matching (`findBookMatch`)
A single search like "gra o tron" returns mixed media (the audiobook, TV-series discs) **and** other works by the same author (caught by series/subject). So a naive "first record" match is wrong. `findBookMatch`:
1. Keeps only **book** records (`ksiazka`) — films and audiobooks are excluded by default (`includeAudiobook` opts them back in).
2. Requires a **title match** (similarity > 0.8 or whole-string containment; parallel "Original = Polish" titles are compared on both sides) — this rejects a *different* book by the same author.
3. Requires an **author match** when the Notion author is known (normalized both sides; similarity > 0.6 or containment).
4. Returns the best-scoring book record, or `null`.

Worked example: for "Gra o tron" (G. R. R. Martin) at Filia Felin, the branch holds only the audiobook and the TV series plus other Martin books (Rycerz Siedmiu Królestw, Ogień i krew) — so the scan correctly reports **no book match** instead of a false positive on the audiobook.

## 5. Performance & pacing
- **Concurrency**: up to 6 parallel requests via `p-limit` (agent `maxSockets` matched), instead of the old one-at-a-time loop — ~6× faster over a couple hundred titles.
- **Retries/timeout**: `withRetry(2, 1500ms)`, 20 000 ms per request. No fixed inter-request delay; concurrency is the throttle.
- **Cancellation**: cooperative — each task checks the token before firing; `complete` reports `cancelled: true` when stopped.
- **Progress**: a shared counter emits `Sprawdzono {done}/{total} (znaleziono {n})` as tasks finish.

## 6. Tagging a hit (`POST /api/mark-as-read`)
Each identified book carries a button that writes a **branch-specific `Źródło` tag** instead of `Przeczytane`: `Biblioteka` for Filia Felin and `Biblioteka 9` for Filia Bronowice (mapped from `sourceTag` in `src/constants.ts` → `LIBRARY_BRANCHES`). Those two tags are exactly the ones excluded from candidates (§2), so tagging a book also removes it from later scans of that branch. The endpoint (`controllers/syncController.ts` → `syncManager.markAsRead(pageId, tag)`) validates `tag` against an allow-list (`Przeczytane`, `Biblioteka`, `Biblioteka 9`); omitting it defaults to `Przeczytane` (used by the owned-unread / library-stats buttons). The tag is appended via `notion.addTagToMultiSelect("Źródło", …)`, which is idempotent.
