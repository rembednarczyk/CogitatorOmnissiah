# CLAUDE.md

Cogitator Omnissiah — a full-stack app that syncs sci-fi book awards (Hugo, Nebula, Locus) from the "Archiwum Encyklopedii Fantastyki" (MediaWiki API) into a personal Notion database. Hybrid Vite + Express setup: React 19 SPA frontend, Express backend with long-running sync tasks streamed over SSE.

## Commands

```bash
npm run dev      # Start dev server (tsx server.ts — serves API + Vite frontend)
npm run build    # vite build + esbuild bundle of server.ts → dist/server.cjs
npm run lint     # tsc --noEmit (strict mode; no separate linter configured)
npm test         # vitest run (full suite)
npx vitest run <path>   # Run a single test file
```

Environment variables (see `.env.example`): `NOTION_API_KEY`, `NOTION_DATABASE_ID` (required); `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` (optional, opt-in Basic Auth). Tests mock all external services and run without them.

## Required reading

- **`COGITATOR_GUIDELINES.md`** — the authoritative architectural guidelines (backend patterns, frontend rules, data-integrity logic, test architecture, design system). Follow it for every change.
- **`/docs/*.md`** — detailed per-feature algorithm documentation (book sync, duplicate detection, purification, schema validation, stats, Vinted scanner, etc.). Read the relevant doc before touching a service.

## Architecture map

- **Adapters** (repo root): `notion.adapter.ts`, `wiki.adapter.ts` — pure API wrappers, no business logic. "No data" and "infrastructure failure" are distinct: `fetchPageContent` returns `""` for a missing page but throws on network failure; `fetchPagesContentBulk` returns `{ contents, failedTitles }` so services can report what was skipped.
- **Services** (`/services/`): one service per sync concern (`bookSyncService`, `duplicateSyncService`, `publisherSyncService`, `seriesSyncService`, `cyclesSyncService`, `lpSyncService`, `statsService`, `integrityService`, `purificationService`, `schemaValidationService`). Logic-heavy, stateless where possible.
- **Orchestration**: `SyncManager` in `server.ts` coordinates services, concurrency (`p-limit`), cancellation, and SSE progress events.
- **Controllers/Routes** (`/controllers/`, `/routes/`): HTTP parsing/response only; delegate to services.
- **Frontend** (`/src/`): components in `src/components/` (atomic parts in subdirs), all data fetching via custom hooks in `src/hooks/` (`useSync` is the standard SSE pattern — reuse it, don't re-implement).
- **Parsing**: `wiki.parser.ts` extracts book metadata from MediaWiki wikitext (`{{tabela wydania}}`, `{{Książka}}` templates).
- **Resilience**: `retry.ts` (`withRetry`) wraps flaky external calls with exponential backoff.

## Tests

Vitest, organized into `__tests__/` subdirectories: `/__tests__/` (adapters, server, infra), `/services/__tests__/`, `/src/__tests__/`, `/src/hooks/__tests__/`. Backend tests use `@vitest-environment node`; frontend tests use JSDOM. Mock external deps with `vi.mock` (Notion SDK, axios). Keep the suite green — run `npm test` and `npm run lint` before committing.

## Conventions

- Tailwind CSS only; glassmorphism theme (`slate-950` background, `cyan-400`/`purple-500` accents); `motion/react` for animations; `lucide-react` icons.
- UI copy and domain naming use Warhammer 40k "Adeptus Mechanicus" flavor (rituals, Machine Spirit, sanctity) — preserve it.
- After major architectural changes, update `COGITATOR_GUIDELINES.md` and `README.md` to match the implementation (see guidelines §8).
