import { IntegrityCheckResult } from "../types";

/**
 * Selectors that derive display data from an `IntegrityCheckResult`. Previously
 * this derivation was duplicated in `IntegrityCheckCard` and `SanctityDebugger`,
 * both reading the same `result` off `integritySync.state`. Logic is verbatim.
 */

type YearDiffs = IntegrityCheckResult["yearCountMatch"]["diffs"];
type AwardDiffs = IntegrityCheckResult["awardCountMatch"]["diffs"];

/** Any check failed → there are inconsistencies to show. */
export function hasInconsistencies(result: IntegrityCheckResult): boolean {
  return (
    !result.lpUniqueness.status ||
    !result.yearCountMatch.status ||
    !result.originalTitleUniqueness.status ||
    !result.polishTitleUniqueness.status ||
    !result.awardCountMatch.status
  );
}

/** Structured diff entry for the SanctityDebugger panels. */
export interface DiffEntry {
  title: string;
  notion: number;
  wiki: number;
  notionOnly?: string[];
  wikiOnly?: string[];
  misplaced?: { title: string; otherYear: string }[];
  collisions?: { title: string; matches: string[] }[];
}

/** The two failing-only diff panels (years / awards) for the debugger view. */
export function toDiffPanels(result: IntegrityCheckResult): { id: string; label: string; status: boolean; data: DiffEntry[] }[] {
  return [
    {
      id: "years",
      label: "Rozbieżności Roczników",
      status: result.yearCountMatch.status,
      data: result.yearCountMatch.diffs.map((d) => ({
        title: `Rok ${d.year}`,
        notion: d.notion,
        wiki: d.wiki,
        notionOnly: d.notionOnly,
        wikiOnly: d.wikiOnly,
        misplaced: d.misplaced,
        collisions: d.collisions,
      })),
    },
    {
      id: "awards",
      label: "Rozbieżności Nagród",
      status: result.awardCountMatch.status,
      data: result.awardCountMatch.diffs.map((d) => ({
        title: d.award,
        notion: d.notion,
        wiki: d.wiki,
        notionOnly: d.notionOnly,
        wikiOnly: d.wikiOnly,
      })),
    },
  ].filter((item) => !item.status);
}

/** Flattened year-diff detail lines (with [TYLKO NOTION]/[TYLKO WIKI] bullets) for the check card. */
export function yearDiffLines(diffs: YearDiffs): string[] {
  return diffs.flatMap((d) => {
    const lines = [`Rok ${d.year}: Notion(${d.notion}) vs Wiki(${d.wiki})`];
    if (d.notionOnly && d.notionOnly.length > 0) {
      lines.push(`  [TYLKO NOTION]:`);
      d.notionOnly.forEach((b) => lines.push(`    • ${b}`));
    }
    if (d.wikiOnly && d.wikiOnly.length > 0) {
      lines.push(`  [TYLKO WIKI]:`);
      d.wikiOnly.forEach((b) => lines.push(`    • ${b}`));
    }
    return lines;
  });
}

/** One line per award-count diff for the check card. */
export function awardDiffLines(diffs: AwardDiffs): string[] {
  return diffs.map((d) => `${d.award}: Notion(${d.notion}) vs Wiki(${d.wiki})`);
}
