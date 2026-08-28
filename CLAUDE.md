# CLAUDE.md

Cogitator Omnissiah — a full-stack app that syncs sci-fi book awards (Hugo, Nebula, Locus) from the "Archiwum Encyklopedii Fantastyki" (MediaWiki API) into a personal Notion database. Hybrid Vite + Express setup: React 19 SPA frontend, Express backend with long-running sync tasks streamed over SSE.

## Commands

```bash
npm run dev      # Start dev server (tsx server.ts — serves API + Vite frontend)
npm run build    # vite build → dist/public/ (SPA) + esbuild bundle of server.ts → dist/server.cjs (served static root = dist/public only)
npm run lint     # tsc --noEmit (strict mode; no separate linter configured)
npm test         # vitest run (full suite)
npx vitest run <path>   # Run a single test file
```

Environment variables (see `.env.example`): `NOTION_API_KEY`, `NOTION_DATABASE_ID` (required); `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` (optional, opt-in Basic Auth). Tests mock all external services and run without them.

## Required reading

- **`COGITATOR_GUIDELINES.md`** — the authoritative architectural guidelines (backend patterns, frontend rules, data-integrity logic, test architecture, design system). Follow it for every change.
- **`/docs/*.md`** — detailed per-feature algorithm documentation (book sync, duplicate detection, purification, schema validation, stats, Vinted scanner, etc.). Read the relevant doc before touching a service.

## Architecture map

- **Entrypoint / wiring**: `server.ts` is the entrypoint (startServer, Vite/static, process handlers) and mounts `app.ts` (Express wiring: `basicAuth` → `json` → `/api` routes). Keep the two separate — that split breaks the old `server ↔ controller` import cycle.
- **Adapters** (repo root): `notion.adapter.ts`, `wiki.adapter.ts` — pure API wrappers, no business logic. Page→domain mapping lives in `notionMapper.ts` (`mapPageToBook`), not in the adapter. "No data" and "infrastructure failure" are distinct: `fetchPageContent` returns `""` for a missing page but throws on network failure; `fetchPagesContentBulk` returns `{ contents, failedTitles }` so services can report what was skipped.
- **Services** (`/services/`): one service per sync concern (`bookSyncService`, `duplicateSyncService`, `publisherSyncService`, `seriesSyncService`, `cyclesSyncService`, `cycleHarvestService`, `lpSyncService`, `statsService`, `integrityService`, `purificationService`, `schemaValidationService`, `libraryCheckService`, `vintedSyncService`). **Read-only services stay OFF `TASK_REGISTRY`** and are plain `SyncManager` getters: `configService` (effective config = `src/configSchema.ts` defaults + diff stored in the `AppConfig` column description), `cycleLookupService` (on-demand cycle preview walk, no writes). Orchestrators delegate to pure helpers: `bookDiff.ts`, `vintedParser.ts`, `dataNormalizer.ts`, `diffEngine.ts`, `bookCategory.ts` (`isAwardBook`/`isCycleVolume`), `cycleRows.ts` (row payloads + `aggregateCycleRows`), `marketStats.ts`, plus front/back-shared modules in `src/` (`configSchema.ts`, `src/utils/encyclopedia.ts`, `src/utils/statsLayout.ts`, `src/utils/shelfInsertion.ts`). The HTML scanners (`libraryCheckService`, `vintedSyncService`) scrape public pages rather than Notion/Wiki APIs and share `scrapingClient.ts` (repo root: User-Agent rotation + keep-alive HTTPS agent).
- **Row category model**: non-award cycle sibling volumes are REAL rows tagged `Kategoria="Tom cyklu"` (with `Cykl`/`CyklNr`); award-only consumers (stats/integrity/shelf/search/Lp/duplicates) filter via `bookCategory.isAwardBook`, the Vinted scanner intentionally does not. `cycleHarvestService` upserts them idempotently (shared `normTitle` index + synchronous slot reservation).
- **Orchestration**: `SyncManager` in `syncManager.ts` (the domain composition root — it builds the adapters and services) coordinates them via a `TASK_REGISTRY` + generic `run(taskName, sendEvent, params?)`, plus concurrency (`p-limit`), a single-active-task lock, cancellation, and SSE progress events.
- **Controllers/Routes** (`/controllers/`, `/routes/`): HTTP parsing/validation only; delegate to services. SSE transport (headers, keepalive, client-disconnect cancellation) lives in `controllers/sseStream.ts`, kept separate from the request handlers in `syncController.ts`.
- **Frontend** (`/src/`): components in `src/components/` (atomic parts in subdirs), all data fetching via custom hooks in `src/hooks/`. `useSyncManager` owns cross-ritual orchestration. The SSE transport (POST → `res.ok` → `consumeSSE` + stall watchdog + error/stall message) lives once in `useSSEStream` (`src/hooks/useSSEStream.ts`); the stream hooks (`useSync`, `useVintedCheck`, `useLibraryCheck`) build on it and differ only in their per-event routing/state — reuse it, don't re-implement the fetch/watchdog loop.
- **Parsing**: `wiki.parser.ts` extracts book metadata from MediaWiki wikitext — `parseAwardTable` (award result tables), `extractAuthor`, `extractPublisherAndSeries` (`{{tabela wydania}}`, `{{Książka}}` templates).
- **Resilience**: `retry.ts` (`withRetry`) wraps flaky external calls with exponential backoff (`idempotent=false` skips network/5xx retries for non-idempotent writes like `addRow`).

