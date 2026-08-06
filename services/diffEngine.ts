export class DiffEngine {
  /**
   * Porównuje dwie wartości typu multi_select (np. "Zysk, MAG" i "MAG, Zysk").
   * Rozdziela po przecinku, usuwa białe znaki, sortuje i porównuje.
   */
  static isMultiSelectEqual(val1: string, val2: string): boolean {
    const normalize = (s: string) => 
      (s || "")
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .sort()
        .join(',');
        
    return normalize(val1) === normalize(val2);
  }

  /**
   * Standardowe porównanie stringów z pominięciem spacji brzegowych.
   */
  static isStringEqual(val1: string, val2: string): boolean {
    return (val1 || "").trim() === (val2 || "").trim();
  }
}
