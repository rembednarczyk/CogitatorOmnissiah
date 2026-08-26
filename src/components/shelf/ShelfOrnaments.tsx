import React from "react";

/**
 * Shelf ornaments in the Adeptus Mechanicus vibe („lore attributes" + flourishes):
 * brass corners, purity seal on a ribbon, cog-wheel sigil.
 * Purely decorative (aria-hidden) — they don't affect drag&drop.
 */

type Corner = "tl" | "tr" | "bl" | "br";

/**
 * Mechanicus cog-wheel sigil (cog-skull). Colors come from the skin variables
 * (`--sk-cog-*`), so switching the skin repaints it without changing the component.
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
    {/* Stylized Mechanicus skull — half face, half cranium */}
    <circle cx="24" cy="21" r="6" style={{ fill: "var(--sk-cog-skull)" }} />
    <circle cx="21.6" cy="21" r="1.4" style={{ fill: "var(--sk-cog-disc)" }} />
    <circle cx="26.4" cy="21" r="1.4" style={{ fill: "var(--sk-cog-disc)" }} />
    <rect x="22" y="25" width="4" height="4.5" rx="1" style={{ fill: "var(--sk-cog-skull)" }} />
  </svg>
);

/* ===================== Digital / noospheric layer ===================== */
/* The glow color comes from the skin variable `--noo-glow` (RGB triplet). */
const GLOW = (a: number) => `rgba(var(--noo-glow), ${a})`;
const ACCENT2 = (a: number) => `rgba(var(--noo-accent2), ${a})`;

/**
 * Mechanicus emblem as a **holo projection**: cog-skull + a slowly rotating
 * dashed noosphere halo (a second ring in the skin accent) + a pulsing glow.
 * Purely decorative.
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

/** Scrolling (marquee) data ticker — binary incantations / machine-cant. */
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

/** Overlay: subtle noosphere grid + a moving scanline (CRT). */
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

/** HUD corner (reticle) — in the color of the Regał FRAME (`--sk-frame-accent`, amber),
 *  pulsing. Locally overrides `--noo-glow` so the pulsing glow is also in the frame accent. */
export const HudCorner: React.FC<{ corner: Corner }> = ({ corner }) => {
  const base = "absolute w-4 h-4 z-20 pointer-events-none noo-pulse";
  const c = "rgb(var(--sk-frame-accent))";
  const common = { ["--noo-glow" as string]: "var(--sk-frame-accent)" };
  const box: Record<Corner, React.CSSProperties> = {
    tl: { ...common, top: 6, left: 6, borderTop: `2px solid ${c}`, borderLeft: `2px solid ${c}` },
    tr: { ...common, top: 6, right: 6, borderTop: `2px solid ${c}`, borderRight: `2px solid ${c}`, animationDelay: ".6s" },
    bl: { ...common, bottom: 6, left: 6, borderBottom: `2px solid ${c}`, borderLeft: `2px solid ${c}`, animationDelay: "1.2s" },
    br: { ...common, bottom: 6, right: 6, borderBottom: `2px solid ${c}`, borderRight: `2px solid ${c}`, animationDelay: "1.8s" },
  };
  return <span className={base} style={box[corner] as React.CSSProperties} aria-hidden />;
};
