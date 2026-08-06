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
