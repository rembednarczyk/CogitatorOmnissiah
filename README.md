# Cogitator Omnissiah

**Cogitator Omnissiah** synchronizuje nagrody literackie science‑fiction — **Hugo**, **Nebula** i **Locus** — z *Archiwum Encyklopedii Fantastyki* (MediaWiki) do osobistej bazy **Notion**. Zbiera zwycięzców i nominowanych, wzbogaca ich o wydawcę, serię i przynależność do cyklu, pilnuje integralności danych i pomaga śledzić postępy czytelnicze oraz szukać fizycznych egzemplarzy w bibliotece i na Vinted.

Interfejs i nazewnictwo utrzymane są w klimacie Warhammer 40k / Adeptus Mechanicus („rytuały synchronizacji", „Duch Maszyny", „sanctity") — to świadoma konwencja, którą należy zachować przy zmianach.

> **Uwaga o naturze projektu.** To osobiste narzędzie jednego użytkownika, nie usługa wieloosobowa. Endpointy nie są uwierzytelniane — uruchamiaj je za prywatnym hostingiem/siecią, nie wystawiaj publicznie bez własnej warstwy autoryzacji.

---

## Spis treści

- [Funkcje (rytuały)](#funkcje-rytuały)
- [Architektura](#architektura)
- [Struktura projektu](#struktura-projektu)
- [Wymagania wstępne](#wymagania-wstępne)
- [Konfiguracja Notion](#konfiguracja-notion)
- [Zmienne środowiskowe](#zmienne-środowiskowe)
- [Uruchomienie lokalne](#uruchomienie-lokalne)
- [Wdrożenie (Render)](#wdrożenie-render)
- [Referencja API](#referencja-api)
- [Potok synchronizacji książek](#potok-synchronizacji-książek)
- [Integralność i idempotencja danych](#integralność-i-idempotencja-danych)
- [Obserwowalność i diagnostyka](#obserwowalność-i-diagnostyka)
- [Rozwiązywanie problemów](#rozwiązywanie-problemów)
- [Testy](#testy)
- [Dokumentacja i konwencje](#dokumentacja-i-konwencje)

---

## Funkcje (rytuały)

Każda operacja to osobne, anulowalne zadanie strumieniowane do UI przez SSE.

| Rytuał | Endpoint | Co robi |
| --- | --- | --- |
| **Synchronizacja Nagród** (book sync) | `POST /api/sync` | Pobiera stronę nagrody z encyklopedii, parsuje zwycięzców i nominowanych, scala duplikaty (jedna książka = wiele nagród) i zapisuje/aktualizuje rekordy w Notion. |
| **Inicjacja Schematu** | `POST /api/sync-schema` | Zakłada/naprawia wymagane kolumny bazy Notion (typy, nazwa kolumny głównej). |
| **Puryfikacja** | `POST /api/sync-purify` | Czyści tytuły z pozostałości składni wiki i natywnego formatowania Notion. |
| **Wydawcy / Serie** | `POST /api/sync-publisher`, `POST /api/sync-series` | Dociąga wydawcę i serię ze strony każdej książki (z weryfikacją autora). |
| **Cykle** | `POST /api/sync-cycles` | Zaznacza „Część cyklu" na podstawie danych ze strony wiki. |
| **Rekonstrukcja Liczb (Lp)** | `POST /api/sync-lp` | Przenumerowuje kolumnę „Lp" wg roku i tytułu. |
| **Duplikaty** | `POST /api/sync-duplicates` | Wykrywa potencjalne duplikaty (tytuł + podobieństwo autora). |
| **Sanctity (Integralność)** | `POST /api/sync-integrity` | Porównuje bazę Notion z wiki: liczby per rok/nagroda, unikalność Lp/tytułów. |
| **Statystyki** | `GET /api/stats` | Agregaty do dashboardu (postęp autorów, roczników, pokrycie nagród, biblioteki). |
| **Skan Biblioteki** | `POST /api/library-check` | Sprawdza dostępność w OPAC MBP Lublin (scraping HTML). |
| **Skan Vinted** | `POST /api/vinted-check` | Szuka fizycznych egzemplarzy na vinted.pl (scraping HTML). |

**Rytuał Pełnej Synchronizacji** uruchamia sekwencję 1–7 (Schemat → Puryfikacja → Nagrody → Cykle → Wydawcy → Serie → Lp); przerwanie któregokolwiek kroku zatrzymuje całą sekwencję.

---

## Architektura

Hybryda **Vite + Express** serwowana z jednego procesu Node.

- **Frontend** — React 19 SPA (Tailwind CSS, `motion/react`, `lucide-react`). Całe pobieranie danych przez custom hooki (`useSync` to wzorzec SSE do wielokrotnego użycia). W dev serwowany przez Vite w trybie middleware; w produkcji jako statyczny build z `dist/`.
- **Backend** — Express. Długie zadania synchronizacji strumieniowane przez **Server‑Sent Events (SSE)**.
- **SyncManager** (`server.ts`) — orkiestrator: pojedyncze aktywne zadanie z własnym tokenem anulowania, współbieżność przez `p-limit`, zdarzenia postępu.
- **Adaptery** — `NotionAdapter`, `WikiAdapter`: czyste wrappery API bez logiki biznesowej. Rozróżniają „brak danych" od „awarii infrastruktury" (patrz [Obserwowalność](#obserwowalność-i-diagnostyka)).
- **Serwisy** (`/services/`) — po jednym na koncern synchronizacji, logika‑centryczne, w miarę bezstanowe.
- **Kontrolery / Trasy** — tylko parsowanie żądań i formowanie odpowiedzi SSE; delegują do serwisów.

Szczegóły zasad architektonicznych: **[`COGITATOR_GUIDELINES.md`](./COGITATOR_GUIDELINES.md)**.

### Stack

- **Frontend:** React 19, Tailwind CSS 4, Motion, Lucide‑React
- **Backend:** Node.js, Express, Axios
- **Integracje:** Notion SDK (`@notionhq/client`), MediaWiki API, OPAC MBP Lublin, vinted.pl
- **Narzędzia:** TypeScript (strict), Vite, tsx, esbuild, Vitest

---

## Struktura projektu

```
.
├── server.ts                # Express + SyncManager (orkiestracja, SSE, skan biblioteki/Vinted)
├── notion.adapter.ts        # wrapper Notion SDK (zapytania, zapis, schemat)
├── wiki.adapter.ts          # klient MediaWiki (fetch treści, kategorie, wyszukiwanie)
├── wiki.parser.ts           # ekstrakcja metadanych z wikitekstu (tabele nagród, {{tabela wydania}})
├── retry.ts                 # withRetry — backoff + honorowanie Retry-After
├── logger.ts                # strukturalny logger + klasyfikacja błędów HTTP
├── utils.ts                 # cleanTitle, sanitize, similarity, countCommonWords
├── controllers/             # parsowanie HTTP + warstwa SSE
├── routes/                  # definicje endpointów
├── services/                # logika biznesowa (jeden serwis = jeden rytuał)
│   ├── bookSyncService.ts   dataNormalizer.ts    diffEngine.ts
│   ├── duplicateSyncService.ts   publisherSyncService.ts   seriesSyncService.ts
│   ├── cyclesSyncService.ts      lpSyncService.ts          statsService.ts
│   ├── purificationService.ts    schemaValidationService.ts  integrityService.ts
├── src/                     # frontend React
│   ├── App.tsx  components/  hooks/  utils/  types.ts  constants.ts
├── docs/                    # szczegółowa dokumentacja algorytmów (per serwis)
├── render.yaml              # blueprint wdrożenia na Render
└── .claude/                 # hook SessionStart (npm install) dla Claude Code on the web
```

---

## Wymagania wstępne

- **Node.js 18+** (build celuje w `node18`; rozwijane na Node 20/22).
- Konto **Notion** z integracją i bazą danych.
- Testy działają bez żadnych sekretów — wszystkie usługi zewnętrzne są mockowane.

---

## Konfiguracja Notion

1. Utwórz **integrację** w [notion.so/my-integrations](https://www.notion.so/my-integrations) i skopiuj *Internal Integration Token* → to `NOTION_API_KEY`.
2. Utwórz (lub wskaż) bazę danych i **udostępnij ją integracji** (menu `•••` → *Connections* → wybierz integrację). Bez tego kroku Notion zwróci `object_not_found`.
3. Skopiuj **ID bazy** z URL (32‑znakowy ciąg) → to `NOTION_DATABASE_ID`.
4. Kolumny nie muszą istnieć wcześniej — uruchom rytuał **Inicjacja Schematu** (`/api/sync-schema`), który założy brakujące:

   | Kolumna | Typ |
   | --- | --- |
   | `Lp` | title (kolumna główna) |
   | `Autor`, `Rok`, `Wydawnictwo`, `Seria`, `Nagroda` | multi_select |
   | `Tytuł polski`, `Tytuł oryginalny` | rich_text |
   | `Część cyklu` | checkbox |

   Kolumna `Źródło` (multi_select) używana jest przez statystyki i skany do znaczników `Przeczytane`, `Biblioteka`, `Biblioteka 9`, `Posiadam`.

---

## Zmienne środowiskowe

Skopiuj `.env.example` do `.env` i uzupełnij:

| Zmienna | Wymagana | Opis |
| --- | --- | --- |
| `NOTION_API_KEY` | ✅ | Token integracji Notion. |
| `NOTION_DATABASE_ID` | ✅ | ID docelowej bazy Notion. |
| `PORT` | ➖ | Port serwera (domyślnie `3000`). |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | ➖ | Ustaw **obie**, aby włączyć ochronę hasłem (HTTP Basic Auth) na publicznym URL. Puste = brak autoryzacji. |

---

## Uruchomienie lokalne

```bash
npm install
npm run dev      # serwer dev (tsx server.ts) — API + frontend Vite na http://localhost:3000
```

Pozostałe komendy:

```bash
npm run build    # vite build + esbuild bundle server.ts → dist/server.cjs
npm start        # uruchom produkcyjny build (node dist/server.cjs)
npm run lint     # tsc --noEmit (tryb strict; brak osobnego lintera)
npm test         # vitest run (pełny pakiet)
npx vitest run <ścieżka>   # pojedynczy plik testowy
```

Port pochodzi ze zmiennej `PORT` (domyślnie `3000`).

> **Wskazówka.** Encyklopedia bywa chroniona przed ruchem z centrów danych. Jeśli synchronizacje działają lokalnie, ale nie na hostingu, zobacz [Rozwiązywanie problemów](#rozwiązywanie-problemów).

---

## Wdrożenie (Render)

Repozytorium zawiera blueprint **[`render.yaml`](./render.yaml)**:

- **Runtime:** Node
- **Build:** `npm install && npm run build`
- **Start:** `npm start`
- **Health check:** `/api/health`
- **Zmienne:** ustaw `NOTION_API_KEY`, `NOTION_DATABASE_ID` (oraz opcjonalnie `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD`) jako sekrety; `NODE_ENV=production`.

Możesz wdrożyć jako *Blueprint* (Render odczyta `render.yaml`) albo ręcznie jako *Web Service* z powyższymi ustawieniami. Na darmowym planie instancja usypia po ~15 min bezczynności (pierwsze wejście po przerwie trwa ~30–60 s).

SSE za proxy Rendera jest zahartowane po stronie serwera (padding wymuszający flush, `X-Accel-Buffering: no`, częsty keepalive) — patrz [Rozwiązywanie problemów](#rozwiązywanie-problemów).

---

## Referencja API

Wszystkie endpointy synchronizacji zwracają strumień **SSE** (`text/event-stream`) ze zdarzeniami `status` / `progress` / `complete` / `error`. Endpointy odczytu zwracają JSON.

| Metoda | Ścieżka | Opis |
| --- | --- | --- |
| GET | `/api/health` | Status serwera + `isSyncing`. |
| GET | `/api/config` | Obecność kluczy (booleany, bez sekretów). |
| GET | `/api/diagnostics` | **Diagnostyka end‑to‑end** (Notion + pobranie i parsowanie stron nagród) z podsumowaniem po polsku. |
| GET | `/api/stats` | Agregaty do dashboardu. |
| GET | `/api/notion/schema` | Bieżący schemat bazy. |
| PATCH | `/api/notion/schema` | Modyfikacja opcji właściwości. |
| GET | `/api/wiki/last-update` | Data ostatniej edycji strony wiki. |
| POST | `/api/sync` | Synchronizacja nagród (`{ awardName, pageTitle, syncAll }`). |
| POST | `/api/sync-schema`, `/api/sync-purify`, `/api/sync-publisher`, `/api/sync-series`, `/api/sync-cycles`, `/api/sync-lp`, `/api/sync-duplicates`, `/api/sync-integrity` | Pozostałe rytuały. |
| POST | `/api/library-check`, `/api/vinted-check` | Skany dostępności. |
| POST | `/api/mark-as-read` | Oznaczenie książki jako „Przeczytane". |
| POST | `/api/*/stop` | Zatrzymanie danego rytuału. |
| POST | `/api/sync/reset` | Awaryjny reset stanu synchronizacji. |

---

## Potok synchronizacji książek

1. **Zbieranie** — `WikiAdapter` pobiera wikitekst strony nagrody; `WikiParser`/`bookSyncService` parsuje tabelę zwycięzców i nominowanych (obsługa remisów, wierszy `rowspan`, książek wielu autorów, dodatkowej kolumny Retro Hugo, wykluczenia kategorii Locus YA).
2. **Scalanie i normalizacja** — jedna książka zdobywająca kilka nagród zostaje scalona w jeden rekord; `dataNormalizer` ujednolica autorów/wydawców/tytuły; przy Hugo + Nebula + Locus dokładany jest tag „Wszystkie".
3. **Zapis do Notion** — budowana jest mapa istniejących rekordów; nowe książki są tworzone, istniejące **porównywane pole po polu** i aktualizowane tylko przy realnej zmianie; brak zmian → pominięcie (oszczędność limitów API).
4. **Raport na żywo** — SSE strumieniuje `status`/`progress`, a `complete` niesie podsumowanie (dodane / zaktualizowane / pominięte / duplikaty).

Szczegóły algorytmów: **[`docs/`](./docs)** (patrz [indeks](./docs/README.md)).

---

## Integralność i idempotencja danych

- **Scalanie autorów, nie nadpisywanie** — autorzy dopisani ręcznie w Notion nigdy nie znikają.
- **Porównania case‑insensitive dla multi_select** — Notion dopasowuje opcje bez względu na wielkość liter i zachowuje własną pisownię, więc różnica samej wielkości liter nie wywołuje pozornych aktualizacji przy każdym syncu.
- **Najnowsze wydanie jest miarodajne** — wydawca i seria pochodzą z najnowszego wydania z `{{tabela wydania}}`, bez mieszania pól między wydaniami.
- **Weryfikacja autora** przy synchronizacji wydawców/serii/cykli — strona o tym samym tytule dotycząca innego dzieła nie nadpisze danych.
- **Rozróżnienie awarii od braku danych** — pełna awaria pobierania nie raportuje się jako „udany, pusty" sync (patrz niżej).

Decyzje projektowe (np. kategorie Locus, priorytet wydania) są udokumentowane w `docs/` i `COGITATOR_GUIDELINES.md` z adnotacją „nie naprawiać wstecz".

---

## Obserwowalność i diagnostyka

- **Strukturalny logger** (`logger.ts`) — jedna linia na wpis: `[POZIOM] [Komponent] wiadomość {kontekst}`. Bez sekretów.
- **Klasyfikacja błędów** — nieudane żądanie HTTP jest mapowane na przyczynę: `ip_blocked` (403/Cloudflare), `rate_limited` (429), `server_error` (5xx), `timeout`, `dns`, `http_error` — z podpowiedzią dla użytkownika.
- **`WikiFetchError`** — adapter wiki rzuca typowany błąd niosący klasyfikację i wskazówkę, którą kontroler pokazuje w UI.
- **`GET /api/diagnostics`** — jedno wywołanie sprawdzające Notion oraz pobranie i sparsowanie każdej strony nagrody; zwraca raport JSON z podsumowaniem po polsku. Najszybszy sposób ustalić, dlaczego sync nie działa. Dostępny też jako przycisk **„Uruchom Diagnostykę"** w karcie Status.

---

## Rozwiązywanie problemów

| Objaw | Prawdopodobna przyczyna | Co zrobić |
| --- | --- | --- |
| Sync kończy się błędem `ip_blocked` / HTTP 403 | IP serwera (np. hosting) jest blokowane przez encyklopedię/Cloudflare | Uruchom lokalnie / z innej sieci, albo użyj proxy o zaufanym IP. Potwierdź przez `/api/diagnostics`. |
| Notion: `object_not_found` | Baza nieudostępniona integracji lub błędne `NOTION_DATABASE_ID` | Udostępnij bazę integracji (*Connections*) i sprawdź ID. |
| „Sparsowano 0 książek" mimo pobrania strony | Zmieniony tytuł strony w encyklopedii lub układ tabeli | Sprawdź logi `[BookSync]` i tytuły w kodzie; porównaj ze stroną wiki. |
| UI „nie reaguje" / brak postępu na hostingu | Buforowanie strumienia SSE przez proxy | Zahartowane po stronie serwera (padding + `X-Accel-Buffering: no` + keepalive). Klient ma watchdog 30 s, który pokaże komunikat zamiast martwego UI. |

Zawsze zaczynaj od **`/api/diagnostics`** i logów — pole `summary` zwykle wprost wskazuje przyczynę.

---

## Testy

Vitest, uporządkowane w podkatalogach `__tests__/`:

- `/__tests__/` — infrastruktura, adaptery, serwer (`@vitest-environment node`)
- `/services/__tests__/` — logika biznesowa i serwisy synchronizacji
- `/src/__tests__/` — komponenty UI (JSDOM)
- `/src/hooks/__tests__/` — custom hooki (m.in. obsługa SSE w `useSync`)

Wszystkie usługi zewnętrzne (Notion SDK, axios) są mockowane przez `vi.mock`, więc testy działają bez sekretów.

```bash
npm test        # pełny pakiet
npm run lint    # type-check w trybie strict
```

---

## Dokumentacja i konwencje

- **[`COGITATOR_GUIDELINES.md`](./COGITATOR_GUIDELINES.md)** — autorytatywne zasady architektoniczne (backend, frontend, integralność danych, testy, design system). Obowiązują przy każdej zmianie.
- **[`docs/`](./docs)** — szczegółowa dokumentacja algorytmów per serwis ([indeks](./docs/README.md)).
- **[`CLAUDE.md`](./CLAUDE.md)** — zwięzła mapa projektu dla asystenta Claude Code.

Konwencje: Tailwind CSS (motyw glassmorphism, `slate-950` + akcenty `cyan-400`/`purple-500`), `motion/react` do animacji, `lucide-react` do ikon; nazewnictwo i teksty UI w klimacie Adeptus Mechanicus. Po większych zmianach architektonicznych aktualizuj `COGITATOR_GUIDELINES.md` i ten plik (zob. wytyczne §8).

---

*Ku chwale Omnissiaha — w służbie zachowania literackich artefaktów w epoce cyfrowej.*
