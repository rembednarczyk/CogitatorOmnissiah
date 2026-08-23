# Regał Archiwum (Bookshelf)

## 1. Overview
The **Regał** tab renders the tracked library as physical shelves instead of a list: read books
stand as coloured **spines** (concept A), awarded reads also appear face-out on a **"Wyróżnione"**
cover row (concept B). Two shelves — **Do przeczytania** and **Przeczytane** — sit side by side, and
a book is dragged between them; the drop writes the read state back to Notion. **No AI/LLM.**

Each shelf is drawn as a **wooden cabinet** (`ShelfFrame`): a cornice with a Mechanicus cog sigil +
title, dark back-panel with vertical planks, brass corner brackets and a hanging purity seal
(`ShelfOrnaments` — decorative, `aria-hidden`). Rows of spines each rest on a real **plank**, and the
**Do przeczytania** shelf holds **every** volume (no scroll cap) so the whole backlog is visible at once.

## 2. Data
- Reuses **`GET /api/books`** (`BookIndexEntry[]`, see [skryptorium-search.md](./skryptorium-search.md)) —
  the same slim index the search uses. Read state is derived from the `zrodlo` (Źródło) tag
  `Przeczytane`; nothing extra is fetched.

## 3. Pure helpers (`src/utils/bookshelf.ts`, unit-tested)
- **`isRead(book, overrides)`** — read state with optimistic overrides layered over the base tag.
- **`spineStyle(book)`** — deterministic spine colour (a muted book-cloth palette), width and height
  from a hash of the title, so a spine looks identical across re-renders. The hash is unsigned
  (`>>> 0`); the height derivation uses an **unsigned** shift (`>>> 3`) — a signed `>> 3` goes
  negative for hashes above 2³¹ and produced out-of-range heights (caught by a bounds test).
- **`splitShelves(books, overrides)`** — partitions into `{ read, toRead }`, each sorted by author
  then title.
- **`featuredReads(books, overrides, limit)`** — the cover row: read **and** awarded, newest year
  first (no read-date exists in the data), capped at `limit`.
- **`shelfPlankBackground()`** — the CSS `repeating-linear-gradient` that paints a wooden plank under
  every row. Rows use fixed-height cells (`SHELF_ROW_H` > tallest spine), so every wrapped line
  advances by exactly `SHELF_ROW_H + SHELF_ROW_GAP`; the gradient period matches, so a plank lands
  directly beneath each row regardless of viewport width or how many spines fit per line.
- **`spinePose(book)`** — deterministic pose for a bit of shelf dynamism: **straight** (~66%),
  **lean** (~27%, tilt 4–11° pivoting at the base) or **flat** (~7%, a small **3–5**-book pile lying
  down, rendered by `FlatBook`). The title hash is avalanche-mixed (`mix32`) before slicing so the
  split stays even across any title corpus (a raw rolling hash of near-identical titles is skewed).
  The pose is a `transform`/markup change **inside** the fixed-height cell, so it never disturbs the
  plank alignment; drag&drop is unchanged.
- **`spineLayout(style, pose)`** — enforces the **no-overlap rule**: each cell reserves the width of
  the *rotated* spine (`cellW = W·cosθ + H·sinθ`) and offsets it (`shiftX`) so the rotated bounding
  box is centred in the cell. A leaning volume therefore stays inside its own track and never crosses
  into a neighbour (the `column-gap` between cells is preserved). Straight/flat cells reserve exactly
  their footprint. Unit-tested by checking all four rotated corners fall within `±cellW/2`.

## 4. Drag & drop + persistence
- Native HTML5 DnD: each `BookSpine` is `draggable` and puts its id on the dataTransfer; each `Shelf`
  is a drop target that highlights while a drag is in progress.
- On drop onto the opposite shelf, `BookshelfSection` moves the book **optimistically** (sets a
  `ReadOverrides` entry so `splitShelves` re-partitions immediately) and then persists:
  - drop on **Przeczytane** → `POST /api/mark-as-read` (adds the `Przeczytane` tag);
  - drop on **Do przeczytania** → `POST /api/unmark-as-read` (removes it).
  If the write fails, the override is reverted and an error banner names the book. Dropping onto the
  same shelf is a no-op.
- **Backend** mirrors the existing mark path: `NotionAdapter.removeTagFromMultiSelect` (inverse of
  `addTagToMultiSelect`, both invalidate the books cache) → `SyncManager.unmarkRead` →
  `POST /api/unmark-as-read`, guarded by the same `ALLOWED_SOURCE_TAGS` allow-list as `mark-as-read`
  so only known Źródło tags can be written.

## 5. Scope notes
Concept A (spines) + B (featured covers) shipped, now inside the `ShelfFrame` cabinet; the alternate
40k "Krypta Danych" neon skin (C) was a rejected mock. The **Do przeczytania** shelf renders all
volumes (no virtualization) — fine for the current ~700-book index; virtualization is the fallback if
counts grow large. Out of scope for now: per-shelf sort/filter and a write-in-progress animation on
the dragged spine.
