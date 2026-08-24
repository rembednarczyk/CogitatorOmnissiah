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

- Wersja aplikacji: **1.23.0** (źródło prawdy: `metadata.json`; mirror w `package.json` + `package-lock.json`).
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

- **1.23.0** — **Grzbiety zależne od skóry (wariant „E").** Holo+: grzbiet = **szkło w akcencie
  aplikacji** (paleta `APP_PALETTE` cyan/niebieski/indygo/fiolet/purpura, równoległa do `CLOTH_PALETTE`
  po tym samym indeksie) + **neonowa lewa krawędź** + **biały tytuł z glow**; kupki i okładki
  „Wyróżnione" też przemalowane (fore-edge cyan, gwiazdka cyan). Relikwiarz: matowe grzbiety bez zmian.
  `spineStyle` zwraca dodatkowo `app`/`appRgb`; element podaje akcenty inline (`--spine-muted`/`--spine-app`/
  `--spine-app-rgb`/`--cm-*`/`--ca-*`), a wygląd nadają **realne reguły** `.skin-* .book-spine/.spine-title/
  .stack-layer/.fore-edge/.cover-*` w `index.css` (gradient w custom-property z zagnieżdżonym `var()` bywa
  zjadany przez pipeline CSS — stąd klasy zamiast `var(--sk-...)`). Fizyka/szerokości bez zmian. +2 asercje.
- **1.22.3** — Sprzątanie ozdób regału: usunięte **pieczęcie czystości** (+ sygnatura IX-774) z ram
  i **proporzec** z tła (`RoomDecor`). Brązowa obwódka korpusu → tokeny `--sk-frame-border` /
  `--sk-frame-glow`: w Holo+ **glow cyan**, w Relikwiarzu brąz. Listwa świetlna gzymsu też w kolorze
  poświaty skóry. Usunięty martwy `PuritySeal` + nieużywane `--sk-seal-wax` / `--sk-room-pennant` /
  `--sk-room-cog2`.
- **1.22.2** — **Holo+ dostrojony do palety aplikacji.** Korpus/wnęka/cokół = slate-900→slate-950
  (jak karty i tło `bg-slate-950`), sala `RoomDecor` zlewa się z tłem strony; akcenty cyan-400
  (`#22d3ee`) + purpura-500 (`#a855f7`, pieczęć/aureola/proporzec) — spójne z gradientem nagłówka
  cyan→blue→purpura. Award color-code (Hugo=złoty itd.) bez zmian (to dane, nie motyw). Relikwiarz
  zostaje ciepłym mosiądzem jako alternatywa. Zweryfikowane realnym renderem na tle `bg-slate-950`.
- **1.22.1** — **Skóra obejmuje też Salę Archiwum (`RoomDecor`).** Tło pokoju (ściana, podłoga,
  znak wodny koła, proporzec, kurz, płomień + poświata kinkietów) czyta `--sk-room-*` — Holo+ dostaje
  chłodną salę cyan/adamant, Relikwiarz zostaje ciepły mosiądz. `CogMark` maluje kolor przez `style`
  (atrybut `fill` nie rozwiązuje `var()`). Nowe tokeny `--sk-room-{bg,inset,floor,cog,cog2,pennant,mote,glow,flame}`.
- **1.22.0** — **Dwie skóry regału + przełącznik (Holo+ domyślnie).** Skóry sterowane WYŁĄCZNIE
  zmiennymi CSS (`.skin-holo` / `.skin-noospheric` w `index.css`: `--sk-*` gradienty/kolory +
  `--noo-glow`/`--noo-accent2` triplety RGB używane przez keyframes i inline `rgba(var(--noo-glow),a)`),
  więc przełączenie to tylko podmiana klasy na wrapperze — zero prop-drillingu. **Holo+** = kolorystyka
  aplikacji (cyan `#22d3ee` + purpura `#a855f7` na adamancie/slate), **Relikwiarz** = dotychczasowy
  mosiądz+teal. Przełącznik w nagłówku „Regał" (segmentowy, cyan active); wybór trwa w localStorage
  (`shelfSkin`, domyślnie `holo`) — `src/utils/shelfSkin.ts`. Komponenty (`ShelfFrame`, `ShelfOrnaments`
  z `CogSigil` var-driven, `ShelfDivider`, `BookSpine`, `ShelfRow` plank, `Shelf` cokół/nóżki,
  `BookshelfSection` featured plank) czytają `var(--sk-*)`. Fizyka/color-code NIETKNIĘTE. Obie skóry
  zweryfikowane realnym renderem (Vite).
- **1.21.0** — **Regał w stylistyce „noosferycznej" Adeptus Mechanicus (cyfrowy relikwiarz).**
  Warstwa holo na mosiężnym korpusie: animowany **ticker danych** (marquee) w gzymsie, **godło
  cog-skull** z wolno obracającą się aureolą + pulsujący glow (`NoosphericCrest`), **narożniki HUD**
  (teal, pulsujące, zastąpiły mosiężne `CornerBracket`), **siatka noosfery + sweep skanline**
  (`HoloField`) we wnęce, **pieczęć czystości** z sygnaturą `IX-774`. Tabliczki dekad → runy mono
  (font `Share Tech Mono`) z cog-skull + świecąca żyła danych na deseczce + smużka projekcji.
  Grzbiety: teal rim-light + holo **sygnatura katalogowa** (`M####`, deterministyczna z id).
  Sigilla nagród z teal-obwódką. Animacje CSS (`.noo-*` w `index.css`) z guardem
  `prefers-reduced-motion`. Fizyka układania i color-code nagród NIETKNIĘTE. Zweryfikowane realnym
  renderem komponentów (Vite). Nowe/zmienione: `ShelfOrnaments` (+NoosphericCrest/DataTicker/HoloField/HudCorner,
  −CornerBracket), `ShelfFrame`, `ShelfDivider`, `BookSpine`, `index.css`.
- **1.20.2** — **Przekładka dekady = deseczka + tabliczka u góry** (wariant A). Zamiast dużej
  pionowej tabliczki (34×156): cienka **deseczka** (`DIVIDER_W` 34→10) stojąca między dekadami
  na dole toru + pozioma **tabliczka rocznika** u góry półki, wyrównana do początku zakresu
  (tylko przy pierwszym pojawieniu dekady — kontynuacja na nowym rzędzie bez podpisu). `ShelfDivider`
  przepisany (deseczka + tabliczka top-0, `BOARD_H`=`DIVIDER_H`=168 jako podpora fizyki);
  `ShelfRow` daje przekładce `z-15` (maluje się ponad granicznymi grzbietami). Fizyka NIETKNIĘTA.
- **1.20.1** — **Pola wielodatowe wpadają w dekadę** (nie „bez daty"). `parseYear(year)` w
  `bookshelf.ts` wyciąga pierwszy 4-cyfrowy rok z pola (`/\d{4}/`, `null` gdy brak); używany
  przez `decadeOf` (sortowanie tabliczek dekad) i `pubYear` (sort po dacie). Np. „1965/1966",
  „1959 (wyd. pol. 1972)", „wyd. 1948" → dekada zamiast „bez daty". +1 test (multi-date decadeOf).
- **1.20.0** — (1) **Tabliczki dekad**: generyczna przekładka `ShelfDivider` (parchment + mosiężny guzik,
  pionowy tekst) wstawiana na granicy każdej dekady wydania (`buildShelfItems` grupuje po `decadeOf`,
  kupki nie przekraczają dekady; `RenderSlot` + `PackItem`/`PlacedItem` kind `divider`). Etykieta
  generyczna (dziś „1950–1959", w przyszłości litera/nazwisko). (2) **Color-code nagród, bez nominacji**:
  `awardWins(book)` — tylko wygrane („Nagroda …"/„Wszystkie"), pomija „Nominacja …"; Hugo=złoty,
  Nebula=fioletowy, Locus=błękitny; kropki na grzbiecie/leżącej książce zamiast jednej bursztynowej.
  `hasAward` = `awardWins>0`. +8 testów (awardWins, tabliczki dekad). Screenshot OK. Fizyka NIETKNIĘTA.
- **1.19.2** — Regały mają **5 półek** (`pageSize` 3→5 dla obu). Podpis u góry „Regał N" (było „I/N").
- **1.19.1** — Powrót do **dwóch regałów** (lewy „Do przeczytania", prawy zawsze „Przeczytane",
  paginacja `Regał N/M`) — drag&drop po staremu; usunięte `LibraryWall`/`Bookcase`/`useMediaQuery`
  (ściana odrzucona). Numeracja regałów **arabska** (było rzymskie). **Sortowanie półek po DACIE
  WYDANIA** (rok rosnąco, brak roku → koniec; remis → tytuł) zamiast autor→tytuł (`byYearTitle`).
  +test (sort po roku, brak roku na końcu, override). Fizyka NIETKNIĘTA. `docs` §1b/§3 upd.
- **1.19.0** — **Gęsta pozioma ściana regałów** (desktop): `LibraryWall` pokazuje aktywną kolekcję
  (przełącznik Do przeczytania / Przeczytane) jako wiele **regałów po 5 półek** obok siebie,
  skalowanych transformem do wysokości viewportu (mierzy naturalny rozmiar regału + `innerHeight`),
  z oknem „Regały I–VI / N" (strzałki). Przenoszenie między kolekcjami: **dok upuszczania** na dole
  podczas przeciągania (`onDropBook(other)`). Nowe: `Bookcase` (regał stałej wielkości bez pomiaru),
  `LibraryWall`, hook `useMediaQuery`. Wąski ekran (<1024) → fallback do dwóch regałów paginowanych.
  Fizyka NIETKNIĘTA (regały używają `packAndLayout` przy `rowWidth=300`). Weryfikacja mockiem
  (6 regałów × 5 półek). Lint/testy/build OK. `docs` §1b upd.
- **1.18.0** — **Sala Archiwum**: regały stoją w POKOJU zamiast jednej długiej listy 700 pozycji.
  `RoomDecor` — ciepły skryptorium (drewniana ściana z panelami, podłoga, kinkiety z migoczącym
  światłem `motion`, kurz, proporzec, sygil koła zębatego, winieta; `aria-hidden`). Regały mają
  **stałą wysokość** (`Shelf` prop `pageSize=3` rzędy) i dzielą się na **segmenty „Regał I/N"** ze
  strzałkami; brakujące rzędy dopełniane pustą deską (stała wysokość); świeca na szczycie + cokół/
  nóżki („stoi na podłodze"). Wspólny builder `buildShelfItems` + `chunk` (`utils/shelfLayout.ts`),
  render rzędu wyjęty do `ShelfRow`/`EmptyShelfRow`. Fizyka książek NIETKNIĘTA. +3 testy (`chunk`).
  Weryfikacja mockiem-screenshotem. Wybór usera: ciepły / bogato / segmenty po kolei. **Iteracja 1** —
  możliwe rozszerzenie do gęstej poziomej ściany wielu regałów.
- **1.17.4** — **Brak powietrza między stojącymi książkami — luz pogrubia grzbiety**. Zamiast wkładać
  luz w szczeliny, `layoutRow` po oparciu pochyłych POGRUBIA stojące grzbiety (`PackItem.stretch`,
  water-filling `widenEvenly`, waga ~ długość tytułu → dłuższy tytuł = grubsza książka). Książki się
  stykają jak na prawdziwej półce; kupki/pochyłe nie grubieją; dopiero po nasyceniu limitów zostaje
  włoskowa równa szczelina. `PlacedItem.w` (szerokość renderowania), `Shelf` renderuje grzbiet `p.w`.
  +2 testy (pogrubienie zeruje szczeliny; fallback równych szczelin przy `stretch=0`). Reguła 13 upd.
- **1.17.3** — **Koniec pustych „dziur" w rzędzie**: luz (po oparciu pochyłych) rozkładany RÓWNO na
  wszystkie szczeliny między stojącymi grzbietami zamiast skupiania w kilka przerw. Minimalizuje
  największą szczelinę → pełny rząd ma włoskowe szwy, rzadki rozkłada się równo (żadnej dużej dziury).
  Usunięte `STRAIGHT_GAP`/`MAX_BREAK` i logika „break". Reguła 13 w docs zaktualizowana. +test (równe
  szczeliny, fill do prawej). Screenshot OK.
- **1.17.2** — Stojące książki jeszcze bliżej + **reguły modułu w dokumentacji**. Szew między prostymi
  grzbietami zmniejszony do `STRAIGHT_GAP=1 px`, `packRows` minGap 3→2; nadmiar luzu trafia do
  minimalnej liczby „przerw" (każda ≤ `MAX_BREAK=34 px`, równo rozłożone) zamiast co-4-tej szczeliny.
  `docs/bookshelf.md` §1a — cały arc `1.16.0→1.17.2` ujęty jako **reguły działania** (15 punktów:
  mebel/deski, pozy, kupki, fizyka fill+oparcie+zwarcie, pełne nazwy, drag). +test (zwarte + przerwy ≤cap).
- **1.17.1** — Fizyka: **stojące równo książki blisko siebie**. `layoutRow` przycina szczelinę
  między prostymi grzbietami do `STRAIGHT_MAX=3 px`; luz w pierwszej kolejności pochłaniają pochyłe
  (oparcie), a dopiero nadmiar trafia do rzadkich „przerw" (co 4-tą wolną szczelinę) → zwarte grupki
  zamiast równomiernego rozjazdu. Rząd nadal wypełniony do prawej krawędzi. +test. Screenshot OK.
- **1.17.0** — **Fizyka regału** (nowy `utils/shelfPacking.ts`): (1) **każda półka wypełniona** —
  `Shelf` mierzy szerokość (`ResizeObserver`), pakuje woluminy w rzędy i rozdziela luz tak, że rząd
  spina lewą i prawą krawędź (bez dziury na końcu); (2) **pochylenie z podparciem** — książka pochyla
  się TYLKO gdy ma szczelinę do oparcia; kąt `θ=atan(szczelina/wys_podpory)` (≤MAX_LEAN, pivot w rogu
  podstawy od strony podpory) → wierzch dosięga górnej krawędzi sąsiada/kupki, nie wisi bezwładnie.
  Rząd ciasny → książki stoją prosto (emergentna fizyka). Render przeszedł z flex-wrap na własne
  rzędy z deską per-rząd; usunięty martwy `leanLayout`. `layoutStack` zwraca `height` (podpora).
  +8 testów fizyki (fill, kąt oparcia, brak pochyłu przy 0-luzie i na krawędzi). Screenshot OK.
- **1.16.7** — Kupki: **mniej ich** (próg `planShelf` 92→95 → ~5%) + **zmienne ułożenie**. Nowy pure
  `layoutStack(books)` (+`stackAlign`/`stackChaos`/`layerJitter`): wyrównanie kupki często do lewej,
  często do prawej, **bardzo rzadko symetryczna piramida** (center ~10%), plus opcjonalny „chaos"
  (~⅓ kupek: 3–7 px poziomego rozjazdu warstw). Sortowanie największa-na-dole zachowane. `flatBookLayout`
  bez zbędnego arg `style`. `BookStack` używa `layoutStack` (offset `x` per warstwa). Gwarancja
  `0≤x≤cellW−width` (brak wystawania). +4 testy (sort, containment, rozkład align, chaos). Screenshot OK.
- **1.16.6** — Kupki dopracowane (3 reguły): (1) **sortowanie od największej na dole do najmniejszej
  na górze** — `BookStack` sortuje warstwy malejąco po szerokości (piramidka, wyśrodkowana, bez
  jittera); (2) **grzbiety sąsiadujące z kupką przechylają się w jej stronę** — `planShelf` nadpisuje
  pozę sąsiadów (`LEAN_TOWARD=5`; lewy w prawo, prawy w lewo); (3) **dwie kupki nigdy nie sąsiadują**
  — po kupce następny slot to zawsze grzbiet (zablokowana kupka → prosto). +2 testy (brak sąsiednich
  kupek, sąsiedzi pochyleni ku kupce). Screenshot OK. `docs/bookshelf.md` upd.
- **1.16.5** — Leżące książki: **zawijanie tytułu do 2 linii zamiast poszerzania**. `flatBookLayout`
  ma limit szerokości `FLAT_MAX_W=150`: krótki tytuł → 1 linia (książka na tekst), dłuższy → 2 linie
  (książka trochę grubsza, nie szersza; `lines` w zwrotce). Bardzo długi → dodatkowo mniejsza czcionka,
  aż połowa mieści się w linii (2 linie zawsze wystarczą, brak ucinania). `BookStack` renderuje tytuł
  przez `-webkit-line-clamp`. +test (short=1 linia, long=2 linie i width=cap, grubszy). Screenshot OK.
- **1.16.4** — Większe kupki (`planShelf` stack **4–7** realnych książek, było 2–4) + **pełne nazwy
  na każdej książce** (bez ucinania). `spineFontSize(style,title)` dobiera czcionkę stojącego
  grzbietu (6–11 px) tak, by cały tytuł zmieścił się na wysokości; `flatBookLayout(book,style)` dobiera
  szerokość+czcionkę+grubość leżącej książki pod pełny tytuł (grubość 15–18, książka szersza dla
  dłuższego tytułu, mniejsza czcionka gdy bardzo długi). `BookStack`/`BookSpine` usuwają `truncate`/
  `max-h-80%`. +2 testy (skalowanie czcionki, szerokość mieści tytuł). Screenshot OK. `docs` upd.
- **1.16.3** — Pozy dostrojone: **mniejszy przechył** (max 6°, `MAX_LEAN_DEG`; było 4–11 → teraz 3–6),
  **więcej stojących prosto** (~80% vs 66%), a **każda książka w kupce to OSOBNY prawdziwy wolumin**
  (własny tytuł/kolor/nagroda/drag), nie jeden grzbiet udający stos. Model przebudowany: `spinePose`+
  `FlatBook` → `planShelf(books)` zwraca sloty `spine|stack` (kupka = 2–4 kolejne realne książki);
  `leanLayout` (dawne `spineLayout`) trzyma regułę braku nachodzenia; nowy `BookStack` renderuje
  warstwy jako osobne książki. +testy (każda książka w 1 slocie, kupka ≥2 różne id, kąt ≤6). Screenshot OK.
- **1.16.2** — Pozy: więcej książek w stosiku (`flat` layers **3–5**, było 1–3) + **reguła: żadna
  książka nie nachodzi na drugą**. Nowy helper `spineLayout(style, pose)` — komórka rezerwuje
  szerokość obróconego grzbietu (`cellW = W·cosθ + H·sinθ`) i przesuwa go (`shiftX`), by bbox był
  wyśrodkowany; przechylony wolumin zostaje w swoim torze (między komórkami `column-gap`). +2 testy
  (containment 4 narożników, footprint prosto/flat). Weryfikacja screenshotem. `docs/bookshelf.md` upd.
- **1.16.1** — Dynamika póz na półce: `spinePose(book)` (deterministyczna, avalanche-mix hasza →
  równomierny rozkład niezależny od korpusu): ~66% stoi prosto, ~27% przechylone (`lean`, 4–11°,
  pivot u podstawy — oparte o sąsiada), ~7% leży na płask jako mały stosik (`flat`, 1–3 książki,
  `FlatBook` z widoczną krawędzią kartek). Poza to tylko `transform`/inny render w komórce — NIE
  rusza stałej wysokości toru, więc deski dalej się zgadzają. Drag&drop zachowany. +3 testy
  (determinizm, zakresy, rozkład). Weryfikacja wizualna screenshotem. `docs/bookshelf.md` zaktualizowany.
- **1.16.0** — Regał jako mebel: prawdziwy korpus `ShelfFrame` (drewniany gzyms + boki + cokół,
  ciemne „plecy" z pionowymi deskami) + ozdoby Mechanicus `ShelfOrnaments` (mosiężne narożniki,
  sygil koła zębatego z czaszką, zwisająca pieczęć czystości — dekoracyjne, `aria-hidden`).
  Każdy rząd grzbietów stoi na osobnej **desce** — trick: komórki o stałej wysokości `SHELF_ROW_H`
  (>171 px grzbiet) → każdy zawinięty wiersz skacze o `ROW_H+GAP`, więc jeden powtarzalny gradient
  (`shelfPlankBackground`, testowany) trafia deską pod każdy rząd niezależnie od szerokości.
  Półka „Do przeczytania" mieści **wszystkie** woluminy (zdjęty scroll-cap `max-h-520`).
  Ramę reużywa też „Wyróżnione". +2 testy (helper deski). Weryfikacja wizualna: screenshot
  headless-chromium potwierdził wyrównanie desek. `docs/bookshelf.md` zaktualizowany.
- **1.15.11** — Audyt #2 krok 4/4 (#102): `StatsSection` (NIE god — spójny dashboard, ale
  pod-wyekstrahowany). Logika oznaczania → hook `useMarkAsRead` (stan `markingId`/`markedIds`
  + optymistyczny update filii / pełny refetch „Przeczytane"); wiersz posiadane-nieprzeczytane
  → `stats/OwnedUnreadItem`; siatka pokrycia nagród (`Math.round(count/total)`) → `stats/AwardCoverageGrid`.
  Zachowanie 1:1, 270 testów. **Audyt #2 zamknięty (kroki 1–4).**
- **1.15.10** — Audyt #2 krok 3/4 (#102): `SchemaEditor` (mild God-Component) **296 → 88 linii**
  (cienki orkiestrator). Inline PATCH ×2 + walidacja duplikatu → hook `useSchemaMutations`
  (`patchOptions` wspólny, `addOption`/`deleteOption`); inline modal usuwania → generyczny
  `ConfirmDialog`; wielka karta kolumny → `SchemaColumnCard` (`key!=='Autor'` skonsolidowane w
  `isEditable`). Zachowanie 1:1, 270 testów.
- **1.15.9** — Audyt #2 krok 2/4 (#102): App.tsx (God-Component) **332 → 149 linii** (czysta
  powłoka). Wyciągnięte `LiturgySection` (blok zakładki config + własny `useConfig`, `useSyncManager`
  propem `sm`) i `TabNav` (5× copy-paste przycisków → mapa). Error-card ZOSTAJE w App (globalny,
  na każdej zakładce) — jedna instancja `useSyncManager`. Zachowanie 1:1, 270 testów.
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
