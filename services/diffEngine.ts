export class DiffEngine {
  /**
   * Compares two multi_select values (e.g. "Zysk, MAG" and "MAG, Zysk").
   * Splits on comma, strips whitespace, sorts and compares.
   * The comparison is case-insensitive: Notion matches multi_select options
   * regardless of case and keeps its own spelling, so a difference in case
   * alone (e.g. "Zysk i S-ka" vs "Zysk i s-ka") is not a real change
   * and must not trigger an update on every sync.
   */
  static isMultiSelectEqual(val1: string, val2: string): boolean {
    const normalize = (s: string) =>
      (s || "")
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0)
        .sort()
        .join(',');

    return normalize(val1) === normalize(val2);
  }

  /**
   * Standard string comparison ignoring leading/trailing whitespace.
   */
  static isStringEqual(val1: string, val2: string): boolean {
    return (val1 || "").trim() === (val2 || "").trim();
  }
}
