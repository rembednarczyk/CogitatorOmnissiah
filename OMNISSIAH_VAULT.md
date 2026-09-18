# Omnissiah Vault

> *„Ku chwale Omnissiaha — w służbie zachowania literackich artefaktów w epoce cyfrowej."*
> — stopka README, 2025–2026

Sejf pamiątek. Projekt **Librem** urodził się jako **Cogitator Omnissiah** i przez pierwszy rok życia
mówił językiem Adeptus Mechanicus z Warhammera 40 000: rytuały zamiast zadań, liturgie zamiast
synchronizacji, sanctity zamiast kontroli spójności.

Ten plik nie jest dokumentacją i **nic go nie czyta** — ani kod, ani build, ani testy. Ma dwa zadania:
zachować klimat, który był świadomą konwencją, i służyć jako **słownik dekodujący** przy czytaniu
starych commitów, issues i PR-ów, gdzie tamte nazwy nadal występują.

---

## Tożsamość

| | było | jest |
| --- | --- | --- |
| Nazwa aplikacji | **Cogitator Omnissiah** | **Librem** |
| Repozytorium | `rembednarczyk/CogitatorOmmnissiah` (z literówką — trzy `m`) | `rembednarczyk/Librem` |
| Wytyczne architektoniczne | `COGITATOR_GUIDELINES.md` | `LIBREM_GUIDELINES.md` |
| Serwis produkcyjny | `cogitator-omnissiah.onrender.com` | `librem.onrender.com` |
| Realm Basic Auth | `Cogitator Omnissiah` | `Librem` |
| Pakiet npm | `react-example` (zaszłość po szablonie) | `librem` |
| Dokument wyszukiwarki | `docs/skryptorium-search.md` | `docs/catalog-search.md` |

## Słownik: rytuały → nazwy dzisiejsze

Nazwy z lewej kolumny występują w historii gita i w starszych wpisach `backlog.md`.

| dawna nazwa | dzisiejsza nazwa w UI |
| --- | --- |
| Liturgie Synchronizacji | **Synchronizacja** (zakładka) |
| Skryptorium | **Katalog** (zakładka) |
| Sanktuarium Kalibracji | **Ustawienia** |
| Wielki Rytuał | **Pełna synchronizacja** |
| Rytuał Inicjacji Schematu | **Inicjacja schematu** |
| Puryfikacja | **Porządkowanie tytułów** |
| Rekonstrukcja Liczb (Lp) | **Rekonstrukcja numeracji** |
| Rytuał Cykli | **Oznaczanie cykli** |
| Żniwa Cykli | **Zbieranie tomów cykli** |
| Rytuał Sygnatur (ISBN) | **Nadawanie ISBN** |
| Sanctity / Integralność | **Kontrola spójności** |
| Rytuał Duplikatów | **Wykrywanie duplikatów** |

## Co z 40k zostało — i dlaczego celowo

Wycofanie (v1.61.0) dotyczyło **tekstów widocznych dla użytkownika**. Reszta została świadomie:

- **Wygląd motywu ciemnego.** Glassmorphism, `slate-950`, akcenty cyan/purple, cząsteczki w tle,
  mosiężne ramy regału i skórka `noospheric` z kołem zębatym Mechanicusa — to nadal estetyka 40k.
  Zmieniło się *copy*, nie *look*. Motyw jasny („Librem", boho) jest osobną, ciepłą stylistyką.
- **Identyfikatory w kodzie.** `LiturgySection.tsx`, `SanctityDebugger.tsx`, `RitualButton.tsx`,
  `ritualColors.ts`, tablica `rituals`, komentarze z „Wielkim Rytuałem". Nazwy techniczne, niewidoczne
  dla użytkownika — zmiana byłaby czystym churnem w importach bez zysku.
- **Teksty serwisów backendu i identyfikatory domenowe.** Np. `Nieznany rytuał synchronizacji`
  w `syncManager.ts`, klucze `TASK_REGISTRY`, nazwy kolumn Notion. Chronione wprost przez `CLAUDE.md` —
  ich zmiana ruszałaby dane, nie markę.
- **`docs/bookshelf.md`** opisuje „noospheric Adeptus Mechanicus skin" — bo dokładnie tak nazywa się
  ta skórka i tak wygląda.

---

*Cogitator umilkł. Dane trwają.*
