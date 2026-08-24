import { useEffect, useState } from "react";

/** Reaktywny match media-query (np. „(min-width: 1024px)"). SSR-safe. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && "matchMedia" in window ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}
