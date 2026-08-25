# COGITATOR OMNISSIAH: ARCHITECTURAL GUIDELINES (v1.6)

## 1. CORE ARCHITECTURE (BACKEND)
- **Pattern**: Service-Adapter-Manager.
- **Adapters**: `NotionAdapter`, `WikiAdapter`. Pure API wrappers. No business logic.
- **Services**: `*SyncService`, `StatsService`, `IntegrityService`, `PurificationService`, `SchemaValidationService`, `CycleHarvestService` (materializes cycle sibling volumes as rows), plus the HTML scanners `LibraryCheckService` and `VintedSyncService`. Logic-heavy, stateless where possible. `SyncManager` (in `syncManager.ts`) stays a thin dispatcher — every long-running ritual lives in a service exposing `run*(sendEvent, checkCancellation)`, wired through `TASK_REGISTRY`; never inline scraping/sync loops back into the manager or `server.ts`. Scanners scrape public HTML (not Notion/Wiki APIs) and share `scrapingClient.ts` (User-Agent rotation + keep-alive HTTPS agent).
- **Read-only services** (NOT rituals, kept OFF `TASK_REGISTRY`): `ConfigService` (30s-cached effective config = `configSchema` defaults + the diff stored in the `AppConfig` **column description**), `CycleLookupService` (on-demand walk of the `poprzednia`/`następna` chain + `{{Cykl}}` for a cycle preview, no writes). Exposed as plain `SyncManager` getters (`getCycle`, `getCyclesHarvest`, `getStats`), never through `run()`.
- **Pure helpers** (data-in → data-out, no I/O, unit-tested, same style as `bookDiff`/`dataNormalizer`): `bookDiff`, `vintedParser`, `dataNormalizer`, `diffEngine`, `bookCategory` (`isAwardBook`/`isCycleVolume` — the `Kategoria` split), `cycleRows` (row payloads + `aggregateCycleRows` + cheapest Vinted offer), `marketStats`, `statsLayout`, `shelfInsertion`, `shelfLayout`, `bookshelf`. Shared zero-Node-dep modules used by BOTH front and back live in `src/`: `configSchema.ts`, `src/utils/encyclopedia.ts`.
- **Orchestration**: `SyncManager` (in `syncManager.ts`). Each task owns a `SyncTask` state object with its own cancellation flag; `executeTask` releases the lock only if it still belongs to the finishing task. `resetSyncState` signals cancellation but does NOT null `currentTask` — it lets the task's own `finally` release the lock once it observes the cancel and exits, so a still-writing task can never run concurrently with a newly-started one (the "exactly one sync at a time" invariant). Never reintroduce shared mutable booleans for task state, and never force-null the lock while a task is in flight.
- **Communication**: SSE (Server-Sent Events) for real-time progress. Use `sendEvent({ type, ... })`. Client-disconnect cancellation MUST listen on `res.on("close")`, NOT `req.on("close")` — for a POST with a body, `req` emits `close` when `express.json()` finishes reading the body (mid-response), which spuriously cancelled active syncs. Guard writes with `writableEnded`.
- **SSE hosting hardening**: proxies (e.g. Render) buffer streamed responses. `setupSSE` sends `X-Accel-Buffering: no`, `flushHeaders()`, a ~2KB comment padding to push past the buffer threshold, and a 5s keepalive. The client (`useSync`) has a 30s stall watchdog. Do not remove these.
- **Concurrency**: Use `p-limit` for external API calls (Notion/Wiki/OPAC).
- **Error Handling**: Distinguish "no data" from "infrastructure failure": `fetchPageContent` returns `""` for a missing page but THROWS a typed `WikiFetchError` on network failure/IP block; `fetchPagesContentBulk` returns `{ contents, failedTitles }` and services surface `failedTitles` in their error summaries. A sync must never report a clean `complete` when its data source was unreachable.
- **Observability**: use the structured `logger.ts` (`createLogger(component)`) and `classifyHttpError()` (maps failures to `ip_blocked`/`rate_limited`/`timeout`/`dns`/… with a user hint). `GET /api/diagnostics` is the end-to-end health check (Notion + parse each award page). Never log secrets — context objects carry metadata only.
- **Resilience**: `withRetry` handles transient network errors (socket hang up, timeout, ECONNRESET) with exponential backoff and honors `Retry-After` on 429 responses.
- **Security**: opt-in HTTP Basic Auth (`middleware/basicAuth.ts`) protects the whole service when `BASIC_AUTH_USER`+`BASIC_AUTH_PASSWORD` are set (`/api/health` stays open). Validate privileged mutations before forwarding to Notion — `updateNotionSchema` allows only `select`/`multi_select` and a well-formed `{ name }` option list. Encode/validate any request value interpolated into an outbound URL.

