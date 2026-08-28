import { useCallback, useEffect, useState } from "react";
import { applyFavicon } from "../utils/favicon";

/**
 * App theme: „light" = Librem (jasny boho), „dark" = Warhammer (dotychczasowy).
 * DEFAULT = light. The chosen theme is stored on `<html data-theme>` (an inline
 * script in index.html sets it before React mounts, so there's no flash) and
 * persisted in localStorage.
 */
export type Theme = "light" | "dark";
const KEY = "librem-theme";

function readInitial(): Theme {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.theme;
    if (attr === "light" || attr === "dark") return attr;
  }
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* private mode / blocked */ }
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
    applyFavicon(theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), []);
  return { theme, toggle };
}
