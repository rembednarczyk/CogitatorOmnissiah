import React from "react";
import { motion } from "motion/react";

/** Sygil koła zębatego (Mechanicus) — ozdoba pokoju. Kolor przez `style`, by
 *  rozwiązywały się zmienne skóry (`var(--sk-room-cog*)`). */
const CogMark: React.FC<{ size: number; color: string; className?: string; style?: React.CSSProperties }> = ({ size, color, className, style }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} className={className} style={style} aria-hidden>
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

/** Świeca z migoczącym płomieniem i ciepłą poświatą. */
const Sconce: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`absolute pointer-events-none ${className ?? ""}`} aria-hidden>
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

/** Dryfująca drobinka kurzu w świetle. */
const Mote: React.FC<{ i: number }> = ({ i }) => {
  const left = (i * 61) % 100;
  const top = 12 + ((i * 37) % 60);
  const dur = 7 + (i % 5) * 1.7;
  return (
    <motion.div
      className="absolute w-[3px] h-[3px] rounded-full"
      style={{ left: `${left}%`, top: `${top}%`, filter: "blur(1px)", background: "var(--sk-room-mote)" }}
      animate={{ y: [0, -14, 0], opacity: [0.15, 0.5, 0.15] }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: (i % 7) * 0.6 }}
    />
  );
};

/**
 * „Sala Archiwum" — ciepły skryptorium wokół regałów: drewniana ściana z panelami,
 * podłoga, kinkiety z migoczącym światłem, proporzec, sygil koła zębatego, kurz
 * i winieta. Czysto dekoracyjne (aria-hidden). Fizyki książek nie dotyka.
 */
export const RoomDecor: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="relative rounded-[20px] overflow-hidden px-4 pt-10 pb-[120px] sm:px-8"
    style={{
      background: "var(--sk-room-bg)",
      boxShadow: "inset 0 2px 0 var(--sk-room-inset), inset 0 40px 80px -40px rgba(0,0,0,.7)",
    }}
  >
    {/* Znak wodny koła zębatego */}
    <CogMark size={320} color="var(--sk-room-cog)" className="absolute left-1/2 -translate-x-1/2 top-6 opacity-[0.05] pointer-events-none" />

    {/* Kinkiety */}
    <Sconce className="left-3 top-16 hidden md:block" />
    <Sconce className="right-3 top-16 hidden md:block" />

    {/* Kurz w powietrzu */}
    {Array.from({ length: 16 }).map((_, i) => <Mote key={i} i={i} />)}

    {/* Treść (regały) */}
    <div className="relative z-10">{children}</div>

    {/* Podłoga */}
    <div className="absolute left-0 right-0 bottom-0 h-[120px] pointer-events-none"
      style={{ background: "var(--sk-room-floor)", boxShadow: "inset 0 16px 26px -12px rgba(0,0,0,.85)" }} aria-hidden />

    {/* Winieta */}
    <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(120% 90% at 50% 40%, rgba(0,0,0,0) 45%, rgba(0,0,0,.5) 100%)" }} aria-hidden />
  </div>
);
