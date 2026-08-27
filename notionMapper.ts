import { NotionPage, NotionProperty, NotionPageProperties, NotionBook } from "./src/types";
import { normalizeIsbn } from "./services/isbn";

/**
 * Maps a Notion page → domain `NotionBook`. This is domain logic (not a pure
 * API wrapper), so it lives outside `NotionAdapter` — a pure function, testable
 * without a Notion client. The adapter only fetches pages and calls `mapPageToBook`.
 */

/** Get a property by name, case-insensitive (Notion is sometimes inconsistent about casing). */
function getProp(props: NotionPageProperties, name: string): NotionProperty | undefined {
  if (props[name]) return props[name];
  const lowerName = name.toLowerCase();
  for (const key in props) {
    if (key.toLowerCase() === lowerName) return props[key];
  }
  return undefined;
}

/** Extract text from any Notion property type. */
function getPlainText(prop?: NotionProperty): string {
  if (!prop) return "";
  const type = prop.type;
  if (type === "title") return prop.title?.map((t) => t.plain_text).join("") || "";
  if (type === "rich_text") return prop.rich_text?.map((t) => t.plain_text).join("") || "";
  if (type === "number") return prop.number !== undefined && prop.number !== null ? prop.number.toString() : "";
  if (type === "select") return prop.select?.name || "";
  if (type === "multi_select") return prop.multi_select?.map((x) => x.name).join(", ") || "";
  if (type === "checkbox") return prop.checkbox?.toString() || "";
  if (type === "url") return prop.url || "";
  return "";
}

/** multi_select values (or a single select) as a list of names. */
function multiSelectNames(prop?: NotionProperty): string[] {
  if (prop?.type === "multi_select") return prop.multi_select?.map((x) => x.name) || [];
  if (prop?.type === "select" && prop.select?.name) return [prop.select.name];
  return [];
}

export function mapPageToBook(page: NotionPage): NotionBook {
  const props = page.properties;

  const plTitle = getPlainText(getProp(props, "Tytuł polski"));
  const origTitle = getPlainText(getProp(props, "Tytuł oryginalny"));
  const author = getPlainText(getProp(props, "Autor"));

  const plTitleProp = getProp(props, "Tytuł polski");
  const origTitleProp = getProp(props, "Tytuł oryginalny");
  const plTitleRichText = plTitleProp?.type === "title" ? plTitleProp.title : plTitleProp?.rich_text || [];
  const origTitleRichText = origTitleProp?.type === "title" ? origTitleProp.title : origTitleProp?.rich_text || [];

  const yearProp = getProp(props, "Rok");
  let year: string | undefined = undefined;
  if (yearProp) {
    if (yearProp.type === "multi_select") {
      year = yearProp.multi_select?.map((x) => x.name).join(", ");
    } else if (yearProp.type === "number") {
      year = yearProp.number !== undefined && yearProp.number !== null ? yearProp.number.toString() : undefined;
    } else {
      year = getPlainText(yearProp).trim() || undefined;
    }
  }

  const currentWydawnictwo = getPlainText(getProp(props, "Wydawnictwo"));
  const currentSeria = getPlainText(getProp(props, "Seria"));
  const currentCzesccyklu = getProp(props, "Część cyklu")?.checkbox || false;
  // Row category: „Nagroda" (default, when empty) vs „Tom cyklu" (sibling cycle
  // volume added by the harvest ritual). Separates award entries from the rest.
  const kategoria = getProp(props, "Kategoria")?.select?.name || undefined;
  const lp = getPlainText(getProp(props, "Lp"));

  const awards = multiSelectNames(getProp(props, "Nagroda"));
  const zrodlo = multiSelectNames(getProp(props, "Źródło"));

  // Stored Vinted results blob (rich_text; multiple segments are joined in getPlainText).
  const vintedData = getPlainText(getProp(props, "VintedData")) || undefined;

  // Cycle grouping: cycle name (rich_text) + position within the cycle (number). Set
  // by the harvest ritual on the award anchor AND on the sibling volume rows.
  const cykl = getPlainText(getProp(props, "Cykl")) || undefined;
  const cyklNrProp = getProp(props, "CyklNr");
  const cyklNr = cyklNrProp?.type === "number" && typeof cyklNrProp.number === "number" ? cyklNrProp.number : undefined;

  // Manual shelf ordering key (number; missing/null → undefined = sort by year).
  const shelfOrderProp = getProp(props, "ShelfOrder");
  const shelfOrder = shelfOrderProp?.type === "number" && typeof shelfOrderProp.number === "number" ? shelfOrderProp.number : undefined;

  // Canonical ISBN-13s across editions (rich_text; filled by the enrichment ritual). Stored
  // as a delimited list — ANY of them matching a scanned barcode identifies this book, since
  // the use case is „do I own this title at all", not „this exact edition". Each token is
  // normalized to a canonical, checksum-valid ISBN-13 on read (converting a legacy/hand-typed
  // ISBN-10 → 13 and dropping junk like „ISBN:"), so a dirty column still matches a scan.
  const isbnRaw = getPlainText(getProp(props, "ISBN"));
  const isbns = isbnRaw
    ? Array.from(new Set(
        isbnRaw.split(/[\s,;]+/)
          .map((s) => normalizeIsbn(s))
          .filter((s): s is string => s !== null)
      ))
    : [];

  return {
    id: page.id,
    plTitle,
    origTitle,
    author,
    year,
    currentWydawnictwo,
    currentSeria,
    currentCzesccyklu,
    kategoria,
    lp,
    awards,
    zrodlo,
    plTitleRichText,
    origTitleRichText,
    vintedData,
    cykl,
    cyklNr,
    shelfOrder,
    isbns
  };
}
