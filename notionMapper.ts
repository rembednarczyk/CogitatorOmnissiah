import { NotionPage, NotionProperty, NotionPageProperties, NotionBook } from "./src/types";

/**
 * Mapowanie strony Notion → domenowy `NotionBook`. To logika domenowa (nie czyste
 * opakowanie API), więc mieszka poza `NotionAdapter` — czysta funkcja, testowalna
 * bez klienta Notion. Adapter tylko pobiera strony i woła `mapPageToBook`.
 */

/** Pobierz właściwość po nazwie, case-insensitive (Notion bywa niespójny w wielkości liter). */
function getProp(props: NotionPageProperties, name: string): NotionProperty | undefined {
  if (props[name]) return props[name];
  const lowerName = name.toLowerCase();
  for (const key in props) {
    if (key.toLowerCase() === lowerName) return props[key];
  }
  return undefined;
}

/** Wyciągnij tekst z dowolnego typu właściwości Notion. */
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

/** Wartości multi_select (lub pojedynczy select) jako lista nazw. */
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
  const lp = getPlainText(getProp(props, "Lp"));

  const awards = multiSelectNames(getProp(props, "Nagroda"));
  const zrodlo = multiSelectNames(getProp(props, "Źródło"));

  // Blob składowanych wyników Vinted (rich_text; wiele segmentów jest sklejanych w getPlainText).
  const vintedData = getPlainText(getProp(props, "VintedData")) || undefined;

  // Ręczny klucz porządku na regale (number; brak/null → undefined = sort po roku).
  const shelfOrderProp = getProp(props, "ShelfOrder");
  const shelfOrder = shelfOrderProp?.type === "number" && typeof shelfOrderProp.number === "number" ? shelfOrderProp.number : undefined;

  return {
    id: page.id,
    plTitle,
    origTitle,
    author,
    year,
    currentWydawnictwo,
    currentSeria,
    currentCzesccyklu,
    lp,
    awards,
    zrodlo,
    plTitleRichText,
    origTitleRichText,
    vintedData,
    shelfOrder
  };
}
