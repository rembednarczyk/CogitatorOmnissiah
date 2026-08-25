import { BookIndexEntry } from "../types";
import { decadeKeyOf, effShelfKey } from "./bookshelf";

/**
 * Czysty planer precyzyjnego wstawienia na regał.
 *
 * Wejście: posortowana sekwencja półki docelowej BEZ przeciąganej książki,
 * przeciągana książka i cel (`insertBeforeId` — id książki, przed którą wstawiamy;
 * null = na sam koniec półki). Wyjście: partia zapisów `ShelfOrder` (skala
 * ułamkowych lat) — zwykle 1 wpis (klucz-środek między sąsiadami); przy remisie
 * kluczy (książki z tego samego roku bez ręcznych kluczy) renumerowany jest tylko
 * ZWIĄZANY przedział, nie cała dekada.
 *
 * Walidacja rocznikowa: wstawić można wyłącznie w szczelinę, której sąsiad (lewy
 * lub prawy) należy do dekady przeciąganej książki — czyli wewnątrz jej sekcji
 * albo na jej brzegach. Książki „bez daty" nie mają skali → precyzyjny drop off.
 */

export interface InsertionPlan {
  /** Zapisy ShelfOrder do wysłania (id → klucz). Zawsze zawiera przeciąganą książkę. */
  orders: { pageId: string; order: number }[];
}

/** Maks. partia zapisów (spójna z limitem POST /api/shelf-order). */
const MAX_ORDERS = 40;

/** Czy szczelina PRZED książką `insertBeforeId` (null = koniec) przyjmie tę książkę (dekada się zgadza)? */
export function canInsertAt(seq: BookIndexEntry[], dragged: BookIndexEntry, insertBeforeId: string | null): boolean {
  const dec = decadeKeyOf(dragged);
  if (!isFinite(dec)) return false; // „bez daty" — brak skali porządku
  const idx = insertBeforeId === null ? seq.length : seq.findIndex((b) => b.id === insertBeforeId);
  if (insertBeforeId !== null && idx < 0) return false;
  const L = idx > 0 ? seq[idx - 1] : undefined;
  const R = idx < seq.length ? seq[idx] : undefined;
  if (!L && !R) return true; // pusta półka — zwykły drop, bez klucza
  return (L !== undefined && decadeKeyOf(L) === dec) || (R !== undefined && decadeKeyOf(R) === dec);
}

/**
 * Plan zapisów dla wstawienia. `null` gdy szczelina nieprawidłowa (zła dekada /
 * nieznany cel / partia ponad limit) — wołający robi fallback do zwykłego dropu.
 */
export function planInsertion(seq: BookIndexEntry[], dragged: BookIndexEntry, insertBeforeId: string | null): InsertionPlan | null {
  if (!canInsertAt(seq, dragged, insertBeforeId)) return null;
  const dec = decadeKeyOf(dragged);
  const idx = insertBeforeId === null ? seq.length : seq.findIndex((b) => b.id === insertBeforeId);
  const L = idx > 0 ? seq[idx - 1] : undefined;
  const R = idx < seq.length ? seq[idx] : undefined;

  if (!L && !R) return { orders: [] }; // pusta półka — pozycja wynika z roku

  // Granice tylko z sąsiadów WEWNĄTRZ dekady; sąsiad z innej dekady = otwarty brzeg sekcji.
  const kL = L && decadeKeyOf(L) === dec ? effShelfKey(L) : null;
  const kR = R && decadeKeyOf(R) === dec ? effShelfKey(R) : null;

  const lo = dec;            // dolna krawędź skali dekady
  const hi = dec + 9.99;     // górna krawędź (klucz musi zostać < dec+10)

  if (kL !== null && kR !== null) {
    if (kL < kR) return { orders: [{ pageId: dragged.id, order: (kL + kR) / 2 }] };
    // Remis kluczy (ten sam rok bez ręcznych kluczy): renumeruj związany przedział
    // [wszystkie kolejne wpisy o kluczu == kL wokół szczeliny] + wstawiana.
    const tie = kL;
    let start = idx - 1;
    while (start - 1 >= 0 && decadeKeyOf(seq[start - 1]) === dec && effShelfKey(seq[start - 1]) === tie) start--;
    let end = idx; // pierwszy indeks ZA przedziałem
    while (end < seq.length && decadeKeyOf(seq[end]) === dec && effShelfKey(seq[end]) === tie) end++;
    const run = seq.slice(start, end);
    const insertPos = idx - start;
    const finalRun: BookIndexEntry[] = [...run.slice(0, insertPos), dragged, ...run.slice(insertPos)];
    if (finalRun.length > MAX_ORDERS) return null;
    // Rozłóż klucze w [tie, min(tie+0.98, hi)] — poniżej następnego rocznika.
    const top = Math.min(tie + 0.98, hi);
    const stepSpan = top - tie;
    const orders = finalRun.map((b, i) => ({ pageId: b.id, order: tie + (stepSpan * (i + 1)) / (finalRun.length + 1) }));
    return { orders };
  }

  if (kL !== null) {
    // Koniec sekcji dekady — klucz między kL a górną krawędzią.
    return { orders: [{ pageId: dragged.id, order: kL + (hi - kL) / 2 }] };
  }
  // kR !== null: początek sekcji — klucz między dolną krawędzią a kR.
  return { orders: [{ pageId: dragged.id, order: lo + ((kR as number) - lo) / 2 }] };
}
