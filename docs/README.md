# Dokumentacja algorytmów

Szczegółowe opisy działania poszczególnych rytuałów (jeden dokument na koncern synchronizacji). Przed zmianą danego serwisu przeczytaj odpowiadający mu dokument; po zmianie logiki — zaktualizuj go (zob. `COGITATOR_GUIDELINES.md` §8).

| Dokument | Zakres |
| --- | --- |
| [book-sync.md](./book-sync.md) | Synchronizacja nagród: pobieranie, parsowanie tabel, scalanie, porównanie i zapis do Notion. |
| [publisher-series-sync.md](./publisher-series-sync.md) | Ekstrakcja wydawcy i serii ze stron książek (priorytet najnowszego wydania, weryfikacja autora). |
| [cycles-sync.md](./cycles-sync.md) | Wykrywanie i oznaczanie przynależności do cyklu. |
| [duplicate-detection.md](./duplicate-detection.md) | Wykrywanie duplikatów (tytuł + podobieństwo autora). |
| [lp-sync.md](./lp-sync.md) | Przenumerowanie kolumny „Lp" wg roku i tytułu. |
| [purification-service.md](./purification-service.md) | Czyszczenie tytułów ze składni wiki i formatowania Notion. |
| [schema-validation.md](./schema-validation.md) | Zakładanie/naprawa schematu bazy Notion. |
| [integrity-service.md](./integrity-service.md) | Rytuał Sanctity: kontrola integralności Notion vs wiki. |
| [stats-service.md](./stats-service.md) | Agregacja statystyk do dashboardu. |
| [library-check.md](./library-check.md) | Skan dostępności w OPAC MBP Lublin (scraping HTML). |
| [vinted-scanner.md](./vinted-scanner.md) | Skan ofert na vinted.pl (scraping HTML — bez AI). |
| [skryptorium-search.md](./skryptorium-search.md) | Wyszukiwarka rekordów archiwum (client-side, fold diakrytyków, highlight). |
| [bookshelf.md](./bookshelf.md) | Regał: wizualizacja księgozbioru (grzbiety + okładki) z drag&drop przeczytanych. |

Obserwowalność, diagnostyka (`/api/diagnostics`), wdrożenie i rozwiązywanie problemów opisane są w [README](../README.md).
