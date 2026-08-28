import React from "react";
import { motion } from "motion/react";

/** Cog-wheel sigil (Mechanicus) — room decoration. Color via `style`, so
 *  the skin variables resolve (`var(--sk-room-cog*)`). */
const CogMark: React.FC<{ size: number; color: string; className?: string; style?: React.CSSProperties }> = ({ size, color, className, style }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} className={`dc-40k ${className ?? ""}`} style={style} aria-hidden>
    <g style={{ fill: color }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x="22.2" y="0.5" width="3.6" height="9" rx="1" transform={`rotate(${i * 30} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="15" />
    </g>
    <circle cx="24" cy="24" r="10.5" fill="none" style={{ stroke: color }} strokeWidth="2" />
    <circle cx="24" cy="24" r="3" style={{ fill: color }} />
  </svg>
);

/** Candle with a flickering flame and warm glow. */
const Sconce: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`dc-40k absolute pointer-events-none ${className ?? ""}`} aria-hidden>
    <svg viewBox="0 0 60 70" width="52" height="60">
      <path d="M30 26 V54 M18 54 h24 M22 54 q8 7 16 0" stroke="#b8860b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="30" cy="24" rx="5" ry="3" fill="#3a2a12" />
    </svg>
    <motion.div
      className="absolute left-[22px] top-[6px] w-[9px] h-[15px] rounded-[50%_50%_45%_45%/60%_60%_40%_40%]"
      style={{ background: "var(--sk-room-flame)" }}
      animate={{ scaleY: [1, 1.14, 0.95, 1.08, 1], opacity: [0.85, 1, 0.8, 1, 0.9] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute -left-[70px] -top-[64px] w-[200px] h-[200px] rounded-full"
      style={{ background: "radial-gradient(closest-side, var(--sk-room-glow), transparent)", filter: "blur(6px)" }}
      animate={{ opacity: [0.65, 0.85, 0.6, 0.8, 0.7] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

/**
 * Boho candle cluster (variant Ś3): three thick, wax-dripping candles of varying
 * height (ivory / clay / beeswax), replacing the thin 40k sconce in the LIGHT skin
 * only (`.candle-boho` — dark keeps its sconce). Flame is bigger and flickers more
 * slowly than the sconce, per the design review.
 */
const flameAnim = (dur: number, delay = 0) => ({
  style: { transformOrigin: "50% 100%", transformBox: "fill-box" as const },
  animate: { scaleY: [1, 1.12, 0.95, 1.07, 1], scaleX: [1, 0.95, 1.05, 0.97, 1], opacity: [0.9, 1, 0.85, 1, 0.92] },
  transition: { duration: dur, repeat: Infinity, ease: "easeInOut" as const, delay },
});

const CandleCluster: React.FC<{ className?: string; flip?: boolean }> = ({ className, flip }) => (
  <div className={`candle-boho absolute pointer-events-none ${className ?? ""}`} aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
    {/* warm pooled glow (bigger, slower) */}
    <motion.div
      className="absolute -left-[46px] -top-[54px] w-[196px] h-[196px] rounded-full"
      style={{ background: "radial-gradient(closest-side, var(--sk-room-glow), transparent)", filter: "blur(8px)" }}
      animate={{ opacity: [0.55, 0.8, 0.5, 0.74, 0.6] }}
      transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
    />
    <svg viewBox="0 0 132 152" width="132" height="152">
      <defs>
        <linearGradient id="cc-iv" x1="0" x2="1"><stop offset="0" stopColor="#e6ddc8" /><stop offset=".4" stopColor="#f5efe1" /><stop offset="1" stopColor="#ddd2b8" /></linearGradient>
        <linearGradient id="cc-bw" x1="0" x2="1"><stop offset="0" stopColor="#c99a3f" /><stop offset=".4" stopColor="#e6bd68" /><stop offset="1" stopColor="#b98a34" /></linearGradient>
        <linearGradient id="cc-cl" x1="0" x2="1"><stop offset="0" stopColor="#b06a44" /><stop offset=".4" stopColor="#cd8f6e" /><stop offset="1" stopColor="#9a5636" /></linearGradient>
        <radialGradient id="cc-fl" cx=".5" cy=".7" r=".7"><stop offset="0" stopColor="#fff6cf" /><stop offset=".5" stopColor="#ffc35f" /><stop offset="1" stopColor="#ef7a1e" /></radialGradient>
      </defs>
      {/* short clay (left) */}
      <rect x="8" y="96" width="26" height="52" rx="7" fill="url(#cc-cl)" />
      <path d="M34 110 q4 16 0 28" stroke="#8a4e33" strokeWidth="3" fill="none" opacity=".55" strokeLinecap="round" />
      <ellipse cx="21" cy="97" rx="13" ry="4.5" fill="#8a4e33" /><ellipse cx="21" cy="95.5" rx="13" ry="4" fill="#cd8f6e" />
      <rect x="19.5" y="82" width="3" height="14" rx="1.5" fill="#4d2c1a" />
      <motion.path d="M21 58 q11 15 0 34 q-11 -19 0 -34" fill="url(#cc-fl)" {...flameAnim(3.8, 0.5)} />
      {/* tall ivory (center) */}
      <rect x="44" y="52" width="30" height="96" rx="8" fill="url(#cc-iv)" />
      <path d="M44 78 q4 22 0 38 M74 88 q-4 20 0 36" stroke="#d7cbaf" strokeWidth="3" fill="none" opacity=".65" strokeLinecap="round" />
      <ellipse cx="59" cy="53" rx="15" ry="5" fill="#cdbf9f" /><ellipse cx="59" cy="51.5" rx="15" ry="4.5" fill="#efe6cf" />
      <path d="M49 53 q3 10 -2 15 q-4 -6 2 -15" fill="#e9dec4" />
      <rect x="57.5" y="36" width="3" height="16" rx="1.5" fill="#5b4a2e" />
      <motion.path d="M59 8 q13 18 0 40 q-13 -22 0 -40" fill="url(#cc-fl)" {...flameAnim(4.4)} />
      {/* medium beeswax (right) */}
      <rect x="84" y="76" width="26" height="72" rx="7" fill="url(#cc-bw)" />
      <path d="M110 96 q4 18 0 32" stroke="#a87e2e" strokeWidth="3" fill="none" opacity=".55" strokeLinecap="round" />
      <ellipse cx="97" cy="77" rx="13" ry="4.5" fill="#a87e2e" /><ellipse cx="97" cy="75.5" rx="13" ry="4" fill="#e6c273" />
      <rect x="95.5" y="60" width="3" height="16" rx="1.5" fill="#4d3c1a" />
      <motion.path d="M97 34 q12 16 0 36 q-12 -20 0 -36" fill="url(#cc-fl)" {...flameAnim(4.0, 0.9)} />
      {/* wax pool */}
      <ellipse cx="60" cy="149" rx="58" ry="6" fill="#cdbb9a" opacity=".55" />
    </svg>
  </div>
);

/** A drifting speck of dust in the light. */
const Mote: React.FC<{ i: number }> = ({ i }) => {
  const left = (i * 61) % 100;
  const top = 12 + ((i * 37) % 60);
  const dur = 7 + (i % 5) * 1.7;
  return (
    <motion.div
      className="dc-40k absolute w-[3px] h-[3px] rounded-full"
      style={{ left: `${left}%`, top: `${top}%`, filter: "blur(1px)", background: "var(--sk-room-mote)" }}
      animate={{ y: [0, -14, 0], opacity: [0.15, 0.5, 0.15] }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: (i % 7) * 0.6 }}
    />
  );
};

/**
 * „Sala Archiwum" — a warm scriptorium around the shelves: paneled wooden wall,
 * floor, sconces with flickering light, banner, cog-wheel sigil, dust
 * and vignette. Purely decorative (aria-hidden). Does not touch the book physics.
 */
export const RoomDecor: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="relative rounded-[20px] overflow-hidden px-4 pt-10 pb-[120px] sm:px-8"
    style={{
      background: "var(--sk-room-bg)",
      boxShadow: "inset 0 2px 0 var(--sk-room-inset), var(--sk-room-topshade, inset 0 40px 80px -40px rgba(0,0,0,.7))",
    }}
  >
    {/* Cog-wheel watermark */}
    <CogMark size={320} color="var(--sk-room-cog)" className="absolute left-1/2 -translate-x-1/2 top-6 opacity-[0.05] pointer-events-none" />

    {/* Sconces — dark skin (40k). Boho shows the candle cluster instead. */}
    <Sconce className="left-3 top-16 hidden md:block" />
    <Sconce className="right-3 top-16 hidden md:block" />
    <CandleCluster className="left-2 top-12 hidden md:block" />
    <CandleCluster className="right-2 top-12 hidden md:block" flip />

    {/* Dust in the air */}
    {Array.from({ length: 16 }).map((_, i) => <Mote key={i} i={i} />)}

    {/* Content (shelves) */}
    <div className="relative z-10">{children}</div>

    {/* Floor */}
    <div className="absolute left-0 right-0 bottom-0 h-[120px] pointer-events-none"
      style={{ background: "var(--sk-room-floor)", boxShadow: "var(--sk-room-floorshade, inset 0 16px 26px -12px rgba(0,0,0,.85))" }} aria-hidden />

    {/* Vignette */}
    <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--sk-room-vignette, radial-gradient(120% 90% at 50% 40%, rgba(0,0,0,0) 45%, rgba(0,0,0,.5) 100%))" }} aria-hidden />
  </div>
);
