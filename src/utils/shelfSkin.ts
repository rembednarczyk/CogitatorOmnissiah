/**
 * Regał skins — driven solely by CSS variables (`.skin-*` in `index.css`),
 * so switching is just swapping the class on the wrapper. The choice persists in localStorage.
 */
export type ShelfSkin = "holo" | "noospheric";

export const SHELF_SKINS: { id: ShelfSkin; label: string }[] = [
  { id: "holo", label: "Holo+" },
  { id: "noospheric", label: "Klasyczny" },
];

const KEY = "shelfSkin";

export const skinClass = (s: ShelfSkin): string => (s === "holo" ? "skin-holo" : "skin-noospheric");

/** Default **Holo+**; read resilient to missing/corrupt localStorage. */
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
    /* private mode / no access — the choice simply won't survive a reload */
  }
}
