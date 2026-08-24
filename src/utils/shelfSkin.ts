/**
 * Skóry regału — sterowane wyłącznie zmiennymi CSS (`.skin-*` w `index.css`),
 * więc przełączenie to tylko podmiana klasy na wrapperze. Wybór trwa w localStorage.
 */
export type ShelfSkin = "holo" | "noospheric";

export const SHELF_SKINS: { id: ShelfSkin; label: string }[] = [
  { id: "holo", label: "Holo+" },
  { id: "noospheric", label: "Relikwiarz" },
];

const KEY = "shelfSkin";

export const skinClass = (s: ShelfSkin): string => (s === "holo" ? "skin-holo" : "skin-noospheric");

/** Domyślnie **Holo+**; odczyt odporny na brak/uszkodzony localStorage. */
export function loadSkin(): ShelfSkin {
  try {
    const s = localStorage.getItem(KEY);
    return s === "noospheric" || s === "holo" ? s : "holo";
  } catch {
    return "holo";
  }
}

export function saveSkin(s: ShelfSkin): void {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* prywatny tryb / brak dostępu — wybór po prostu nie przetrwa reloadu */
  }
}
