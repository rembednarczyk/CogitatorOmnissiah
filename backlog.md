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

- Wersja aplikacji: **1.0.1** (źródło prawdy: `metadata.json`; mirror w `package.json`).
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
- **Marker debug `grid` vs `html`** — `html` w logach skanera oznacza, że oferty złapał
  tylko fallback (ścieżka 4), a nie siatka. Po wdrożeniu fixu na stronach z siatką ma
  być `grid`. Jeśli po redeployu dalej `html` na stronie z siatką → deploy serwuje
  stary bundle / nie odpalił `npm run build`.

## Changelog

Wersja ze źródła prawdy `metadata.json` (mirror w `package.json`). Najnowsze na górze.

- **1.0.1** — Vinted parser dostrojony do aktualnego DOM Vinted (siatka feed-grid po
  hashowanej klasie, cena strukturalna + miniatury; fix `hasFeedGrid`). Wprowadzenie
  wersjonowania w `metadata.json` i trwałej pamięci `backlog.md`. (PR #52 + workflow rules)
- **1.0.0** — Stan bazowy.

## Otwarte pozycje

- (brak)