## Tests

Vitest, organized into `__tests__/` subdirectories: `/__tests__/` (adapters, server, infra), `/services/__tests__/`, `/src/__tests__/`, `/src/hooks/__tests__/`. Backend tests use `@vitest-environment node`; frontend tests use JSDOM. Mock external deps with `vi.mock` (Notion SDK, axios). Keep the suite green — run `npm test` and `npm run lint` before committing.

## Conventions

- Tailwind CSS only; glassmorphism theme (`slate-950` background, `cyan-400`/`purple-500` accents); `motion/react` for animations; `lucide-react` icons.
- **Branding: "Librem"** — warm, literary "your book collection" voice (Kolekcja, Regał, Katalog, Synchronizacja, Rynek, Ustawienia). The old Warhammer 40k "Adeptus Mechanicus" flavor (rituals, Machine Spirit, sanctity) has been retired from user-facing copy (v1.61.0) — do NOT reintroduce it. Domain/data identifiers stay untouched (Notion column names like `AppConfig`, `Kategoria="Tom cyklu"`, TASK_REGISTRY keys, backend service copy). The dark theme keeps the 40k glassmorphism *visual* look, but its *copy* is Librem like everything else.
- After major architectural changes, update `COGITATOR_GUIDELINES.md` and `README.md` to match the implementation (see guidelines §8).

## Workflow rules

- **Version bump (every change)**: `metadata.json` `version` is the single source of truth for the app version — `vite.config.ts` reads it into `__APP_VERSION__` (shown as the UI badge). Bump it on every functional change using semver (patch = fix, minor = feature, major = breaking) and mirror the same value into **both** `package.json` `version` **and** `package-lock.json` (root `version` + `packages.""` `version`, so the lockfile doesn't drift and trip the stop-hook). One-shot for the two npm files: `npm version <same-version> --no-git-tag-version` after editing `metadata.json`. Do not commit a code change without a version bump.
- **Persistent memory (`backlog.md`)**: `backlog.md` is the durable findings/state log so the context window can be `/clear`-ed safely. Read it at the start of a session; after every change or finding, update it (record the finding/decision, the new version in its Changelog, and tick off open items) **before** clearing. It must reflect HEAD, not chat history — keep entries one-line and terse; long analyses stay in `docs/`.
