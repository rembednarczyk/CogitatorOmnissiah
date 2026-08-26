import React from "react";
import { highlight } from "../../utils/bookSearch";

/** Renders text with fragments matched by the query highlighted. */
export const HighlightedText: React.FC<{ text: string; query: string; className?: string }> = ({ text, query, className }) => {
  const segments = highlight(text, query);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.hit ? (
          <mark key={i} className="bg-cyan-500/25 text-cyan-200 rounded-[3px] px-0.5">{seg.text}</mark>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        )
      )}
    </span>
  );
};
