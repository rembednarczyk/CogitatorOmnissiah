import React from "react";

/**
 * Ozdoby regału w klimacie Adeptus Mechanicus („atrybuty z fabuły" + kwiatki):
 * mosiężne narożniki, pieczęć czystości na wstędze, sygil koła zębatego.
 * Czysto dekoracyjne (aria-hidden) — nie wpływają na drag&drop.
 */

type Corner = "tl" | "tr" | "bl" | "br";

/** Sygil koła zębatego Mechanicus (na gzymsie). */
export const CogSigil: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg aria-hidden viewBox="0 0 48 48" className={className}>
    <defs>
      <radialGradient id="cog-brass" cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#ffe9b0" />
        <stop offset="0.55" stopColor="#c8961f" />
        <stop offset="1" stopColor="#6b4a08" />
      </radialGradient>
    </defs>
    <g fill="url(#cog-brass)" stroke="rgba(0,0,0,.4)" strokeWidth="0.6">
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x="22.4" y="1.5" width="3.2" height="8" rx="1" transform={`rotate(${i * 36} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="15.5" />
    </g>
    <circle cx="24" cy="24" r="11" fill="#241706" stroke="#e9c877" strokeWidth="1" />
    {/* Stylizowana czaszka Mechanicus — pół twarz, pół czacha */}
    <circle cx="24" cy="21" r="6" fill="#d9c9a8" />
    <circle cx="21.6" cy="21" r="1.4" fill="#241706" />
    <circle cx="26.4" cy="21" r="1.4" fill="#241706" />
    <rect x="22" y="25" width="4" height="4.5" rx="1" fill="#d9c9a8" />
  </svg>
);

/* ===================== Warstwa cyfrowa / noosferyczna ===================== */

const TEAL = "#3fe0d0";

/**
 * Godło Mechanicus jako **projekcja holo**: mosiężny cog-skull + wolno obracająca
 * się przerywana aureola noosfery + pulsujący teal-glow. Czysto dekoracyjne.
 */
export const NoosphericCrest: React.FC<{ size?: number; className?: string }> = ({ size = 46, className = "" }) => (
  <div className={className} aria-hidden style={{ width: size, height: size }}>
    <div className="relative w-full h-full">
      <svg viewBox="0 0 86 86" className="noo-spin absolute inset-[-24%] w-[148%] h-[148%]" style={{ opacity: 0.6 }}>
        <circle cx="43" cy="43" r="40" fill="none" stroke={TEAL} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 4" />
        <circle cx="43" cy="43" r="32" fill="none" stroke={TEAL} strokeOpacity="0.3" strokeWidth="1" />
      </svg>
      <div className="noo-pulse absolute inset-0">
        <CogSigil className="w-full h-full" />
      </div>
    </div>
  </div>
);

/** Przewijający się (marquee) ticker danych — inkantacje binarne / machine-cant. */
export const DataTicker: React.FC<{ text: string; tone?: "teal" | "amber"; slow?: boolean; className?: string }> = ({ text, tone = "teal", slow, className = "" }) => {
  const color = tone === "amber" ? "#f2c14e" : TEAL;
  return (
    <div
      className={`overflow-hidden rounded-[3px] flex items-center h-[18px] ${className}`}
      style={{ border: "1px solid rgba(216,184,119,.30)", background: "linear-gradient(180deg,rgba(10,7,4,.9),rgba(5,3,2,.9))", boxShadow: "inset 0 0 8px rgba(63,224,208,.12)" }}
      aria-hidden
    >
      <div className={`flex whitespace-nowrap ${slow ? "noo-marquee-slow" : "noo-marquee"}`}>
        {[0, 1].map((k) => (
          <span key={k} className="font-mono px-4" style={{ fontSize: 10.5, letterSpacing: "0.14em", lineHeight: "18px", color, textShadow: `0 0 7px ${color}99` }}>{text}</span>
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
        backgroundImage:
          "linear-gradient(90deg, rgba(63,224,208,.10) 1px, transparent 1px), linear-gradient(180deg, rgba(63,224,208,.07) 1px, transparent 1px)",
        backgroundSize: "30px 30px, 30px 30px",
        WebkitMaskImage: "radial-gradient(120% 90% at 50% 120%, #000, transparent 72%)",
        maskImage: "radial-gradient(120% 90% at 50% 120%, #000, transparent 72%)",
      }}
    />
    <div
      className="noo-scan absolute inset-x-0 h-[22px]"
      style={{ background: "linear-gradient(180deg, rgba(63,224,208,0), rgba(63,224,208,.16), rgba(63,224,208,0))", ["--noo-scan-h" as string]: "920px" }}
    />
  </div>
);

/** Narożnik HUD (celownik) — teal, pulsujący. */
export const HudCorner: React.FC<{ corner: Corner }> = ({ corner }) => {
  const base = "absolute w-4 h-4 z-20 pointer-events-none noo-pulse";
  const box: Record<Corner, React.CSSProperties> = {
    tl: { top: 6, left: 6, borderTop: `2px solid ${TEAL}`, borderLeft: `2px solid ${TEAL}` },
    tr: { top: 6, right: 6, borderTop: `2px solid ${TEAL}`, borderRight: `2px solid ${TEAL}`, animationDelay: ".6s" },
    bl: { bottom: 6, left: 6, borderBottom: `2px solid ${TEAL}`, borderLeft: `2px solid ${TEAL}`, animationDelay: "1.2s" },
    br: { bottom: 6, right: 6, borderBottom: `2px solid ${TEAL}`, borderRight: `2px solid ${TEAL}`, animationDelay: "1.8s" },
  };
  return <span className={base} style={box[corner]} aria-hidden />;
};

/** Pieczęć czystości zwisająca na wstędze (kwiatek + atrybut z fabuły). */
export const PuritySeal: React.FC<{ className?: string; rotate?: number }> = ({ className = "", rotate = -8 }) => (
  <div
    aria-hidden
    className={`absolute pointer-events-none select-none ${className}`}
    style={{ transform: `rotate(${rotate}deg)`, transformOrigin: "top center" }}
    title="Pieczęć czystości"
  >
    {/* Wstęga pergaminu */}
    <div className="relative flex flex-col items-center">
      <div className="w-[13px] h-9 bg-gradient-to-b from-[#e8dcc0] via-[#d8c8a2] to-[#b9a271] shadow-[0_2px_4px_rgba(0,0,0,.5)]"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 86%, 50% 100%, 0 86%)" }} />
      {/* Woskowa pieczęć */}
      <div className="-mt-3 w-[22px] h-[22px] rounded-full flex items-center justify-center shadow-[0_2px_5px_rgba(0,0,0,.6),inset_0_2px_3px_rgba(255,255,255,.25)]"
        style={{ background: "radial-gradient(circle at 35% 30%, #a83246, #6d1526 65%, #3f0a15)" }}>
        <span className="text-[11px] leading-none text-amber-200/70 font-black" style={{ textShadow: "0 1px 1px rgba(0,0,0,.6)" }}>☼</span>
      </div>
    </div>
  </div>
);
