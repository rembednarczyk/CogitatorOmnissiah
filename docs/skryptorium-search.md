# Skryptorium — Archive Search

## 1. Overview
A live, client-side search over the book records ("Skryptorium" tab). Typing filters the
archive as you go — `per` shows several titles, `pere` narrows to just *Perelandra*. Matching
is diacritics-insensitive and spans the Polish title, original title, and author. **No AI/LLM.**

## 2. Data flow
- **`GET /api/books`** (`routes/syncRoutes.ts` → `syncController.getBooks` → `syncManager.getBooks`)
  returns a slim `BookIndexEntry[]` (`src/types.ts`): `id, plTitle, origTitle, author, year,
  awards[], zrodlo[], series, partOfCycle`. The pure mapper `toSearchIndex`
  (`services/bookSearchIndex.ts`) projects the full `NotionBook[]` down to this — deliberately
  dropping the heavy `vintedData` blob and `*RichText`. A record is kept when it has **any**
  title (Polish **or** original) — untranslated books that only carry an original title are
  searchable too; only rows with no title at all (skeletons) are dropped.
- It reuses `getBooksForStats({ cache: true })`, so it rides the existing `booksCache`
  (invalidated on writes) — the endpoint is effectively free.
- **`useBooks`** (`src/hooks/useBooks.ts`) fetches the index **once** into state. With ~214
  records the entire search runs in memory: no keystroke ever hits the network or Notion.

## 3. Matching (`src/utils/bookSearch.ts`, pure + unit-tested)
- **`fold(s)`** — per-character diacritic fold (`ą→a … ł→l … ź→z`) + lowercase. Deliberately
  **not** `normalize('NFD')`: NFD does not decompose `ł` (U+0142), and a per-char fold stays
  **1:1 in length**, so a match index in the folded string maps straight back onto the original
  — which is what makes highlighting correct under diacritics.
- **`matchBooks(query, index)`** — tokenizes the folded query on whitespace; a record matches
  when **every** token is a substring of the title, original title, **or** author (AND across
  tokens, OR across fields — so `simmons upadek` = author ∧ title). Ranking: title-prefix (0) >
  title-substring (1) > original-title (2) > author (3), tie-broken by Polish `localeCompare`.
  An empty query returns the whole set sorted by title (browse mode).
- **`highlight(text, query)`** — splits a string into hit / non-hit segments using the 1:1 fold,
  merging overlapping ranges; falls back to a single non-hit segment if a rare lowercase length
  change would misalign indices.
- **`buildSearchVocab(index)` + `didYouMean(query, vocab)`** — "Czy chodziło Ci o…". The vocab is
  the deduped set of folded words from titles (PL + original) and authors (display keeps a
  capitalized variant), built once per set. `didYouMean` takes the **last** query token (a typo
  usually sits in one word) and returns up to 3 vocab terms within a length-scaled Levenshtein
  threshold (≤4→1, ≤7→2, else 3), pre-filtering on `|Δlen|` and skipping exact (distance-0) hits.
  The UI shows the suggestions only when `matchBooks` returned nothing; clicking one sets the query.

## 4. UI (`src/components/SearchSection.tsx` + `search/`)
- Autofocused input (styled like `SchemaEditor`), a live count, and a responsive grid of
  glassmorphism `BookResultCard`s with `motion` `layout` reflow. Each card shows the highlighted
  title, original title, `author · year · series`, and award / źródło / „cykl" badges.
- The query is passed through **`useDeferredValue`** (React 19) so the input stays snappy while
  the grid re-renders. `RENDER_CAP = 150` bounds the DOM for the empty-query "whole archive"
  case (a hint tells the user to narrow when exceeded).

## 5. Scope notes
Search fields are title (PL + original) + author by design. Faceted filters (source / award /
cycle) and a Cmd+K palette are intentionally out of scope for now (see `backlog.md`).
