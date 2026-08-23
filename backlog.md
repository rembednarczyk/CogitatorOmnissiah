# Backlog & State — Cogitator Omnissiah

> **Trwała pamięć projektu.** Ten plik jest źródłem prawdy o stanie prac, ustaleniach
> i findingsach — tak, żeby okno kontekstowe można było w dowolnym momencie `/clear`-ować
> bez utraty wiedzy. Zasady prowadzenia tego pliku: patrz `CLAUDE.md` → „Workflow rules".

## Jak używać

- **Na starcie sesji**: przeczytaj ten plik zanim zaczniesz pracę.
- **Po każdej zmianie / ustaleniu**: dopisz finding, decyzję lub odhacz pozycję —
  zanim zrobisz `/clear`. Plik ma odzwierciedlać stan HEAD, nie historię czatu.
- **Format**: findings i decyzje idą do sekcji poniżej; wpisy wersji do „Changelog".
- Trzymaj zwięźle: jedna linia = jeden fakt. Rozwlekłe analizy zostają w `docs/`.

## Stan bieżący

- Wersja aplikacji: **1.15.8** (źródło prawdy: `metadata.json`; mirror w `package.json` + `package-lock.json`).
- Branch roboczy: `claude/book-aggregator-setup-t6kfvd`. Deploy leci z `main` — zmiany
  muszą trafić na `main` (PR + merge), inaczej redeploy serwuje stary kod.
- **Konwencja PR/issue**: jedna logiczna zmiana = jeden granularny PR (nie batchujemy).
  Każde zadanie śledzimy issue i domykamy przez `Fixes #N` w opisie PR (linkowanie +
  auto-close). Nie tworzymy sztucznych PR-ów/issue bez realnej wartości.
- Suite: 187+ testów zielonych; `npm run lint` (tsc) czysty.

## Findings & decyzje (aktualne)

- **Vinted DOM drift (rozwiązane, PR #52)** — Vinted przeszedł na Next.js z hashowanymi
  klasami CSS-modules (`Grid-module-scss-module__…__feed-grid__item`) i przestał emitować
  blob `data-component-name="Catalog"`. Parser dopasowuje kafelki po stabilnym suffiksie
  `feed-grid__item"`, wyciąga cenę strukturalną, walutę, czysty URL i miniaturę
  `images1.vinted.net`. Szczegóły: `docs/vinted-scanner.md`.
- **Vinted `parsed:0` bywa POPRAWNE** — wyszukiwarka Vinted jest rozmyta i zwraca
  sąsiednie tytuły. Potwierdzone jako słuszne 0: „Dzieci nocy" (Simmons; same „…nocy"),
  „Eden w ogniu" (Simmons). `parsed:0` nie oznacza automatycznie buga parsera —
  weryfikuj po `itemLinks` vs faktyczne tytuły.
- **Vinted „skaner sam się ubija" (#2) — ROZWIĄZANE (1.0.4).** Root cause POTWIERDZONY
  logami Rendera: NIE watchdog, tylko `JavaScript heap out of memory`. Heap rósł
  monotonicznie ~10 MB/książkę do ~268 MB (pełny GC nie zwalniał → żywa retencja).
  Przyczyna: V8 **SlicedString** — `str.match()`/`.split()` na 7 MB HTML zwraca podstring
  trzymający wskaźnik do CAŁEGO rodzica; pola oferty (title/url/price/photo) trafiały do
  `results` i pinowały 7 MB na każde trafienie. Fix: `detach()` (kopia bajtów przez
  Buffer) na polach z HTML w `parseVintedItems` ścieżki 3/4. KROK 1 (watchdog 120 s,
  1.0.2) był ślepy — skan padał WCZEŚNIEJ (26 vs 28), co wykluczyło watchdog.
