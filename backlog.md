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

- Wersja aplikacji: **1.1.0** (źródło prawdy: `metadata.json`; mirror w `package.json`).
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

- (brak)

## Zrobione (skrót)

- **Seller bundling** (1.1.0) — ZROBIONE. Opcja A (parsowanie strony oferty), on-demand.
  Sprzedawca ze strony `/items/{id}` (markery zweryfikowane: `href="/member/{id}"` +
  `data-testid="profile-username"`, oba unikalne 1×). Grupujemy najtańszą/książkę (1
  fetch/książkę — mniej ekspozycji na Cloudflare). Opcja B (wewn. API) odpadła — brak wjazdu.
