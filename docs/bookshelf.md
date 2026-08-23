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
- **`planShelf(books)`** — turns the sorted shelf into deterministic **slots**, each holding one or
  more volumes: **`spine`** (upright, `lean === 0`, ~80%) or slightly tilted (`lean` up to
  `MAX_LEAN_DEG` = 6°, ~12%), or **`stack`** — a lying pile where **each layer is a separate real
  volume** (2–4 consecutive books, their own title/colour/award/drag), not one spine faking a pile.
  A stack holds **4–7** consecutive volumes. The per-book decision uses the avalanche-mixed (`mix32`)
  title hash so the split stays even across any corpus; every book lands in exactly one slot. Poses
  are `transform`/markup **inside** the fixed-height cell, so plank alignment and drag&drop are untouched.
- **`spineFontSize(style, title)` / `flatBookLayout(book, style)`** — size every book to show its
  **full name** (no truncation). A standing spine picks a font (6–11 px) so the whole title fits along
  its height; a lying book picks font + width + thickness so the full title fits horizontally (wider
  book for a longer title, smaller font only when very long; thickness 15–18 px).
- **`leanLayout(style, deg)`** — enforces the **no-overlap rule** for a tilted spine: the cell
  reserves the *rotated* width (`cellW = W·cosθ + H·sinθ`) and offsets it (`shiftX`) so the rotated
  box is centred, keeping the volume inside its own track (the `column-gap` between cells is
  preserved). `deg === 0` → plain spine width. Unit-tested by checking all four rotated corners fall
  within `±cellW/2`.
- **`BookStack`** (`shelf/BookStack.tsx`) — renders a `stack` slot: each real volume as its own
  lying book (colour from its title, title along the spine, award marker, individually draggable).

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
