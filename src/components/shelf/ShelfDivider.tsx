import React from "react";

interface Props {
  label: string;      // np. „1950–1959" (w przyszłości litera alfabetu / nazwisko autora)
  width?: number;
  height?: number;
}

/**
 * Generyczna **tabliczka-przekładka** stojąca na półce między woluminami — czytelny
 * znacznik sekcji. Dziś nadaje ją dekada wydania; ten sam komponent obsłuży dowolną
 * etykietę (litera alfabetu, nazwisko autora itp.). Nieprzeciągalna.
 */
export const ShelfDivider: React.FC<Props> = ({ label, width = 34, height = 156 }) => (
  <div
    className="relative shrink-0 flex items-center justify-center select-none rounded-t-[7px] rounded-b-[2px]"
    style={{
      width, height,
      background: "linear-gradient(180deg, #ecdfbe 0%, #d5c193 55%, #b89c68 100%)",
      boxShadow: "inset 0 0 0 1.5px rgba(120,80,30,.45), inset 1.5px 0 0 rgba(255,255,255,.45), inset -1px 0 4px rgba(90,60,20,.35), 0 8px 12px -6px rgba(0,0,0,.6)",
    }}
    title={label}
    aria-hidden
  >
    {/* mosiężny guzik u góry */}
    <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-[11px] h-[11px] rounded-full"
      style={{ background: "radial-gradient(circle at 40% 35%, #f7e0a0, #b8860b 68%, #6b4a08)", boxShadow: "0 1px 2px rgba(0,0,0,.4)" }} />
    <span
      className="font-display font-black"
      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#4a3418", fontSize: 12.5, letterSpacing: "0.06em", marginTop: 10, textShadow: "0 1px 0 rgba(255,255,255,.35)" }}
    >
      {label}
    </span>
  </div>
);