## 2. FRONTEND ARCHITECTURE (REACT)
- **Component Decomposition**: Strict SRP. UI components in `src/components/` (atomic parts in subdirs like `stats/`).
- **SSE Parsing**: Two layers, both shared — never re-implement either. (1) `consumeSSE` primitive (`src/utils/sse.ts`) buffers chunks across TCP reads (split on `\n\n`, keep the remainder) and parses `data:` lines; `consumeSSE(body, onEvent, onChunk?)` — `onEvent` returns `true` to stop early, `onChunk` re-arms per-read watchdogs. (2) `useSSEStream` (`src/hooks/useSSEStream.ts`) is the single POST→`res.ok`→`consumeSSE`+stall-watchdog transport; the stream hooks (`useSync`, `useVintedCheck`, `useLibraryCheck`) build on it and differ only in per-event routing. Never `JSON.parse` a raw chunk line-by-line, and never hand-roll the fetch/watchdog loop.
- **Logic Isolation**: No `useEffect` for data fetching in components — network I/O lives in Custom Hooks (a component invoking a hook's `fetch*` from `useEffect` is fine). Key hooks:
  - `useSync`: Standard for all long-running server operations (built on `useSSEStream`).
  - `useSyncManager`: Owns every ritual's `useSync` instance plus cross-ritual orchestration (mutual reset, the sequential "Wielki Rytuał" full sync, the aggregate result). `App` consumes it and stays presentational.
  - `useStats`: Global dashboard data. `useLibraryCheck`: Isolated library scanning. `useWikiUpdates`: encyclopedia recent-changes.
  - `useAppConfig` (`useEffectiveConfig` for consumers = module-cached read; panel draft + `save`; `persistStatsOrder` for the stats-card order): app config knobs. `useConfig`: Notion schema + connection status (distinct from `useAppConfig`).
  - `useCycle`: on-demand cycle preview (Skryptorium). `useCyclesHarvest`: cycle-rows archive (read + per-volume mark read/owned via `toggleSource`). `useShelfOrder`: precise shelf drag&drop persistence. `useMarkRead` (shelf) / `useMarkAsRead` (stats/library) mark `Źródło` tags — separate because their contexts and side effects differ.
- **Styling**: Tailwind CSS only. Theme: Glassmorphism, `slate-950` background, `cyan-400` / `purple-500` accents.
- **Animations**: `motion/react` (Framer Motion). Use for entry/exit and progress bars.
- **Dynamic UI**: Progress bars and summary cards SHOULD inherit the color of the active ritual (passed via `SyncState.color`) to provide visual feedback and reinforce ritual identity.

## 3. DATA INTEGRITY & SYNC LOGIC
- **Duplicate Detection**: Multi-signal (Title PL, Title Orig, Author Similarity, Common Words).
- **Purification Ritual (SRP)**: Deep cleaning (Wiki syntax stripping, native Notion formatting removal) is EXCLUSIVE to `PurificationService`. `BookSyncService` stays with simple whitespace normalization to avoid scope creep.
- **Wiki Parser Priority**: When extracting from `{{tabela wydania}}`, always pick the highest indexed `informacjaN` that is NOT empty, and take both `wydawca` and `seria` from that single (latest) edition — never backfill an empty field from an older edition (the latest edition is authoritative so the data mirrors current reality). Fallback to `{{Książka}}` only if no valid `infowydanie` is found.
- **Locus Categories**: Exclude only the YA category ("Powieść dla młodzieży"). All other Locus categories (incl. Horror/Dark Fantasy and Pierwsza powieść) are intentionally synced as "Nagroda Locus".
- **Idempotency (multi_select)**: Compare multi_select values (authors, publisher, series, awards) CASE-INSENSITIVELY, and normalize BOTH the wiki and the existing-Notion side before comparing. Notion matches option names case-insensitively and keeps its own casing, so comparing a normalized new value against a raw Notion value re-updates the field on every sync forever. Authors are MERGED (union), never replaced — manual Notion authors must survive.
- **Row categories (award vs cycle)**: Non-award cycle sibling volumes are REAL rows tagged `Kategoria = "Tom cyklu"` (award rows have `Kategoria` empty/`Nagroda`). Every award-only consumer (stats, integrity, shelf+Skryptorium search index, Lp numbering, duplicate detection, book-sync promotion) filters via `isAwardBook`/`isCycleVolume` (`services/bookCategory.ts`); the Vinted scanner intentionally does NOT filter (it scans cycle volumes too). The `CycleHarvestService` upsert is idempotent (index rows and cross-ref the base with the SAME `normTitle` normalizer the lookup uses, or a duplicate slips through; reserve the index slot synchronously before `addRow` to close the parallel race). Cycle rows carry `Cykl`/`CyklNr` (grouping + reading order) and their title column `Lp` holds a stable "Cykl (nr)" label, not the global ordinal.
- **Config store**: App knobs live as a diff-from-defaults JSON blob in the **description** of the `AppConfig` column (NOT a sentinel row — row-iterating rituals would touch it). Schema, defaults, clamps and diff/merge are in the shared `src/configSchema.ts`; `ConfigService` reads/caches; `notion.adapter` only reads/writes the raw string (`getAppConfigRaw`/`saveAppConfigRaw`).
- **Notion Schema**: Always check for column existence before writing. `SchemaValidationService` provisions the full model (award columns + `Kategoria`/`Cykl`/`CyklNr`/`Źródło`/`VintedData`/`ShelfOrder`); feature columns are also lazy-created on demand (`createColumnIfNeeded`). `AppConfig` is managed by the config store (column description), not the schema ritual.
- **Library Scan**: 30000ms timeout, 500ms delay, 4 retries. Fail-fast on network error. Uses `withRetry`.
- **Vinted Scan**: 30000ms timeout, 3 retries, 3-5s delay with jitter.

## 4. TEST ARCHITECTURE (VITEST)
- **Structure**: Tests are organized into `__tests__` subdirectories to maintain `src` cleanliness.
  - `/__tests__/`: Infrastructure, adapters, and server tests.
  - `/services/__tests__/`: Business logic and synchronization services.
  - `/src/__tests__/`: Main UI components.
  - `/src/hooks/__tests__/`: Custom React hooks.
- **Mocking**: Use `vi.mock` for external dependencies (Notion SDK, Axios).
- **Environment**: Use `@vitest-environment node` for backend tests and JSDOM for frontend tests.
- **Orchestration & SSE contract**: `__tests__/syncManager.test.ts` guards the task lifecycle (single-active-task lock, `stopActiveSync`/`resetSyncState` cancellation, lock release) and the SSE stream contract (well-formed `data:` frames, terminal `complete`, `400` on a concurrent sync). Mock the sync service (constructable `vi.fn()` + prototype methods) so the emitted event sequence is deterministic; never assert on real service internals here.

## 5. TOKEN OPTIMIZATION (AI INSTRUCTIONS)
- **Surgical Edits**: Use `edit_file` with precise `TargetContent`. Never replace whole files.
- **Context Awareness**: Read `package.json` and `syncManager.ts` (the composition root — service wiring + `TASK_REGISTRY`) before adding new services.
- **Conciseness**: Skip apologies and meta-talk. Execute -> Summarize.
- **Reuse**: Reference `useSync` patterns instead of re-implementing SSE handling.

## 6. DESIGN SYSTEM
- **Font**: Display (Headings) = Tracking-tighter, uppercase. Body = Sans.
- **Icons**: `lucide-react`.
- **Palette**: `cyan-500` (primary), `purple-600` (secondary), `slate-900/20` (glass), `amber` (cycles / config / warm accents), `rose` (Vinted/market). Semantic: emerald=owned, cyan=read, amber=to-acquire, red=danger.
- **Ritual color**: progress/summary cards inherit the active ritual's `SyncState.color`.
- **Shelf skins**: the bookshelf supports CSS-variable skins (`.skin-holo` / `.skin-noospheric`, `--noo-glow`/`--sk-*` tokens); Holo+ uses amber shelf-divider overrides. Keep skin styling token-driven, not per-component hardcodes.
- **Stats layout**: the dashboard cards render in a row-major round-robin masonry (`utils/statsLayout.ts`) and are drag&drop-reorderable (order persisted in `ui.statsOrder`).

## 7. ALGORITHM DOCUMENTATION
- **Detailed Instructions**: Detailed machine instructions for each core functionality are located in the `/docs/` directory (index: `docs/README.md`). Deployment, observability and troubleshooting live in the root `README.md`.
- **Available Docs**:
  - `docs/book-sync.md`: Book Synchronization Algorithm.
  - `docs/publisher-series-sync.md`: Publisher & Series Synchronization.
  - `docs/duplicate-detection.md`: Duplicate Detection & Management.
  - `docs/library-check.md`: Library Availability Check (Scraping).
  - `docs/stats-service.md`: Statistics Generation.
  - `docs/integrity-service.md`: Data Integrity & Sanctity.
  - `docs/purification-service.md`: Data Purification.
  - `docs/schema-validation.md`: Schema Validation & Initialization.
  - `docs/lp-sync.md`: Lp (Position) Synchronization.
  - `docs/cycles-sync.md`: Book Cycles Detection (marks the `Część cyklu` checkbox).
  - `docs/cycles-rows.md`: Cycles as rows — preview (`CycleLookupService`), harvest (`CycleHarvestService`), the `Kategoria`/`Cykl`/`CyklNr` model, in-app marking, and Vinted availability in the Archive.
  - `docs/config-store.md`: App config knobs (diff-in-column-description) + the calibration panel.
  - `docs/vinted-scanner.md`: Vinted Market Search (direct HTML scraper — NOT AI).
  - `docs/bookshelf.md`: Bookshelf (Regał) — skins, precise drag&drop, shelf order.
  - `docs/skryptorium-search.md`: Skryptorium client-side search index.

## 8. DOCUMENTATION & MAINTENANCE
- **Self-Correction**: After every major architectural change or logic fix (e.g., new service, parser update), the AI Agent MUST review and update `COGITATOR_GUIDELINES.md` and `README.md`.
- **App Versioning (every change)**: `metadata.json` `version` is the single source of truth for the app version — `vite.config.ts` reads it into `__APP_VERSION__` (the UI badge). Bump it on every functional change using semver (patch/minor/major) and mirror the value into `package.json` **and** `package-lock.json` (run `npm version <same> --no-git-tag-version` after editing `metadata.json`, so the lockfile version doesn't drift). Increment this guidelines header version only for significant architectural changes.
- **Persistent Memory**: `backlog.md` (repo root) is the durable findings/state log, kept so the AI's context window can be `/clear`-ed without losing knowledge. Read it at session start; update it (finding/decision + Changelog entry) before clearing. It reflects HEAD, not chat history.
- **Consistency**: Ensure that `README.md` descriptions match the actual implementation in `services/`.
