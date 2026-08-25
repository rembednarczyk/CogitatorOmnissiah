# Cykle jako wiersze — podgląd, żniwa, dostępność

Poboczne (nienagrodzone) tomy cykli są **realnymi wierszami bazy**, oddzielonymi od nagród właściwością `Kategoria`. Dzięki temu można je oznaczać (przeczytane/posiadane) i skanować na Vinted, nie zaśmiecając statystyk nagród. Trzy warstwy: podgląd na żądanie, materializacja rytuałem, wyświetlanie dostępności.

## Model danych

- `Kategoria` (select): puste / `Nagroda` = pozycja nagrodowa; `Tom cyklu` = poboczny tom cyklu.
- `Cykl` (rich_text): nazwa cyklu — klucz grupujący (ustawiany na kotwicy nagrodowej ORAZ na wierszach tomów).
- `CyklNr` (number): pozycja w cyklu (kolejność czytania).
- `Lp` (kolumna tytułowa) tomu cyklu = stabilna etykieta „Nazwa cyklu (nr)"; prawdziwy tytuł żyje w `Tytuł polski` (z linkiem do encyklopedii).

Rozdział egzekwuje `services/bookCategory.ts` (`isAwardBook`/`isCycleVolume`). Filtrują: statystyki, integralność, indeks Regału/Skryptorium, numeracja Lp, wykrywanie duplikatów, promocja w book-sync. **Skaner Vinted CELOWO nie filtruje** — ma skanować też tomy.

## 1. Podgląd cyklu (`CycleLookupService`, na żądanie, bez zapisu)

`GET /api/cycle?title&author` → `SyncManager.getCycle` → `CycleLookupService.lookup`:
1. Rozwiązuje stronę wiki (direct fetch + search z bramką autora).
2. `WikiParser.extractCycleInfo` czyta `|cykl=`, `|poprzednia=`/`|następna=` (obie pisownie akcentów), `{{Cykl}}`.
3. Chodzi po łańcuchu prev/next (`MAX_HOPS=15`, visited-set) → uporządkowana lista tomów, wzbogacona o linki `{{Cykl}}`.
4. Krzyżuje każdy tom z bazą (`normTitle`) → `inBase`/`read`/`owned`/`awarded` + `unreadBefore`.
- **Nazwa cyklu**: `|cykl=` jeśli jest; inaczej tytuł PIERWSZEGO tomu (stabilny między kotwicami) — NIE generyczne „Cykl" (inaczej wszystkie bezimienne cykle zlałyby się w jedną grupę).
- Cache w pamięci procesu (klucz `title|author`). Używane przez `CyclePanel` w Skryptorium (klik badge „cykl").

## 2. Żniwa (`CycleHarvestService`, rytuał `cycles-harvest`)

`POST /api/sync-cycles-harvest`. Dla każdej **kotwicy nagrodowej** z `Część cyklu`:
1. `createColumnIfNeeded` dla `Kategoria`/`Cykl`/`CyklNr`/`Część cyklu`.
2. `lookup` cyklu (reużycie warstwy 1). Cykl rozwijany **raz** (dedup po znorm. nazwie).
3. Dla każdego tomu: jeśli wiersz istnieje (dopasowanie tym SAMYM `normTitle` co lookup) → dotaguj `Cykl`/`CyklNr` (+ `Lp`/link dla tomów cykli); jeśli nie → utwórz wiersz `Tom cyklu`.
- **Idempotentny**: brak duplikatów (wspólny `normTitle`, sanityzowana nazwa cyklu porównywana spójnie), pomija puste tytuły. **Bezpieczny współbieżnie**: slot indeksu rezerwowany SYNCHRONICZNIE przed `addRow` (równoległe zadanie widzi rezerwację i pomija).
- Raport SSE: `added` (nowe wiersze) / `updated` (dotagowane) / `skipped` (kotwice bez sąsiadów). NIE jest częścią „Wielkiego Rytuału" (masowy zapis — uruchamiany świadomie).
- **Znane ograniczenie**: `CyklNr` to pozycja w ODKRYTYM łańcuchu (urwanie MAX_HOPS / nieudany sąsiad / `{{Cykl}}` extras na końcu) — kolejność względna OK, numer bezwzględny może być przesunięty.

## 3. Archiwum + dostępność Vinted (`aggregateCycleRows`)

`GET /api/cycles-harvest` → `aggregateCycleRows(books)` (czysty): grupuje wiersze z niepustym `Cykl`, sortuje po `CyklNr`, liczy `owned`/`read`/`missing` („do zdobycia" = ani posiadane, ani przeczytane) i `acquireCost` (suma najtańszych ofert Vinted dla tomów do zdobycia; z blobu `VintedData` przez `parseVintedData`). Karta „Archiwum Cykli" pokazuje tomy + status + pill „🛒 X zł" (link do oferty) + oznaczanie przeczytane/posiadane w miejscu (`toggleSource` → `/api/mark-as-read` / `/api/unmark-as-read`).

Ponieważ tomy to wiersze, **skaner Vinted zbiera ich oferty za darmo** (wiersze z pustym `Źródło`); UC1 to tylko wyświetlenie zebranych danych.
