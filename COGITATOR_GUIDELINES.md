# COGITATOR OMNISSIAH: ARCHITECTURAL GUIDELINES (v1.5)

## 1. CORE ARCHITECTURE (BACKEND)
- **Pattern**: Service-Adapter-Manager.
- **Adapters**: `NotionAdapter`, `WikiAdapter`. Pure API wrappers. No business logic.
- **Services**: `*SyncService`, `StatsService`, `IntegrityService`, `PurificationService`, `SchemaValidationService`, plus the HTML scanners `LibraryCheckService` and `VintedSyncService`. Logic-heavy, stateless where possible. `SyncManager` stays a thin dispatcher — every long-running ritual lives in a service exposing `run*(sendEvent, checkCancellation)`; never inline scraping/sync loops back into `server.ts`. Scanners scrape public HTML (not Notion/Wiki APIs) and share `scrapingClient.ts` (User-Agent rotation + keep-alive HTTPS agent).
- **Orchestration**: `SyncManager` (in `server.ts`). Each task owns a `SyncTask` state object with its own cancellation flag; `executeTask` releases the lock only if it still belongs to the finishing task, and `resetSyncState` cancels the orphaned task before releasing the lock. Never reintroduce shared mutable booleans for task state.
- **Communication**: SSE (Server-Sent Events) for real-time progress. Use `sendEvent({ type, ... })`. Client-disconnect cancellation MUST listen on `res.on("close")`, NOT `req.on("close")` — for a POST with a body, `req` emits `close` when `express.json()` finishes reading the body (mid-response), which spuriously cancelled active syncs. Guard writes with `writableEnded`.
- **SSE hosting hardening**: proxies (e.g. Render) buffer streamed responses. `setupSSE` sends `X-Accel-Buffering: no`, `flushHeaders()`, a ~2KB comment padding to push past the buffer threshold, and a 5s keepalive. The client (`useSync`) has a 30s stall watchdog. Do not remove these.
- **Concurrency**: Use `p-limit` for external API calls (Notion/Wiki/OPAC).
- **Error Handling**: Distinguish "no data" from "infrastructure failure": `fetchPageContent` returns `""` for a missing page but THROWS a typed `WikiFetchError` on network failure/IP block; `fetchPagesContentBulk` returns `{ contents, failedTitles }` and services surface `failedTitles` in their error summaries. A sync must never report a clean `complete` when its data source was unreachable.
- **Observability**: use the structured `logger.ts` (`createLogger(component)`) and `classifyHttpError()` (maps failures to `ip_blocked`/`rate_limited`/`timeout`/`dns`/… with a user hint). `GET /api/diagnostics` is the end-to-end health check (Notion + parse each award page). Never log secrets — context objects carry metadata only.
- **Resilience**: `withRetry` handles transient network errors (socket hang up, timeout, ECONNRESET) with exponential backoff and honors `Retry-After` on 429 responses.
- **Security**: opt-in HTTP Basic Auth (`middleware/basicAuth.ts`) protects the whole service when `BASIC_AUTH_USER`+`BASIC_AUTH_PASSWORD` are set (`/api/health` stays open). Validate privileged mutations before forwarding to Notion — `updateNotionSchema` allows only `select`/`multi_select` and a well-formed `{ name }` option list. Encode/validate any request value interpolated into an outbound URL.

## 2. FRONTEND ARCHITECTURE (REACT)
- **Component Decomposition**: Strict SRP. UI components in `src/components/` (atomic parts in subdirs like `stats/`).
- **SSE Parsing**: All streaming hooks MUST buffer chunks across TCP reads (`buffer += decoder.decode(value, { stream: true })`, split on `\n\n`, keep the remainder) — see `useSync`. Never `JSON.parse` a raw chunk line-by-line.
- **Logic Isolation**: No `useEffect` for data fetching in components. Use Custom Hooks:
  - `useSync`: Standard for all long-running server operations.
  - `useStats`: Global dashboard data.
  - `useLibraryCheck`: Isolated library scanning state.
  - `useConfig`: Notion schema and connection status.
  - `useWikiUpdates`: Tracking recent changes in the encyclopedia.
- **Styling**: Tailwind CSS only. Theme: Glassmorphism, `slate-950` background, `cyan-400` / `purple-500` accents.
- **Animations**: `motion/react` (Framer Motion). Use for entry/exit and progress bars.
- **Dynamic UI**: Progress bars and summary cards SHOULD inherit the color of the active ritual (passed via `SyncState.color`) to provide visual feedback and reinforce ritual identity.

## 3. DATA INTEGRITY & SYNC LOGIC
- **Duplicate Detection**: Multi-signal (Title PL, Title Orig, Author Similarity, Common Words).
- **Purification Ritual (SRP)**: Deep cleaning (Wiki syntax stripping, native Notion formatting removal) is EXCLUSIVE to `PurificationService`. `BookSyncService` stays with simple whitespace normalization to avoid scope creep.
- **Wiki Parser Priority**: When extracting from `{{tabela wydania}}`, always pick the highest indexed `informacjaN` that is NOT empty, and take both `wydawca` and `seria` from that single (latest) edition — never backfill an empty field from an older edition (the latest edition is authoritative so the data mirrors current reality). Fallback to `{{Książka}}` only if no valid `infowydanie` is found.
- **Locus Categories**: Exclude only the YA category ("Powieść dla młodzieży"). All other Locus categories (incl. Horror/Dark Fantasy and Pierwsza powieść) are intentionally synced as "Nagroda Locus".
- **Idempotency (multi_select)**: Compare multi_select values (authors, publisher, series, awards) CASE-INSENSITIVELY, and normalize BOTH the wiki and the existing-Notion side before comparing. Notion matches option names case-insensitively and keeps its own casing, so comparing a normalized new value against a raw Notion value re-updates the field on every sync forever. Authors are MERGED (union), never replaced — manual Notion authors must survive.
- **Notion Schema**: Always check for column existence before writing. Handled by `SchemaValidationService`.
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

## 5. TOKEN OPTIMIZATION (AI INSTRUCTIONS)
- **Surgical Edits**: Use `edit_file` with precise `TargetContent`. Never replace whole files.
- **Context Awareness**: Read `package.json` and `server.ts` imports before adding new services.
- **Conciseness**: Skip apologies and meta-talk. Execute -> Summarize.
- **Reuse**: Reference `useSync` patterns instead of re-implementing SSE handling.

## 6. DESIGN SYSTEM
- **Font**: Display (Headings) = Tracking-tighter, uppercase. Body = Sans.
- **Icons**: `lucide-react`.
- **Palette**: `cyan-500` (primary), `purple-600` (secondary), `slate-900/20` (glass).

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
  - `docs/cycles-sync.md`: Book Cycles Detection.
  - `docs/vinted-scanner.md`: Vinted Market Search (direct HTML scraper — NOT AI).

## 8. DOCUMENTATION & MAINTENANCE
- **Self-Correction**: After every major architectural change or logic fix (e.g., new service, parser update), the AI Agent MUST review and update `COGITATOR_GUIDELINES.md` and `README.md`.
- **Version Control**: Increment the version in the header if significant changes are made.
- **Consistency**: Ensure that `README.md` descriptions match the actual implementation in `services/`.
