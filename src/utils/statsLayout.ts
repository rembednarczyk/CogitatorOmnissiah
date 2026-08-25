/**
 * Czyste helpery kolejności kart statystyk (drag&drop w „Analizie Zasobów").
 *
 * Kolejność użytkownika trzymamy jako listę id sekcji (`ui.statsOrder`). Kod jest
 * odporny na dryf: nowe karty dodane w kodzie, których nie ma w zapisanej liście,
 * dopisujemy na końcu w kolejności kodu; id z zapisu, których już nie ma w kodzie,
 * ignorujemy. Dzięki temu zapisany blob nigdy nie „gubi" ani nie duplikuje karty.
 */

/**
 * Ustala finalną kolejność id: najpierw zapisane (przefiltrowane do istniejących,
 * bez duplikatów), potem pozostałe z `allIds` w kolejności kodu.
 */
export function orderByIds(allIds: string[], savedOrder: string[]): string[] {
  const known = new Set(allIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of savedOrder) {
    if (known.has(id) && !seen.has(id)) { seen.add(id); out.push(id); }
  }
  for (const id of allIds) {
    if (!seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
}

/**
 * Rozkłada elementy na `cols` kolumn round-robin (element i → kolumna i % cols),
 * zachowując czytanie „wiersz po wierszu": 0 i 2 i 4 w lewej, 1 i 3 i 5 w prawej.
 * Każda kolumna pakuje się potem niezależnie (brak sprzężenia wysokości = brak dziur),
 * a kolejność odczytu lewo→prawo, góra→dół pozostaje 0,1,2,3,... Zwraca `cols` list.
 */
export function distributeColumns<T>(items: T[], cols: number): T[][] {
  const n = Math.max(1, Math.floor(cols));
  const out: T[][] = Array.from({ length: n }, () => []);
  items.forEach((it, i) => out[i % n].push(it));
  return out;
}

/**
 * Przenosi `dragId` na pozycję `targetId` (wstawienie przed elementem docelowym w
 * jego bieżącym miejscu). Zwraca nową listę; wejście pozostaje nietknięte.
 * No-op gdy któreś id nie istnieje lub są równe.
 */
export function moveId(order: string[], dragId: string, targetId: string): string[] {
  if (dragId === targetId) return order.slice();
  const from = order.indexOf(dragId);
  const to = order.indexOf(targetId);
  if (from === -1 || to === -1) return order.slice();
  const next = order.slice();
  next.splice(from, 1);
  const insertAt = next.indexOf(targetId);
  next.splice(insertAt, 0, dragId);
  return next;
}
