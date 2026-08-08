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

- Wersja aplikacji: **1.10.1** (źródło prawdy: `metadata.json`; mirror w `package.json` + `package-lock.json`).
- Branch roboczy: `claude/book-aggregator-setup-t6kfvd`. Deploy leci z `main` — zmiany
  muszą trafić na `main` (PR + merge), inaczej redeploy serwuje stary kod.
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

## Zrobione (skrót)

- **Seller bundling** (1.1.0) — ZROBIONE. Opcja A (parsowanie strony oferty), on-demand.
  Sprzedawca ze strony `/items/{id}` (markery zweryfikowane: `href="/member/{id}"` +
  `data-testid="profile-username"`, oba unikalne 1×). Grupujemy najtańszą/książkę (1
  fetch/książkę — mniej ekspozycji na Cloudflare). Opcja B (wewn. API) odpadła — brak wjazdu.
