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

## 1a. Operating rules (the "physical shelf" contract)
These are the invariants the layout obeys — the whole visual design, built up across `1.16.0 → 1.17.2`,
expressed as rules. They are enforced by pure, unit-tested helpers (`utils/bookshelf.ts`,
`utils/shelfPacking.ts`); the components only render what those return. All decisions are
**deterministic from the title hash**, so the shelf never flickers between renders or re-wraps.

**Furniture & planks**
1. Every shelf is a wooden cabinet (cornice + posts + plinth + ornaments); ornaments are decorative
   and `aria-hidden`.
2. Every **row of volumes rests on its own plank**; rows are fixed-height bands so planks always land
   directly under the books.
3. The **Do przeczytania** shelf shows **all** volumes at once (no scroll cap).

**Poses (per volume, deterministic)**
4. Most volumes **stand upright**; a minority lean; stacks are **rare**.
5. A volume leans **at most `MAX_LEAN_DEG` (6°)**, and only where it makes physical sense (see §11).
6. A book's spine colour / width / height and its pose are stable for a given title (hash-derived,
   avalanche-mixed so the split is even across any corpus).

**Stacks (lying piles)**
7. A stack is **several real, consecutive volumes** lying down — each its own title/colour/award/drag —
   never one spine faking a pile. A stack holds **4–7** volumes.
8. **Two stacks are never adjacent** (a stack is always followed by an upright volume).
9. The upright volumes **next to a stack lean toward it** (they rest on it — see §11).
10. Inside a stack, volumes are sorted **largest at the bottom → smallest at the top**; the pile is
    aligned **often to the left, often to the right, and only rarely a symmetric centred pyramid**,
    with an occasional small horizontal "chaos" scatter. No layer overhangs the pile.

**Physics: filling & resting**
11. **A book leans only when there is a gap to lean into**, at exactly `θ = atan(gap / supportHeight)`
    (≤ 6°, pivoting at the base corner on the support side) — its face meets the top corner of the
    neighbour/pile and **rests on it**, never floating. No gap → it stands straight. Edge volumes
    never lean outward.
12. **Every shelf is filled edge-to-edge** — each row's first volume starts at the left edge and the
    last ends at the right edge; there is no ragged gap at the end of a row.
13. **Upright volumes stand tight together** (a ~1 px seam). Slack is consumed first by leaning books
    (rule 11); only the overflow becomes a few capped "break" gaps (each ≤ `MAX_BREAK`), so books
    cluster instead of drifting evenly apart.

**Titles & interaction**
14. **Full titles, never truncated**: an upright spine shrinks its font (6–11 px) to fit the whole
    title along its height; a lying book fits the full title too, wrapping to **two lines** rather
    than widening past `FLAT_MAX_W` (150 px).
15. Every volume — upright or in a pile — is individually **draggable** between the two shelves; the
    drop writes read-state back to Notion (§4). Read/`toRead` split and per-book optimistic move are
    unchanged by any of the above.

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
  Stacks are **rare** (planner threshold), **never adjacent** (a stack is always followed by a spine),
  and a stack's neighbouring spines **lean toward the stack** (`LEAN_TOWARD` — left neighbour tilts
  right, right neighbour tilts left).
- **`layoutStack(books)`** — full geometry of one stack: layers sorted **largest at the bottom,
  smallest at the top**, plus a per-stack **alignment** (`stackAlign` — often left, often right,
  rarely a symmetric centred pyramid) and optional **chaos** (`stackChaos` — ~⅓ of stacks get a
  3–7 px horizontal scatter via `layerJitter`). Each layer's `x` is clamped to `0 ≤ x ≤ cellW − width`,
  so a stack never overhangs its cell. `BookStack` just renders what `layoutStack` returns.
- **`spineFontSize(style, title)` / `flatBookLayout(book, style)`** — size every book to show its
  **full name** (no truncation). A standing spine picks a font (6–11 px) so the whole title fits along
  its height. A lying book is capped at `FLAT_MAX_W` (150 px): a short title stays one line, a longer
  one **wraps to two lines** (the book gets a touch thicker, not wider — `lines` in the return);
  a very long title also shrinks the font until half fits on a line (two lines always suffice).
  `BookStack` renders the title with `-webkit-line-clamp`.
- **`layoutStack(books)`** also returns the stack **`height`** (sum of layer thicknesses), used as a
  support height when a neighbouring spine leans onto the pile.

## 3a. Shelf physics (`src/utils/shelfPacking.ts`, unit-tested)
`Shelf` measures its inner width (`ResizeObserver`) and lays out volumes with real packing instead of
CSS `flex-wrap`, so two physical rules hold:
- **Every shelf is filled — no end gap.** `packRows` greedily fills each row; `layoutRow` distributes
  the row's leftover width so the first volume starts at the left edge and the last ends at the right
  edge (`x = 0 … rowWidth`). A tight row has no slack; a sparse row spreads to fill.
- **Upright books stand tight together.** Two straight-standing spines get only a ~1 px seam
  (`STRAIGHT_GAP`). Slack is absorbed first by leaning books (resting on their support); only the
  overflow becomes a **minimal number of "break" gaps** (each ≤ `MAX_BREAK` = 34 px, spread evenly),
  so upright books cluster together while the row still spans full width.
- **A leaning book rests on its support, never floats.** A book leans **only when there is a gap to
  lean into**, at exactly `θ = atan(gap / supportHeight)` (capped at `MAX_LEAN_DEG`, pivoting at the
  base corner on the support side). That angle makes the book's face meet the top corner of the
  neighbour/pile it leans toward — it rests on it. No gap → the book stands straight (packed tight →
  upright, emergent physics). Edge volumes never lean outward (no support beyond the row edge).

`planShelf` supplies each spine's intended lean **direction** (sign); the **angle** is derived at
layout time from the actual gap. Each row is rendered as an absolutely-positioned band of height
`SHELF_ROW_H` with its own wooden plank beneath it.
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
