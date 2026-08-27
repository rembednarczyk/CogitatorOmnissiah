import { calculateSimilarity, countCommonWords } from "../utils";
import { normalizeData } from "./dataNormalizer";

/**
 * Book-matching primitives — the one place record identity + duplicate scoring
 * live, instead of each service rolling its own. NOTHING here changes existing
 * behavior: every function is the verbatim logic previously inlined in a
 * service. There are deliberately TWO duplicate strategies (they answer
 * different questions), plus the canonical identity key:
 *
 *  - `robustBookKey`      — variation-resistant identity key (integrity merge).
 *  - `scoreDuplicatePair` — the full 7-rule audit (duplicate-detection ritual).
 *  - `isInsertDuplicate`  — the lightweight insert-guard (book sync).
 *
 * Convergence of the *sync* existing-book lookup key onto `robustBookKey` is
 * intentionally NOT done here — it would change which records match.
 */

/**
 * A variation-resistant book identity key: normalizes the author (mappings),
 * sorts and cleans names, normalizes the title. Empty title → empty key
 * (rejected), so "|author" doesn't merge different books by the same author.
 */
export function robustBookKey(author: string, title: string): string {
  const normalizedAuthor = normalizeData(author || "", "author");
  const authors = normalizedAuthor
    .split(",")
    .map((a) =>
      a
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .sort();
  const normAuthor = authors.join(",");

  const normTitle = normalizeData(title || "", "title")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!normTitle) return "";
  return `${normTitle}|${normAuthor}`;
}

export interface DupThresholds {
  /** Author-similarity above which two records count as the same author. */
  authorThreshold: number;
  /** Title-similarity above which two titles count as duplicates. */
  titleThreshold: number;
}

interface MatchableRecord {
  plTitle?: string;
  origTitle?: string;
  author?: string;
}

/**
 * Full duplicate-audit scoring (7 rules), verbatim from `DuplicateSyncService`.
 * Returns the matched rule's `reason`, or `null` when the pair isn't a duplicate.
 */
export function scoreDuplicatePair(
  a: MatchableRecord,
  b: MatchableRecord,
  { authorThreshold, titleThreshold }: DupThresholds,
): { reason: string } | null {
  const titleA = (a.plTitle || "").toLowerCase().trim();
  const titleB = (b.plTitle || "").toLowerCase().trim();
  const origA = (a.origTitle || "").toLowerCase().trim();
  const origB = (b.origTitle || "").toLowerCase().trim();
  const authorA = (a.author || "").toLowerCase().trim();
  const authorB = (b.author || "").toLowerCase().trim();

  if ((!titleA && !origA) || (!titleB && !origB)) return null;

  const sameAuthor = !!authorA && !!authorB && (authorA === authorB || calculateSimilarity(authorA, authorB) > authorThreshold);
  const differentAuthor = !!authorA && !!authorB && !sameAuthor && calculateSimilarity(authorA, authorB) < 0.5; // Clearly different
  if (differentAuthor) return null;

  if (titleA && titleB && titleA === titleB) return { reason: "identyczny tytuł PL" };
  if (origA && origB && origA === origB) return { reason: "identyczny tytuł oryg." };
  if (titleA && titleB && calculateSimilarity(titleA, titleB) > titleThreshold) return { reason: "wysokie podobieństwo PL" };
  if (origA && origB && calculateSimilarity(origA, origB) > titleThreshold) return { reason: "wysokie podobieństwo oryg." };
  if (sameAuthor && ((origA && origB && countCommonWords(origA, origB) >= 2) || (titleA && titleB && countCommonWords(titleA, titleB) >= 2)))
    return { reason: "dopasowanie słów + ten sam autor" };
  if (origA && origB && countCommonWords(origA, origB) >= 2) return { reason: "dopasowanie słów oryg." };
  if (titleA && titleB && countCommonWords(titleA, titleB) >= 2) return { reason: "dopasowanie słów PL" };
  return null;
}

/**
 * Lightweight insert-guard, verbatim from `BookSyncService.runBookSync`: a
 * candidate wiki book is a duplicate of an existing Notion row when the authors
 * are (near-)equal AND the original titles share ≥2 significant words.
 */
export function isInsertDuplicate(
  candidate: { author?: string; originalTitle?: string },
  existing: { author?: string; origTitle?: string },
): boolean {
  const authorA = (candidate.author || "").toLowerCase().trim();
  const authorB = (existing.author || "").toLowerCase().trim();
  const sameAuthor = !!authorA && !!authorB && (authorA === authorB || calculateSimilarity(authorA, authorB) > 0.85);
  return !!(sameAuthor && candidate.originalTitle && existing.origTitle && countCommonWords(candidate.originalTitle, existing.origTitle) >= 2);
}