- **NIE skracaj timeout/retry scrapera** — #48 to zrobił (30→15 s) i dał zero trafień
  (ucinał wolne, poprawne odpowiedzi Cloudflare). Cofnięte (#49). Timeout zostaje 30 s.
- **Skan na Render free: ~160 poz./przebieg** — długi skan (~214 poz., 15–20 min) bywa
  ucinany, gdy klient się rozłączy (tło karty / blip) → serwer `res close` →
  `stopActiveSync()`, a potem kontener zwija się po idle. To infra (Render free), NIE
  kod — OOM naprawiony (1.0.4). Trwały fix: odpiąć skan od połączenia SSE (skan leci
  serwerowo, UI podgląda + wpina się ponownie) + płatny tier/kolejka. ODŁOŻONE — na
  free i tak brak pełnej gwarancji; na razie dokańczamy w kilku przebiegach.
- **Sprzedawca NIE jest w HTML katalogu Vinted** — kafelek oferty ma tylko
  url/tytuł/cena/foto; brak `user_id`/`/member/` w kafelku (zweryfikowane na view-source).
  Bundling „kilka książek u jednego sprzedawcy" wymaga dociągnięcia sprzedawcy z osobnego
  źródła (strona `/items/{id}` albo `/api/v2/items/{id}` / catalog API) — czyli backend.
- **Marker debug `grid` vs `html`** — `html` w logach skanera oznacza, że oferty złapał
  tylko fallback (ścieżka 4), a nie siatka. Po wdrożeniu fixu na stronach z siatką ma
  być `grid`. Jeśli po redeployu dalej `html` na stronie z siatką → deploy serwuje
  stary bundle / nie odpalił `npm run build`.

## Changelog

Wersja ze źródła prawdy `metadata.json` (mirror w `package.json`). Najnowsze na górze.

- **1.15.8** — Audyt #2 krok 1/4 (#102): rozbicie God-Component `SyncSummaryResult` 256 → 25
  linii (dispatch). Panel listy powielony 5× → `sync/SummaryDetailPanel` (4×) + jeden gęsty
  inline w `FullSyncSummary`; stat-grid → `sync/StatCard`; clipboard → hook `useCopyToClipboard`;
  dwa tryby → `FullSyncSummary`/`SingleSyncSummary`. Zachowanie 1:1, 270 testów.
- **1.15.7** — Bughunt po zmianach (#100). 4 audyty (useSSEStream, vintedSyncService, rozbicie
  VintedCheckItem = FAITHFUL/czyste). 2 realne bugi w nowych featurach naprawione:
  (1) Regał: wyścig drag&drop — zapisy per-książka SERIALIZOWANE (latest-wins, `pendingRef`/
  `runningRef`), koniec nakładających się nieatomowych RMW rozjeżdżających Notion z UI.
  (2) Skryptorium/Regał: `useBooks` startuje `loading=true` (fetch w useEffect po paint dawał
  mignięcie pustego stanu); SearchSection rozróżnia pusty-query („Archiwum jest puste") od braku
  trafień. Minor „overrides nie czyszczone" — poprawne przy single-fetch, zostawione.
- **1.15.6** — `useSSEStream` (deferred z audytu god-object): wspólny transport SSE
  (POST → `res.ok` → `consumeSSE` + watchdog + derywacja komunikatu błędu/stall). Trzy hooki
  streamowe zbudowane na nim, różnią się tylko routingiem zdarzeń: `useSync` 154→100 (koniec
  inline-watchdoga — teraz `createStallWatchdog` przez primitive), `useVintedCheck` 168→145,
  `useLibraryCheck` 121→89 (usunięty antywzorzec `new Promise(async…)` — `checkLibrary` to
  zwykły async). +4 testy. Drobna zmiana: błąd HTTP biblioteki pokazuje realny komunikat
  serwera zamiast hardkodu. Zachowanie poza tym 1:1 (komunikaty stall zachowane, useSync ma
  swój dłuższy wariant). CLAUDE.md zaktualizowany. `notion.adapter` — dedup
  `add`/`removeTagFromMultiSelect` → prywatny `mutateMultiSelect(pageId, prop, transform)`
  (retrieve→mutate→update w jednym miejscu; `transform` zwraca `null` = no-op). Zachowanie 1:1.
  DEFERRED (opcjonalne, medium): pełny split adaptera na Source/SchemaAdmin/BookRepository,
  ewikcja literałów domeny (`VintedData`/`Wydawnictwo`/`Lp`) i `useSSEStream` (3 hooki streamowe
  duplikują szkielet fetch+watchdog+routing). Cały audyt god-object zamknięty (kroki 1–5).
- **1.15.4** — God-object krok 4/5 (#91): `vintedSyncService` 409 → 283 linii. Pure logic
  wyjęta do testowalnych helperów: `vintedScanPlanner` (`selectAndOrderCandidates`/`scannedMs` —
  filtr kandydatów + okno „Kontynuuj" + sort od najstarszych, `now` wstrzykiwalny), `vintedHttp`
  (`vintedRequestHeaders`/`memMb`/`throttle`/`classifyVintedError` — dedup 4× jitter-sleep i
  gałęzi 429/403), `looksEmpty` w parserze (obok `looksBlocked`), `computeChangedAt`+`toStoredBookView`
  w store. Dedup 2× guard „persist empty tylko gdy nic nie było" → prywatny `persistEmptyIfNew`.
  Zachowanie (SSE, kolejność, guardy) 1:1, +13 testów. Klasy NIE rozdzielałem (ryzyko DI/registry) —
  opcjonalny split scan/seller/store-view zostaje jako deferred.
- **1.15.3** — God-object krok 3/5 (#91): `useSyncManager` (God-Hook). „Wielki Rytuał" opisany
  DANYMI (`FULL_SYNC_STEPS[]` + pętla; 7× copy-paste → 1 pętla, `abortOnFail` per krok).
  `handleAwardChange` przyjmuje `string` (nie `ChangeEvent`) — parsowanie `<select>` zostaje w
  `SyncAwards` (manager niezależny od prezentacji, zgodnie z GUIDELINES §2). Zachowanie bez zmian.
- **1.15.2** — God-object krok 2/5 (#91): rozbicie God-Component `VintedCheckItem` **528 → 75
  linii**. 6 komponentów w `src/components/stats/vinted/`: `VintedScanControls`, `VintedScanProgress`,
  `VintedDebugLog`, `VintedResolveStatus`, `VintedBundleList` (własny `bundleSort`), `VintedBookResultList`
  (+ wewn. `OfferRow`). Parent = kompozycja + wybór źródła danych + handlery cross-domain. Zachowanie bez zmian, 253 testy.
- **1.15.1** — God-object audyt + krok 1/5 (#91): ekstrakcja czystych helperów z God-Component
  `VintedCheckItem` (528 l.) do `src/utils/vintedFormat.ts` (`shortDate`, `formatDebug`,
  `isBookChanged`, `offerBadges`) — ~40 linii logiki-w-JSX out, +8 testów. Audyt SRP wykazał
  4 winowajców: VintedCheckItem (God-Component), `useSyncManager` (God-Hook: rejestr+polityka+
  7-krokowa saga+parsing DOM), `vintedSyncService` (`runVintedCheck` god-metoda 225 l. + 3
  concerny/klasa), `notion.adapter` (God-Adapter: literały domeny + dup metody). Oczyszczone:
  `syncController` (płaski), `useSync` (wzorzec). Dekompozycja w krokach 2–5.
- **1.15.0** — „Regał Archiwum" (#89): zakładka z wizualizacją księgozbioru jako fizyczne
  półki (koncept A grzbiety + B półka okładek „Wyróżnione"=read+nagroda). Dwa regały „Do
  przeczytania"/„Przeczytane" z **drag&drop** (HTML5 DnD); upuszczenie zapisuje/usuwa tag
  „Przeczytane" w „Źródło" (optymistyczny stan `overrides` + revert przy błędzie). Backend:
  `removeTagFromMultiSelect` + `syncManager.unmarkRead` + `POST /api/unmark-as-read` (guard
  `ALLOWED_SOURCE_TAGS`), symetryczne do `markAsRead`; cache książek inwalidowany. Czyste
  `src/utils/bookshelf.ts` (`spineStyle` deterministyczny, `splitShelves`, `featuredReads`).
  BUG złapany testem: `h >> 3` (znakowe) → ujemne dla hashów >2^31 → `>>> 3`. +9 testów.
- **1.14.0** — Paczki Vinted: przełącznik sortowania „Najwięcej książek" / „Najtańsza paczka".
  Czysta `sortBundles(bundles, mode)` (`count`: najwięcej książek → remis najtańsza suma;
  `price`: najtańsza `totalValue` → remis najwięcej książek), zwraca kopię (bez mutacji).
  `groupBySeller` deleguje do `sortBundles(..,"count")`. Toggle w nagłówku paczek. +3 testy.
- **1.13.1** — Skryptorium (#84): klik podpowiedzi podmienia TYLKO ostatni token (czysta
  `replaceLastToken`), nie całe pole. „Greg Vear" + „Bear" → „Greg Bear" (nie samo „Bear").
  Fokus wraca do inputu. +4 testy.
- **1.13.0** — Skryptorium „Czy chodziło Ci o…" (#82): fuzzy-podpowiedzi na literówki. Gdy
  `matchBooks`=0, `didYouMean` liczy Levenshteina między OSTATNIM tokenem zapytania a słownikiem
  `buildSearchVocab` (słowa tytułów PL+oryg + autorów, dedupe po foldzie, display z wielką literą);
  próg wg długości (≤4→1, ≤7→2, dłuższe→3), odsiew po |Δlen|, pomija dystans 0. UI: klikalne
  „Perelandra?" ustawia query. +6 testów. Wszystko client-side.
- **1.12.1** — Skryptorium fixy (#80): (1) indeks dopuszcza rekordy z tytułem PL **lub**
  oryginalnym (nieprzetłumaczone książki wypadały — 684 pokazywało ~389); karta/ranking
  używają tytułu efektywnego `plTitle || origTitle`. (2) badge nagród i tagi źródła w dwóch
  osobnych wierszach (ikony `Award`/`Tag`). (3) zakładki równej szerokości (`sm:flex-1` +
  `items-stretch`, `tracking-wide`, `px-4`). +1 test (origTitle-only).
- **1.12.0** — „Skryptorium": wyszukiwarka rekordów archiwum (4. zakładka). Nowy
  `GET /api/books` zwraca odchudzony `BookIndexEntry[]` (mapper `services/bookSearchIndex.ts`,
  reużywa `getBooksForStats({cache})`). Front filtruje CAŁOŚĆ client-side (`useBooks` fetch raz,
  `src/utils/bookSearch.ts`: fold diakrytyków per-znak — 1:1 na długość → highlight; `matchBooks`
  AND-po-tokenach po tytule PL+oryg+autor; ranking prefiks>substring). `useDeferredValue` (React 19)
  trzyma input płynny. `per`→wiele, `pere`→Perelandra. UI: `SearchSection` + `search/BookResultCard`
  (badge nagród/źródła/cykl) + `HighlightedText`. +10 testów matchera. RENDER_CAP=150.
- **1.11.2** — Oznaczanie cykli: naprawa „czasem nie łapie". Root cause = CICHE pominięcia:
  gdy nie znaleziono strony wiki (niedopasowany tytuł) lub autor się nie zgadza, książka była
  `return`-owana bez śladu, a `complete` raportował sam sukces. Teraz `syncSummary.skipped`
  zbiera pominięte z powodem (nie znaleziono strony / autor się nie zgadza), a wynik niesie
  `cyclesDetected` + `skipped`; `SyncSummaryResult` pokazuje listę „Pominięte — nie oceniono".
  Regex szablonu poszerzony `\{\{Cykl\s*\|` → `\{\{\s*cykl[\s|}]` (łapie `{{Cykl}}` i
  `{{Cykl nawigacja|…}}`, wciąż odrzuca `{{Cyklista}}`). Zweryfikowane na realnym rawie
  „Inny"/Dickson: `|cykl = Childe` JEST łapane (regex pola OK), pusty `|cykl=` = false,
  `|seria=` świadomie pomijane (imprint wydawcy). +5 testów.
- **1.11.1** — Metadane (rok + ikonka „cykl") także w PACZKACH sprzedawców, nie tylko na
  kafelkach. `SellerBundleEntry` niesie `bookYear`/`bookPartOfCycle` (z `VintedResult`),
  `groupBySeller` je przepisuje, a wpis paczki pokazuje rok przy autorze i badge „cykl".
- **1.11.0** — Kafelki z bazy bogatsze o metadane z Notion (bez scrapowania): rok wydania
  (kolumna „Rok") przy autorze i ikonka „cykl" (kolumna „Część cyklu"=true) — sygnał
  ryzyka „kolejny tom". `getStoredData` niesie `year`/`partOfCycle`; `storedToView` + kafelek
  je pokazują.
- **1.10.2** — „Kontynuuj" naprawione: skan zawsze OD NAJSTARSZYCH (`scannedAt` rosnąco,
  nigdy-skanowane pierwsze), a okno pomijania w GODZINACH (`skipScannedWithinHours`, dom.
  12 h) zamiast dni. Bug: po częściowym pełnym skanie (160 dziś + reszta wczoraj) „Kontynuuj"
  (3 dni) pomijał WSZYSTKO < 3 dni → silent drop. Teraz pomija tylko bieżącą partię (< 12 h),
  a wczorajsze/starsze robi od najstarszych.
- **1.10.1** — Bughunting runda 2 (3 agenty). NAPRAWIONE: (dane) gałąź „Brak wyników"
  kasowała oferty bez guardu `hadStored` (fałszywy substring w 7 MB) → teraz nie nadpisuje;
  (change-detect) pierwszy skan/migracja fałszywie oznaczały „zmiana"/„nowa" → `changedAt`
  tylko przy baseline, survivor zachowuje oryginalny `firstSeenAt` (undefined dla starych
  blobów), „nowa" wymaga changedAt===scannedAt; dedupe URL w `mergeAndDiff`; (UI) wyścig
  wczytania z bazy porywał widok po starcie skanu/resolucji → pokolenie+abort w
  `useVintedStored` + `clearStored` na starcie resolucji; stabilny klucz miniatur;
  brak podwójnej notki pustego stanu; (infra) `res.on('error')` w SSE (koniec uncaughtException),
  guard kluczy Notion na resolve/stored. Reszta infra: czyste (lock, cache, agent, chunking).
- **1.10.0** — Wykrywanie zmian przy odświeżaniu. `mergeAndDiff` (zamiast `mergeOffers`):
  liczy nowe/zniknięte/spadek/wzrost ceny, zachowuje sprzedawcę + `firstSeenAt`, zapisuje
  `prevPrice`; `changedAt` w blobie (kiedy ostatnio się zmieniło). Widok z bazy: badge
  książki „zmiana", oferty „nowa" i „−X zł" (spadek); diff też w logach debug (Δ +/−/↓/↑).
  Odświeżanie = re-scan (Kontynuuj/pełny) — bez zmian, teraz z widoczną deltą.
- **1.9.1** — Bughunting (3 agenty). NAPRAWIONE: (KRYTYCZNE) re-scan z blokadą/missem parsera
  kasował składowane oferty i sprzedawców — `looksBlocked` teraz `continue` (nie kasuje,
  nie stempluje scannedAt → wznowienie ponawia), a „0 ofert bez markera" nie nadpisuje,
  gdy wcześniej coś było. (UX) skan z widoku bazy chował świeże wyniki → `clearStored` na
  starcie; start skanu zablokowany w trakcie resolucji (nieanulowalność); pusty odczyt bazy
  ma notkę. Odrzucone jako nie-bug po weryfikacji na realnym HTML: /member regex (seller to
  jedyny numeryczny link), aria-label ceny (ochrona na początku, wygrywa węzeł tekstowy).
- **1.9.0** — Usunięto live-grupowanie (przyciski „Najtańsze"/„Wszystkie oferty" — Rytuały
  Kartelu) zastąpione ścieżką bazodanową (Ustal sprzedawców → Wczytaj z bazy). Wycięty
  martwy kod: hook `useVintedGrouping`, endpoint `/api/vinted-group` (+task, controller),
  metoda `resolveSellers` (live). `groupBySeller`/`storedToView` zostają (paczki z bazy).
  Sprzedawcy do paczek pochodzą teraz wyłącznie z bazy; live scan pokazuje same kafelki.
- **1.8.0** — Przyciski skanera w stylu rytuałów liturgii synchronizacji. Nowy reużywalny
  `RitualButton` (ciemna baza slate-950 + kolorowy hover-glow/scale + ikona w boxie +
  „Rytuał X" + uppercase podtytuł); motyw rozszerzony o `ritualButtonTheme` (literały klas).
  Akcje skanera przeniesione z „głośnych" pilli do siatki rytuałów (Skanowania /
  Identyfikacji Handlarzy / Przywołania z Archiwum / Kartelu). Checkbox „Kontynuuj" i
  logi zostają w nagłówku. Test App zaktualizowany do nowych etykiet.
- **1.7.1** — „Ustal sprzedawców (baza)": zdjęty cap 150 (domyślnie bez limitu — jeden
  przebieg ustala wszystkie brakujące). Bezpieczne dzięki wznawialności (zapis raz/książkę)
  i throttlingowi (to on chroni rate, nie liczba total). `cap` z body wciąż opcjonalny.
- **1.7.0** — Skan taguje źródło: książka z ofertami na Vinted (match) dostaje tag
  „Vinted" w kolumnie Źródło (`addTagToMultiSelect`, best-effort, guard po `zrodlo` by
  nie pisać zbędnie przy re-scanie). Tylko dodaje; nie usuwa gdy oferta zniknie.
- **1.6.0** — Vinted skan wznawialny: checkbox „Kontynuuj" (dom. ON) pomija książki
  skanowane < 3 dni (`skipScannedWithinDays` z `scannedAt` w blobie) → skan rusza od
  niezrobionych zamiast od zera. Łagodzi limit ~160/kontener i drop połączenia na mobile
  (przełączenie apki usypia kartę → SSE pada → serwer anuluje; teraz po prostu wznawiasz).
- **1.5.0** — Vinted persystencja ETAP 3 (domknięcie): grupowanie i kafelki Z BAZY bez
  re-scrape. `getStoredData` (`GET /api/vinted-stored`) czyta bloby wszystkich książek;
  czysty `storedToView` mapuje na VintedResult[] + sellersByUrl + zakres świeżości.
  Hook `useVintedStored`, przycisk „Wczytaj z bazy"/„Wyczyść", baner „Dane z bazy" +
  `scannedAt` na kafelku. Kafelki i paczki reużywają istniejący render.
- **1.4.0** — Vinted persystencja ETAP 2: przyrostowe dociąganie sprzedawców DO BAZY.
  `resolveSellersToStore` czyta składowane oferty bez sprzedawcy, dociąga (throttled,
  cap 150/przebieg, wznawialne — rozpoznani zostają w blobie), zapisuje raz/książkę.
  Task `vinted-resolve-sellers`, endpoint `POST /api/vinted-resolve-sellers`, hook
  `useVintedResolveSellers`, przycisk „Ustal sprzedawców (baza)" + postęp/wynik.
- **1.3.0** — Vinted persystencja ETAP 1 (fundament): wyniki skanu zapisywane do Notion
  (blob JSON w polu `VintedData`, chunk ≤2000 zn., mapper skleja). `vintedStore` (pure:
  serialize/parse/merge — merge ZACHOWUJE sprzedawcę dla ofert z niezmienionym URL).
  Skan zapisuje per książka best-effort (match/0 ofert) + `scannedAt`. Adapter:
  `saveVintedData` + `createColumnIfNeeded("VintedData")`. Payoff (grupowanie/kafelki
  z bazy) = ETAP 2/3, następne PR.
- **1.2.0** — Vinted grupowanie: tryb „Wszystkie oferty" (obok „Najtańsze"). „Wszystkie"
  dociąga sprzedawcę KAŻDEJ oferty (cap 150 + raport pominięć), ujawnia many-to-many
  (dopłać grosze, skonsoliduj przesyłkę). `groupBySeller` bierze najtańszą kopię per
  sprzedawca/książkę i liczy dopłatę vs najtańsza globalnie (`premium`/`totalPremium`),
  pokazaną w UI. Backend bez zmian (ten sam `resolveSellers`, tylko więcej URL-i).
- **1.1.0** — Vinted: grupowanie per sprzedawca (on-demand, „low hanging fruit").
  Przycisk „Grupuj per sprzedawca" dociąga sprzedawcę ze strony najtańszej oferty każdej
  książki (`extractVintedSeller`: `/member/{id}` + `data-testid="profile-username"`),
  serwis `resolveSellers` (SSE, throttling jak skan, cap 100, zdarzenie `seller_resolved`),
  endpoint `POST /api/vinted-group`, czysty `groupBySeller` (≥2 książki) + sekcja UI.
- **1.0.4** — Skaner Vinted: self-kill NAPRAWIONY (KROK 3). Root cause POTWIERDZONY logami
  Rendera: `JavaScript heap out of memory` przy ~268 MB, heap rósł monotonicznie
  ~10 MB/książkę (pełny GC nie zwalniał). Przyczyna: V8 SlicedString — pola oferty
  wyłuskane regexem z 7 MB HTML trzymały wskaźnik do całego rodzica, a `results` je
  akumulowało → każde trafienie pinowało 7 MB. Fix: `detach()` (kopia bajtów) na polach
  z HTML w `parseVintedItems` (ścieżki 3/4). Zero zmian w timingu.
- **1.0.3** — Skaner Vinted: self-kill debug KROK 2 (obserwowalność pamięci). `rssMb`/
  `heapMb` w debug każdej próby + log serwera. KROK 1 (watchdog 120 s) NIE pomógł —
  skan padł nawet wcześniej (26 vs 28), co wyklucza front-owy watchdog. Nowa hipoteza:
  OOM-kill na Render (strony ~7 MB × ~27 → piki pamięci > 512 MB). Zero zmian w timingu.
- **1.0.2** — Skaner Vinted: self-kill debug KROK 1. Front-owy stall-watchdog dla Vinted
  30 s → 120 s (izolowana bezpieczna połowa cofniętego #48; NIE rusza timeout/retry
  scrapera, więc nie zmniejsza trafień). Pokrywa worst-case ~102 s ciszy na jednej
  wolnej/blokowanej książce. Zakres: tylko `useVintedCheck`.
- **1.0.1** — Vinted parser dostrojony do aktualnego DOM Vinted (siatka feed-grid po
  hashowanej klasie, cena strukturalna + miniatury; fix `hasFeedGrid`). Wprowadzenie
  wersjonowania w `metadata.json` i trwałej pamięci `backlog.md`. (PR #52 + workflow rules)
- **1.0.0** — Stan bazowy.

## Otwarte pozycje

- (brak) — pipeline persystencji Vinted (ETAP 1–3) kompletny.
- **Ewentualnie później**: odświeżanie pojedynczej książki/oferty z bazy (re-check
  świeżości), natywna baza „Vinted Offers" (jeśli blob przestanie wystarczać), proxy
  rezydencjalne dla ominięcia 403.
- **Cykle: sąsiednie tomy** (pomysł, analiza 1.11.1) — dla książek „Część cyklu"
  pokazywać/szukać wcześniejszych/późniejszych tomów; sąsiednie tomy mogą NIE być w bazie.
  - **Kluczowy finding**: `cyclesSyncService` już parsuje `|cykl=` / `{{Cykl|…}}` z wikitekstu,
    ale zapisuje TYLKO boolean „Część cyklu" (linie 41–131) — nazwę cyklu i listę tomów
    z szablonu `{{Cykl}}` wyrzucamy. Tu jest źródło danych: rozszerzyć ten sam rytuał,
    nie dokładać nowego fetchu.
  - **NOWY finding (1.11.2, realny raw „Inny"/Dickson)**: infobox `{{Książka}}` ma pola
    `|poprzednia=` i `|następna=` z tytułami SĄSIEDNICH tomów (np. poprzednia „Młody Bleys",
    następna „Gildia Orędowników") + `|cykl=` z nazwą cyklu. To gotowy łańcuch prev/next —
    dużo prostszy niż parsowanie `{{Cykl}}`: krok 1 persystencji może zapisać
    `{cykl, poprzednia, następna}` wprost z tych pól.
  - **Zasada nadrzędna**: NIE fetchować na żywo w widoku „Wczytaj z bazy" — to łamie
    „scrapuj raz, analizuj wiele" i wskrzesza rate-limit/Cloudflare + fetch wiki przy renderze.
  - **Projekt (3 warstwy, każda w istniejącym flow)**:
    1. Persystencja struktury: `cyclesSyncService` zapisuje nazwę cyklu + uporządkowaną listę
       tomów do bloba `CycleData` (wzorzec `VintedData`). Wtedy „sąsiednie tomy" = lookup z bazy.
    2. Render bez scrapowania: kafelek czyta listę z bloba, krzyżuje z wierszami Notion →
       oznacza tom `masz` / `w bazie` / `brak`. Czysto ze store.
    3. Dostępność brakujących na Vinted = osobny opt-in rytuał („Skan sąsiednich tomów", jak
       „Ustal sprzedawców"): traktuje brakujące tomy jak tymczasowe cele, dopisuje oferty do
       `CycleData` rodzica. NIGDY w ścieżce renderu.
  - **Otwarta decyzja produktowa — jak trzymać brakujące tomy**:
    - Wariant B: realne wiersze Notion (tag np. `Cykl-Discovered`) → pełny pipeline
      (kandydat→skan→kafelek→paczki→dedup), ale baza puchnie + trzeba wykluczyć ze
      statystyk/nagród + ryzyko dubli.
    - Wariant C (rekomendowany na start): kontekst w blobie `CycleData` rodzica → zero
      zaśmiecania bazy, pasuje 1:1 do `VintedData`; koszt: dane Vinted „drugiej kategorii"
      (poza głównym flow kafelków/paczek), tom wspólny dla 2 cykli zapisany 2× (brak cross-dedup).
      Furtka: promocja tomu do realnego wiersza (→ wariant B) jednym klikiem, gdy user zdecyduje.
  - **Kolejność startu**: najpierw sam krok 1 (persystencja struktury cyklu), żeby zobaczyć
    dane, zanim dołożymy skan dostępności.

## Zrobione (skrót)

- **Seller bundling** (1.1.0) — ZROBIONE. Opcja A (parsowanie strony oferty), on-demand.
  Sprzedawca ze strony `/items/{id}` (markery zweryfikowane: `href="/member/{id}"` +
  `data-testid="profile-username"`, oba unikalne 1×). Grupujemy najtańszą/książkę (1
  fetch/książkę — mniej ekspozycji na Cloudflare). Opcja B (wewn. API) odpadła — brak wjazdu.
