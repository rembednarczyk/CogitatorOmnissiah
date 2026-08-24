import React from "react";

/**
 * Ozdoby regału w klimacie Adeptus Mechanicus („atrybuty z fabuły" + kwiatki):
 * mosiężne narożniki, pieczęć czystości na wstędze, sygil koła zębatego.
 * Czysto dekoracyjne (aria-hidden) — nie wpływają na drag&drop.
 */

type Corner = "tl" | "tr" | "bl" | "br";

/**
 * Sygil koła zębatego Mechanicus (cog-skull). Kolory pochodzą ze zmiennych skóry
 * (`--sk-cog-*`), więc przełączenie skóry przemalowuje go bez zmiany komponentu.
 */
export const CogSigil: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg aria-hidden viewBox="0 0 48 48" className={className}>
    <g style={{ fill: "var(--sk-cog-ring)" }} stroke="rgba(0,0,0,.4)" strokeWidth="0.6">
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x="22.4" y="1.5" width="3.2" height="8" rx="1" transform={`rotate(${i * 36} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="15.5" />
    </g>
    <circle cx="24" cy="24" r="11" style={{ fill: "var(--sk-cog-disc)" }} />
    {/* Stylizowana czaszka Mechanicus — pół twarz, pół czacha */}
    <circle cx="24" cy="21" r="6" style={{ fill: "var(--sk-cog-skull)" }} />
    <circle cx="21.6" cy="21" r="1.4" style={{ fill: "var(--sk-cog-disc)" }} />
    <circle cx="26.4" cy="21" r="1.4" style={{ fill: "var(--sk-cog-disc)" }} />
    <rect x="22" y="25" width="4" height="4.5" rx="1" style={{ fill: "var(--sk-cog-skull)" }} />
  </svg>
);

/* ===================== Warstwa cyfrowa / noosferyczna ===================== */
/* Kolor poświaty pochodzi ze zmiennej skóry `--noo-glow` (triplet RGB). */
const GLOW = (a: number) => `rgba(var(--noo-glow), ${a})`;
const ACCENT2 = (a: number) => `rgba(var(--noo-accent2), ${a})`;

/**
 * Godło Mechanicus jako **projekcja holo**: cog-skull + wolno obracająca się
 * przerywana aureola noosfery (drugi pierścień w akcencie skóry) + pulsujący glow.
 * Czysto dekoracyjne.
 */
export const NoosphericCrest: React.FC<{ size?: number; className?: string }> = ({ size = 46, className = "" }) => (
  <div className={className} aria-hidden style={{ width: size, height: size }}>
    <div className="relative w-full h-full">
      <svg viewBox="0 0 86 86" className="noo-spin absolute inset-[-24%] w-[148%] h-[148%]" style={{ opacity: 0.6 }}>
        <circle cx="43" cy="43" r="40" fill="none" stroke={GLOW(0.5)} strokeWidth="1" strokeDasharray="3 4" />
        <circle cx="43" cy="43" r="32" fill="none" stroke={ACCENT2(0.35)} strokeWidth="1" />
      </svg>
      <div className="noo-pulse absolute inset-0">
        <CogSigil className="w-full h-full" />
      </div>
    </div>
  </div>
);

/** Przewijający się (marquee) ticker danych — inkantacje binarne / machine-cant. */
export const DataTicker: React.FC<{ text: string; tone?: "glow" | "accent"; slow?: boolean; className?: string }> = ({ text, tone = "glow", slow, className = "" }) => {
  const color = tone === "accent" ? ACCENT2(1) : GLOW(1);
  return (
    <div
      className={`overflow-hidden rounded-[3px] flex items-center h-[18px] ${className}`}
      style={{ border: `1px solid ${GLOW(0.3)}`, background: "linear-gradient(180deg,rgba(4,8,14,.9),rgba(2,4,8,.9))", boxShadow: `inset 0 0 8px ${GLOW(0.12)}` }}
      aria-hidden
    >
      <div className={`flex whitespace-nowrap ${slow ? "noo-marquee-slow" : "noo-marquee"}`}>
        {[0, 1].map((k) => (
          <span key={k} className="font-mono px-4" style={{ fontSize: 10.5, letterSpacing: "0.14em", lineHeight: "18px", color, textShadow: `0 0 7px ${tone === "accent" ? ACCENT2(0.6) : GLOW(0.6)}` }}>{text}</span>
        ))}
      </div>
    </div>
  );
};

/** Nakładka: subtelna siatka noosfery + przesuwający się skanline (CRT). */
export const HoloField: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
    <div
      className="absolute inset-0 opacity-50"
      style={{
        backgroundImage: `linear-gradient(90deg, ${GLOW(0.1)} 1px, transparent 1px), linear-gradient(180deg, ${GLOW(0.07)} 1px, transparent 1px)`,
        backgroundSize: "30px 30px, 30px 30px",
        WebkitMaskImage: "radial-gradient(120% 90% at 50% 120%, #000, transparent 72%)",
        maskImage: "radial-gradient(120% 90% at 50% 120%, #000, transparent 72%)",
      }}
    />
    <div
      className="noo-scan absolute inset-x-0 h-[22px]"
      style={{ background: `linear-gradient(180deg, ${GLOW(0)}, ${GLOW(0.16)}, ${GLOW(0)})`, ["--noo-scan-h" as string]: "920px" }}
    />
  </div>
);

/** Narożnik HUD (celownik) — w kolorze poświaty skóry, pulsujący. */
export const HudCorner: React.FC<{ corner: Corner }> = ({ corner }) => {
  const base = "absolute w-4 h-4 z-20 pointer-events-none noo-pulse";
  const c = GLOW(1);
  const box: Record<Corner, React.CSSProperties> = {
    tl: { top: 6, left: 6, borderTop: `2px solid ${c}`, borderLeft: `2px solid ${c}` },
    tr: { top: 6, right: 6, borderTop: `2px solid ${c}`, borderRight: `2px solid ${c}`, animationDelay: ".6s" },
    bl: { bottom: 6, left: 6, borderBottom: `2px solid ${c}`, borderLeft: `2px solid ${c}`, animationDelay: "1.2s" },
    br: { bottom: 6, right: 6, borderBottom: `2px solid ${c}`, borderRight: `2px solid ${c}`, animationDelay: "1.8s" },
  };
  return <span className={base} style={box[corner]} aria-hidden />;
};
