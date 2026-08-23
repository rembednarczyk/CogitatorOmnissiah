import { useState, useCallback } from "react";

/** Kopiowanie do schowka z krótkim stanem „skopiowano" (do ikonki ✓). */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), resetMs);
    });
  }, [resetMs]);
  return { copied, copy };
}
