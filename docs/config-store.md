# Config store — knoby aplikacji

Parametry aplikacji (dawniej hardcode) są konfigurowalne i składowane w Notion **bez osobnej tabeli ani sentinel-row** — jako diff-od-defaultów JSON w **opisie kolumny `AppConfig`**. Sentinel-row odrzucony świadomie: rytuały iterujące wiersze by go dotykały.

## Warstwy

- **`src/configSchema.ts`** (współdzielony, zero zależności Node) — jedno źródło prawdy:
  - `AppConfig` typ + `DEFAULT_CONFIG` (sekcje: `vinted`, `scraping`, `library`, `sync`, `ui`).
  - `mergeConfig(input)` — nakłada nadpisania na defaulty, clampuje/typuje (pas bezpieczeństwa).
  - `diffFromDefaults(cfg)` — zwraca TYLKO różnice od defaultów (to składujemy).
  - `parseStoredConfig(raw)` — bezpieczny parser blobu (uszkodzony → puste nadpisania).
- **`services/configService.ts`** — efektywna konfiguracja = `mergeConfig(parseStoredConfig(raw))`, cache 30 s. Odczyt odporny: uszkodzony blob / brak kolumny / błąd Notion → defaulty (aplikacja nigdy nie pada od configu). Zapis: `mergeConfig` → `diffFromDefaults` → JSON (limit rozmiaru), `saveAppConfigRaw`.
- **`notion.adapter.ts`** — `getAppConfigRaw`/`saveAppConfigRaw` czytają/piszą tylko surowy string w opisie kolumny. Bez parsowania/mergowania (to `ConfigService`). Adapter zostaje czysty.
- **API**: `GET /api/app-config` (efektywna konfiguracja; `?force=1` pomija cache), `PUT /api/app-config` (zapis, zwraca efektywną po zapisie).

## Frontend

- **`src/hooks/useAppConfig.ts`**:
  - `useEffectiveConfig()` — dla KONSUMENTÓW (regał, skanery, nagrody): jedno pobranie na sesję (cache modułowy), `DEFAULT_CONFIG` do czasu odpowiedzi, brak stanów błędu.
  - `useAppConfig()` — dla PANELU: świeże pobranie + draft + `save` (po zapisie unieważnia cache konsumentów).
  - `persistStatsOrder(order)` — utrwala `ui.statsOrder` bez otwierania panelu; NIE zapisuje, gdy wczytanie configu padło (guard `!cachedConfig`), by nie nadpisać knobów defaultami.
- **`ConfigSection.tsx`** — zakładka „Sanktuarium Kalibracji" (otwiera klik w logo): edytory knobów (Vinted, pula User-Agent, filie biblioteczne, nagrody, zaawansowane). Uwaga: polskie cudzysłowy w atrybutach JSX psują parser — używać `{'...'}`.

## Konsumenci knobów

`vintedSyncService`, `libraryCheckService`, `scrapingClient` (pula UA), `bookSyncService`/`duplicateSyncService` (progi), `statsService` (filie), regał (`ui.shelfRowsPerPage`/`preciseShelfDrop`) — wszyscy czytają przez `ConfigService`/`useEffectiveConfig`, nie z hardcode.
