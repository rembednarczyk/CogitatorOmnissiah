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
 * Normalizes data based on the defined exception mappings.
 * If the value isn't in the mapping, returns the original value.
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
 * Checks whether the author from the wiki page matches the author from Notion.
 * Guards against pulling data from the wrong page with the same title
 * (a different book, a film, a disambiguation page).
 * A missing author on either side is accepted (wiki pages don't
 * always have an author infobox).
 */
export function isWikiAuthorMatch(wikiAuthor: string, notionAuthor: string): boolean {
    if (!wikiAuthor || !notionAuthor) return true;
    const normWiki = normalizeData(wikiAuthor, 'author').toLowerCase().trim();
    const normNotion = normalizeData(notionAuthor, 'author').toLowerCase().trim();
    if (!normWiki || !normNotion) return true;
    if (normWiki === normNotion) return true;

    // Matching at the level of WHOLE WORDS, not a raw substring. Previously
    // `normNotion.includes(normWiki)` accepted prefix collisions — "lem"
    // matched "lemański", "ann" matched "anna" — letting through a page about a different
    // work. We require the shorter name to be a FULL name (≥2 words)
    // fully contained in the other.
    const words = (s: string) => new Set(s.split(/[\s,]+/).filter(Boolean));
    const a = words(normWiki);
    const b = words(normNotion);
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    if (small.size >= 2 && [...small].every((w) => big.has(w))) return true;

    return calculateSimilarity(normWiki, normNotion) > 0.6;
}
