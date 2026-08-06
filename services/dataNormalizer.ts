import { calculateSimilarity } from "../utils";

export type NormalizationContext = 'publisher' | 'title' | 'series' | 'author';

const MAPPINGS: Record<NormalizationContext, Record<string, string>> = {
  publisher: {
    "Zysk": "Zysk i S-ka",
    "Zysk i S-ka": "Zysk i S-ka",
    "Zysk i Ska": "Zysk i S-ka",
    "Zysk i Spółka": "Zysk i S-ka",
    "Prószyński": "Prószyński i S-ka",
    "Prószyński i S-ka": "Prószyński i S-ka",
    "Prószyński  i S-ka": "Prószyński i S-ka",
    "Prószyński i Spółka": "Prószyński i S-ka",
  },
  title: {
    "The Computer Connection": "The Computer Connection (aka The Indian Giver)",
    "The Computer Connection (aka The Indian Giver)": "The Computer Connection (aka The Indian Giver)",
    "The Strange Case of the Alchemist's Daughter": "The Strange Case of the Alchemist's Daughter",
    "The Strange Case of the Alchemist’s Daughter": "The Strange Case of the Alchemist's Daughter",
    "Mule": "Mule (Foundation and Empire)",
    "We Are All Completely Beside Ourselves": "We Are All Completely Beside Ourselves",
  },
  series: {
    "Kameleon (Zysk i Spółka)": "Kameleon",
    "Kameleon (seria)": "Kameleon",
    "Klasyka SF": "Klasyka Science Fiction",
    "Nowa Fantastyka (seria)": "Nowa Fantastyka",
    "Fantastyka (seria)": "Nowa Fantastyka",
    "Fantastyka Przygoda": "Fantastyka",
    "Fantastyka Beta": "Fantastyka",
  },
  author: {
    "Liu Cixin": "Liu Cixin, Ken Liu",
    "Cixin Liu": "Liu Cixin, Ken Liu",
    "Liu Cixin, Ken Liu, Ken Liu (tłumacz)": "Liu Cixin, Ken Liu",
    "Liu Cixin, Ken Liu (tłumacz)": "Liu Cixin, Ken Liu",
    "Ann Leckie": "Ann Leckie",
    "Anne Leckie": "Ann Leckie",
    "Edmond Hamilton (jako Brett Sterling)": "Edmond Hamilton, Brett Sterling",
    "Edward E. Smith": "E. E. Doc Smith",
    "E. E. Doc Smith": "E. E. Doc Smith",
    "E. E. Smith": "E. E. Doc Smith",
    "A. E. van Vogt": "A. E. Van Vogt",
    "A. E. Van Vogt": "A. E. Van Vogt",
  }
};

/**
 * Normalizuje dane na podstawie zdefiniowanych mapowań wyjątków.
 * Jeśli wartość nie znajduje się w mapowaniu, zwraca wartość oryginalną.
 */
export function normalizeData(value: string, context: NormalizationContext): string {
    if (!value) return value;
    const trimmed = value.trim();
    const lowerTrimmed = trimmed.toLowerCase();
    
    const contextMapping = MAPPINGS[context];
    if (contextMapping) {
        // First try exact match
        if (contextMapping[trimmed]) return contextMapping[trimmed];
        
        // Then try case-insensitive match
        for (const key in contextMapping) {
            if (key.toLowerCase() === lowerTrimmed) {
                return contextMapping[key];
            }
        }
    }
    
    return value;
}

/**
 * Sprawdza, czy autor ze strony wiki pasuje do autora z Notion.
 * Chroni przed pobraniem danych z niewłaściwej strony o tym samym tytule
 * (inna książka, film, strona ujednoznaczniająca).
 * Brak autora po którejkolwiek stronie jest akceptowany (strony wiki nie
 * zawsze mają infobox z autorem).
 */
export function isWikiAuthorMatch(wikiAuthor: string, notionAuthor: string): boolean {
    if (!wikiAuthor || !notionAuthor) return true;
    const normWiki = normalizeData(wikiAuthor, 'author').toLowerCase().trim();
    const normNotion = normalizeData(notionAuthor, 'author').toLowerCase().trim();
    if (!normWiki || !normNotion) return true;
    if (normWiki === normNotion) return true;

    // Dopasowanie na poziomie CAŁYCH SŁÓW, nie surowego substringa. Wcześniej
    // `normNotion.includes(normWiki)` akceptowało kolizje prefiksowe — "lem"
    // pasowało do "lemański", "ann" do "anna" — przepuszczając stronę o innym
    // dziele. Wymagamy, by krótsze nazwisko było PEŁNYM imieniem (≥2 słowa)
    // w całości zawartym w drugim.
    const words = (s: string) => new Set(s.split(/[\s,]+/).filter(Boolean));
    const a = words(normWiki);
    const b = words(normNotion);
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    if (small.size >= 2 && [...small].every((w) => big.has(w))) return true;

    return calculateSimilarity(normWiki, normNotion) > 0.6;
}
