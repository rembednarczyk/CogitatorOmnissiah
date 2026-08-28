/**
 * Theme-aware favicon. The two icons (boho for light, 40k for dark) and the DOM
 * wiring are defined once in the pre-mount inline script in `index.html` — that
 * placement is what lets the correct icon paint before React mounts (no flash),
 * mirroring how the theme itself is set there. This helper just forwards the
 * active theme to that script on every toggle.
 */
declare global {
  interface Window {
    __setFavicon?: (theme: "light" | "dark") => void;
  }
}

export function applyFavicon(theme: "light" | "dark"): void {
  if (typeof window !== "undefined") window.__setFavicon?.(theme);
}
