export function cleanTitle(title: string): string {
  if (!title) return "";
  return title.replace(/\s+/g, ' ').trim();
}

export function sanitizeNotionString(s: string, maxLength: number = 2000): string {
  if (!s) return "";
  // Notion doesn't like some control characters or very long strings
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, maxLength);
}

export function sanitizeNotionTag(s: string): string {
  if (!s) return "";
  // Notion multi-select/select options cannot contain commas and have a 100 char limit
  return s.replace(/,/g, '')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 100);
}

export function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function stripWikiFormatting(title: string): string {
  if (!title) return "";
  return title
    .replace(/''+/g, '') // Remove wiki italics/bold
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2') // Remove wiki links, keep text
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

export function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  
  const costs = new Array();
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (shorter.charAt(i - 1) !== longer.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  return (longer.length - costs[longer.length]) / parseFloat(longer.length.toString());
}

export function countCommonWords(title1: string, title2: string): number {
  const STOP_WORDS = new Set(['w', 'na', 'nad', 'pod', 'z', 'ze', 'i', 'a', 'o', 'do', 'dla', 'od', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'with']);
  
  const getSignificantWords = (title: string) => 
    new Set(title.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)));

  const words1 = getSignificantWords(title1);
  const words2 = getSignificantWords(title2);
  
  let common = 0;
  for (const w1 of words1) {
    if (words2.has(w1)) common++;
  }
  return common;
}

export function normalizeAuthor(author: string): string {
  if (!author) return "";
  
  // Remove years in parentheses like (1968- ) or (1968-2020)
  let normalized = author.replace(/\(\d{4}-\s*\d*\)/g, '');
  
  // Remove other parentheses and their contents
  normalized = normalized.replace(/\(.*?\)/g, '');
  
  // Convert to lowercase
  normalized = normalized.toLowerCase();
  
  // Handle "Last, First" format
  if (normalized.includes(',')) {
    const parts = normalized.split(',').map(p => p.trim());
    if (parts.length === 2) {
      normalized = `${parts[1]} ${parts[0]}`;
    }
  }
  
  // Remove punctuation/symbols but KEEP every Unicode letter and digit.
  // The old class [^\w\s\u0100-\u017F] used ASCII \w plus only Latin Extended-A,
  // so it silently deleted Latin-1 accented letters \u2014 "Wr\u00F3blewski" \u2192 "wrblewski",
  // "Jos\u00E9" \u2192 "jos" \u2014 corrupting author-match keys. \p{L} keeps all letters.
  normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

  return normalized;
}
