import React from "react";

/**
 * Ozdoby regału w klimacie Adeptus Mechanicus („atrybuty z fabuły" + kwiatki):
 * mosiężne narożniki, pieczęć czystości na wstędze, sygil koła zębatego.
 * Czysto dekoracyjne (aria-hidden) — nie wpływają na drag&drop.
 */

type Corner = "tl" | "tr" | "bl" | "br";

const CORNER_POS: Record<Corner, string> = {
  tl: "top-1 left-1",
  tr: "top-1 right-1 -scale-x-100",
  bl: "bottom-1 left-1 -scale-y-100",
  br: "bottom-1 right-1 -scale-x-100 -scale-y-100",
};

/** Mosiężny narożnik-okucie (kwiatek introligatorski). */
export const CornerBracket: React.FC<{ corner: Corner }> = ({ corner }) => (
  <svg
    aria-hidden
    viewBox="0 0 40 40"
    className={`absolute w-6 h-6 pointer-events-none opacity-70 ${CORNER_POS[corner]}`}
  >
    <defs>
      <linearGradient id={`brass-${corner}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f5d992" />
        <stop offset="0.5" stopColor="#b8860b" />
        <stop offset="1" stopColor="#6b4a08" />
      </linearGradient>
    </defs>
    <path
      d="M4 4 H22 Q4 8 8 22 V4 Z M4 4 V20 Q6 6 20 6 H4 Z"
      fill={`url(#brass-${corner})`}
      stroke="rgba(0,0,0,.35)"
      strokeWidth="0.6"
    />
    <circle cx="12" cy="12" r="2.4" fill="#2a1c06" stroke="#e9c877" strokeWidth="0.7" />
  </svg>
);

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
