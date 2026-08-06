import { useState, useEffect } from "react";

export interface WikiLink {
  name: string;
  url: string;
  title: string;
}

export function useWikiUpdates(wikiLinks: WikiLink[], enabled: boolean) {
  const [wikiUpdates, setWikiUpdates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    wikiLinks.forEach(async (link) => {
      try {
        const res = await fetch(`/api/wiki/last-update?title=${encodeURIComponent(link.title)}`);
        const data = await res.json();
        if (!cancelled && data.lastUpdate) {
          setWikiUpdates(prev => ({ ...prev, [link.name]: data.lastUpdate }));
        }
      } catch (error) {
        console.error(`Failed to fetch update for ${link.name}:`, error);
      }
    });

    return () => { cancelled = true; };
  }, [enabled, wikiLinks]);

  return wikiUpdates;
}
