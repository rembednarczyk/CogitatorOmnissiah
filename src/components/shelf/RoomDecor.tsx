import React from "react";
import { motion } from "motion/react";
import { useEffectiveConfig } from "../../hooks/useAppConfig";

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
 * Boho candles: thick, wax-dripping pillars replacing the thin 40k sconce in the
 * LIGHT skin only (`.candle-boho` — dark keeps its sconce). A single parametric
 * `Candle` (varying thickness = „objętość", tone and height) composes into a
 * `CandleCluster` (three, several distinct arrangements so nothing reads as a
 * mirror image) or a lone `WaxCandle` (for the shelf tops). Flame scales with the
 * candle's girth and flickers slowly.
 */
type Tone = "iv" | "bw" | "cl";
const TONE: Record<Tone, { grad: string; rimD: string; rimL: string; wick: string; drip: string }> = {
  iv: { grad: "cc-iv", rimD: "#cdbf9f", rimL: "#efe6cf", wick: "#5b4a2e", drip: "#d7cbaf" },
  bw: { grad: "cc-bw", rimD: "#a87e2e", rimL: "#e6c273", wick: "#4d3c1a", drip: "#a87e2e" },
  cl: { grad: "cc-cl", rimD: "#8a4e33", rimL: "#cd8f6e", wick: "#4d2c1a", drip: "#8a4e33" },
};

const CandleDefs = () => (
  <defs>
    <linearGradient id="cc-iv" x1="0" x2="1"><stop offset="0" stopColor="#e6ddc8" /><stop offset=".4" stopColor="#f5efe1" /><stop offset="1" stopColor="#ddd2b8" /></linearGradient>
    <linearGradient id="cc-bw" x1="0" x2="1"><stop offset="0" stopColor="#c99a3f" /><stop offset=".4" stopColor="#e6bd68" /><stop offset="1" stopColor="#b98a34" /></linearGradient>
    <linearGradient id="cc-cl" x1="0" x2="1"><stop offset="0" stopColor="#b06a44" /><stop offset=".4" stopColor="#cd8f6e" /><stop offset="1" stopColor="#9a5636" /></linearGradient>
    <radialGradient id="cc-fl" cx=".5" cy=".7" r=".7"><stop offset="0" stopColor="#fff6cf" /><stop offset=".5" stopColor="#ffc35f" /><stop offset="1" stopColor="#ef7a1e" /></radialGradient>
  </defs>
);

interface Spec { x: number; w: number; top: number; tone: Tone; dur: number; delay: number }

/** One thick, wax-dripping candle. Flame size scales with the candle's width. */
const Candle: React.FC<Spec & { baseY?: number; speed?: number }> = ({ x, w, top, tone, dur, delay, baseY = 148, speed = 1 }) => {
  const t = TONE[tone];
  const cx = x + w / 2;
  const H = Math.min(44, Math.max(26, Math.round(w * 1.3)));
  const A = Math.round(H * 0.32);
  const flameBase = top - 4;
  const round = (n: number) => Math.round(n);
  return (
    <g>
      <rect x={x} y={top} width={w} height={baseY - top} rx={Math.min(9, w / 3)} fill={`url(#${t.grad})`} />
      <path d={`M${x + w} ${top + 16} q4 ${round(w * 0.7)} 0 ${round(w * 1.15)}`} stroke={t.drip} strokeWidth="3" fill="none" opacity=".5" strokeLinecap="round" />
      {w > 24 && <path d={`M${x} ${top + 26} q-3 ${round(w * 0.55)} 0 ${round(w * 0.9)}`} stroke={t.drip} strokeWidth="2.5" fill="none" opacity=".4" strokeLinecap="round" />}
      <ellipse cx={cx} cy={top + 1} rx={w / 2 + 2} ry={Math.max(4, w * 0.16)} fill={t.rimD} />
      <ellipse cx={cx} cy={top - 0.5} rx={w / 2 + 2} ry={Math.max(3.5, w * 0.15)} fill={t.rimL} />
      <rect x={cx - 1.5} y={top - 16} width="3" height="16" rx="1.5" fill={t.wick} />
      <motion.path
        d={`M${cx} ${flameBase - H} q${A} ${round(H * 0.45)} 0 ${H} q${-A} ${-round(H * 0.55)} 0 ${-H}`}
        fill="url(#cc-fl)"
        style={{ transformOrigin: "50% 100%", transformBox: "fill-box" }}
        animate={{ scaleY: [1, 1.12, 0.95, 1.07, 1], scaleX: [1, 0.95, 1.05, 0.97, 1], opacity: [0.9, 1, 0.85, 1, 0.92] }}
        transition={{ duration: dur / speed, repeat: Infinity, ease: "easeInOut", delay }}
      />
    </g>
  );
};

/** A single thick wax candle — sits on top of each shelf (above the cornice).
 *  Sized via the SVG width/height (not a CSS transform), so the element's box
 *  equals the drawing and it can be positioned precisely above the frame. */
export const WaxCandle: React.FC<{ className?: string; tone?: Tone; w?: number; speed?: number; scale?: number }> = ({ className, tone = "iv", w = 22, speed = 1, scale = 0.62 }) => {
  const vbw = Math.round(w * 2.3 + 8);
  const vbh = 82;
  const x = 6;
  const glow = 62 * scale;
  return (
    <div className={`candle-boho absolute pointer-events-none ${className ?? ""}`} aria-hidden>
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{ width: glow, height: glow, top: -glow * 0.35, background: "radial-gradient(closest-side, var(--sk-room-glow), transparent)", filter: "blur(5px)" }}
        animate={{ opacity: [0.5, 0.72, 0.48, 0.66, 0.55] }}
        transition={{ duration: 4.4 / speed, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg viewBox={`0 0 ${vbw} ${vbh}`} width={vbw * scale} height={vbh * scale} style={{ display: "block" }}>
        <CandleDefs />
        <Candle x={x} w={w} top={34} baseY={80} tone={tone} dur={4.1} delay={0} speed={speed} />
        <ellipse cx={x + w / 2} cy="81" rx={w * 0.85} ry="3.5" fill="#cdbb9a" opacity=".45" />
      </svg>
    </div>
  );
};

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
export const RoomDecor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Appearance knobs (Konfiguracja → ui). Percent → multiplier: 100 % = as designed.
  const ui = useEffectiveConfig().ui;
  return (
  <div
    className="relative rounded-[20px] overflow-hidden px-4 pt-10 pb-[120px] sm:px-8"
    style={{
      background: "var(--sk-room-bg)",
      boxShadow: "inset 0 2px 0 var(--sk-room-inset), var(--sk-room-topshade, inset 0 40px 80px -40px rgba(0,0,0,.7))",
      // The alpha of the room shadows / candle glow scales off these (see index.css).
      ["--knob-room-shade" as string]: String(ui.shelfRoomShade / 100),
      ["--knob-candle-glow" as string]: String(ui.candleGlow / 100),
    } as React.CSSProperties}
  >
    {/* Cog-wheel watermark */}
    <CogMark size={320} color="var(--sk-room-cog)" className="absolute left-1/2 -translate-x-1/2 top-6 opacity-[0.05] pointer-events-none" />

    {/* Sconces — dark skin (40k) only. In boho the candles live on top of each
        shelf (see Shelf → WaxCandle), so the room background stays clear. */}
    <Sconce className="left-3 top-16 hidden md:block" />
    <Sconce className="right-3 top-16 hidden md:block" />

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
};
