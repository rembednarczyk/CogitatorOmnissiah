import { NotionBook, Book } from "../src/types";
import { sanitizeNotionString, sanitizeNotionTag, isValidUrl } from "../utils";
import { normalizeData } from "./dataNormalizer";

/**
 * Warstwa diffu książek: czyste funkcje budujące payloady dla Notion z pary
 * (rekord w Notion, książka z wiki). Bez I/O — BookSyncService tylko woła te
 * buildery i wysyła wynik do adaptera, dzięki czemu logika idempotencji jest
 * testowalna w izolacji i nie zaśmieca orkiestratora.
 */

/**
 * Buduje listę tagów autora dla pola multi_select. KOLEJNOŚĆ MA ZNACZENIE:
 * najpierw normalizacja (mapowania potrafią rozwinąć jedno nazwisko w kilka
 * rozdzielonych przecinkiem, np. "Liu Cixin" → "Liu Cixin, Ken Liu"), potem
 * podział po przecinku, a sanitizacja NA KOŃCU. `sanitizeNotionTag` usuwa
 * przecinki (Notion nie dopuszcza ich w opcjach select/multi_select) — gdy
 * sanitizacja biegła PRZED normalizacją, wstrzyknięty przez mapowanie przecinek
 * trafiał do nazwy opcji i Notion odrzucał cały wiersz (laureat gubiony w ciszy).
 * Deduplikacja jest case-insensitive, z zachowaniem pierwszej napotkanej pisowni.
 */
export function buildAuthorTags(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const normalized = normalizeData(part.trim(), "author");
    for (const piece of normalized.split(",")) {
      const tag = sanitizeNotionTag(piece);
      if (tag && !seen.has(tag.toLowerCase())) {
        seen.add(tag.toLowerCase());
        tags.push(tag);
      }
    }
  }
  return tags;
}

/** Case-insensitive union nagród + reguła "Wszystkie" (Hugo+Nebula+Locus). */
function mergeAwards(existing: string[], incoming: string[]): { awards: string[]; changed: boolean } {
  const lower = new Set(existing.map(a => a.toLowerCase()));
  const combined = [...existing];
  let changed = false;
  for (const aw of incoming) {
    if (!lower.has(aw.toLowerCase())) {
      combined.push(aw);
      lower.add(aw.toLowerCase());
      changed = true;
    }
  }
  if (lower.has("nagroda hugo") && lower.has("nagroda nebula") && lower.has("nagroda locus") && !lower.has("wszystkie")) {
    combined.push("Wszystkie");
    lower.add("wszystkie");
    changed = true;
  }
  return { awards: combined, changed };
}

/**
 * Diff istniejącego rekordu Notion względem książki z wiki → payload aktualizacji
 * (tylko zmienione pola). Puste = brak zmian. Autorzy/nagrody scalane (union),
 * porównania case-insensitive po obu stronach (Notion zachowuje własną pisownię).
 */
export function buildBookUpdates(existingBook: NotionBook, book: Book): Record<string, any> {
  const updates: Record<string, any> = {};

  const cleanExistingPl = sanitizeNotionString(existingBook.plTitle);
  const cleanExistingOrig = sanitizeNotionString(existingBook.origTitle);
  const cleanNewPl = sanitizeNotionString(book.polishTitle);
  const cleanNewOrig = sanitizeNotionString(book.originalTitle);

  // Update Polish title if it differs from the wiki
  if (cleanNewPl && cleanExistingPl !== cleanNewPl) {
    const link = book.polishTitleLink;
    updates["Tytuł polski"] = { rich_text: [{ text: { content: cleanNewPl, ...(isValidUrl(link) ? { link: { url: link } } : {}) } }] };
  } else if (cleanExistingPl && existingBook.plTitle !== cleanExistingPl) {
    const link = book.polishTitleLink;
    updates["Tytuł polski"] = { rich_text: [{ text: { content: cleanExistingPl, ...(isValidUrl(link) ? { link: { url: link } } : {}) } }] };
  }

  if (cleanNewOrig && (!cleanExistingOrig || cleanExistingOrig === "")) {
    updates["Tytuł oryginalny"] = { rich_text: [{ text: { content: cleanNewOrig } }] };
  } else if (cleanExistingOrig && existingBook.origTitle !== cleanExistingOrig) {
    updates["Tytuł oryginalny"] = { rich_text: [{ text: { content: cleanExistingOrig } }] };
  }

  // Autorzy — union (nigdy nie gub ręcznie dodanych w Notion), case-insensitive
  const newAuthors = buildAuthorTags(book.author || "");
  const existingAuthors = buildAuthorTags(existingBook.author || "");
  const existingLower = new Set(existingAuthors.map(a => a.toLowerCase()));
  const combinedAuthors = [...existingAuthors];
  for (const a of newAuthors) {
    if (!existingLower.has(a.toLowerCase())) {
      combinedAuthors.push(a);
      existingLower.add(a.toLowerCase());
    }
  }
  if (combinedAuthors.length !== existingAuthors.length && combinedAuthors.length > 0) {
    updates["Autor"] = { multi_select: combinedAuthors.slice(0, 100).map(name => ({ name })) };
  }

  // Nagrody — union case-insensitive (zob. GUIDELINES §3)
  const newAwards = (book.awards || []).map(sanitizeNotionTag).filter(Boolean);
  const existingAwards = (existingBook.awards || []).map(sanitizeNotionTag).filter(Boolean);
  const { awards: combinedAwards, changed: awardsUpdated } = mergeAwards(existingAwards, newAwards);
  if (awardsUpdated) {
    updates["Nagroda"] = { multi_select: combinedAwards.slice(0, 100).map(name => ({ name })) };
  }

  // Rok — dołóż nowy rok do zbioru (multi_select), posortowany
  const newYear = (book.year || "").trim();
  const existingYears = (existingBook.year || "").split(',').map((y: string) => y.trim()).filter(Boolean);
  if (newYear && !existingYears.includes(newYear)) {
    const updatedYears = Array.from(new Set([...existingYears, newYear])).sort().map(name => ({ name }));
    updates["Rok"] = { multi_select: updatedYears };
  }

  return updates;
}

/** Payload dla nowego wiersza Notion z książki z wiki. */
export function buildNewBookProperties(book: Book): Record<string, any> {
  const properties: Record<string, any> = {
    "Lp": { title: [{ text: { content: sanitizeNotionString(book.polishTitle || book.originalTitle || "Nowy") } }] },
    "Tytuł polski": { rich_text: [{ text: { content: sanitizeNotionString(book.polishTitle || ""), ...(isValidUrl(book.polishTitleLink) ? { link: { url: book.polishTitleLink } } : {}) } }] },
    "Tytuł oryginalny": { rich_text: [{ text: { content: sanitizeNotionString(book.originalTitle || "") } }] },
  };
  if (book.year) {
    properties["Rok"] = { multi_select: [{ name: book.year.toString() }] };
  }
  if (book.author) {
    const authors = buildAuthorTags(book.author);
    properties["Autor"] = { multi_select: authors.slice(0, 100).map(name => ({ name })) };
  }
  if (book.awards && book.awards.length > 0) {
    const { awards } = mergeAwards([], book.awards.map(sanitizeNotionTag).filter(Boolean));
    properties["Nagroda"] = { multi_select: awards.map(name => ({ name })) };
  }
  return properties;
}
