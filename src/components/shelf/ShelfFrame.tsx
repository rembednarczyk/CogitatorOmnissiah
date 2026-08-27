import React from "react";
import { CogSigil, NoosphericCrest, DataTicker, HoloField, HudCorner } from "./ShelfOrnaments";

export type ShelfAccent = "emerald" | "cyan" | "purple";

const ACCENT: Record<ShelfAccent, { text: string; chip: string; glow: string; ring: string }> = {
  emerald: { text: "text-emerald-200", chip: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200", glow: "shadow-[0_0_28px_rgba(52,211,153,.22)]", ring: "border-emerald-400/50" },
  cyan: { text: "text-cyan-200", chip: "bg-cyan-500/10 border-cyan-500/30 text-cyan-200", glow: "shadow-[0_0_28px_rgba(34,211,238,.22)]", ring: "border-cyan-400/50" },
  purple: { text: "text-purple-200", chip: "bg-purple-500/10 border-purple-500/30 text-purple-200", glow: "shadow-[0_0_28px_rgba(168,85,247,.22)]", ring: "border-purple-400/50" },
};

interface Props {
  title: string;
  icon: React.ReactNode;
  accent: ShelfAccent;
  count: number;
  /** Frame highlight state: drop target / active drag / at rest. */
  highlight?: "idle" | "target" | "dragging";
  /** Extra content on the right of the cornice (e.g. scan button, „upuść tutaj"). */
  headerExtra?: React.ReactNode;
  /** Drag&drop handlers mounted on the furniture body. */
  rootProps?: React.HTMLAttributes<HTMLDivElement>;
  children: React.ReactNode;
}

/**
 * Wooden shelf body (cornice + sides + plinth) with Mechanicus ornaments.
 * The interior (the shelf's „back") holds the passed-in spines/covers. Reusable by
 * both shelves and the „Wyróżnione" section.
 */
export const ShelfFrame: React.FC<Props> = ({ title, icon, accent, count, highlight = "idle", headerExtra, rootProps, children }) => {
  const a = ACCENT[accent];
  // Idle: border color and glow come from the skin (`--sk-frame-*`) — brown in
  // Relikwiarz, cyan-glow in Holo+. The target/dragging states override via class.
  const stateRing =
    highlight === "target" ? `${a.ring} ${a.glow}` :
    highlight === "dragging" ? "border-amber-400/30 border-dashed" :
    "";

  return (
    <div
      {...rootProps}
      className={`relative rounded-[18px] border-2 transition-all duration-200 ${stateRing}`}
      style={{
        background: "var(--sk-cab-bg)",
        boxShadow: "0 24px 40px -22px rgba(0,0,0,.85), inset 0 1px 0 rgba(var(--noo-glow),.10), var(--sk-frame-glow)",
        ...(highlight === "idle" ? { borderColor: "var(--sk-frame-border)" } : {}),
      }}
    >
      {/* Side posts + plinth form the padding; the cornice is applied via top padding */}
      <div className="px-3 pb-4 pt-[52px] sm:px-4">
        {/* Cornice */}
        <div
          className="absolute top-0 inset-x-0 h-[46px] rounded-t-[16px] flex items-center gap-3 px-4 overflow-hidden"
          style={{
            background: "var(--sk-cornice-bg)",
            boxShadow: "inset 0 -2px 5px rgba(0,0,0,.6), inset 0 1px 0 rgba(var(--noo-glow),.14)",
          }}
        >
          {/* Cog-wheel sigil */}
          <CogSigil className="w-7 h-7 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]" />
          <span className={a.text}>{icon}</span>
          <h3 className="text-sm font-display font-bold uppercase tracking-[0.22em] text-amber-100/90 truncate min-w-0 drop-shadow-[0_1px_2px_rgba(0,0,0,.7)]">
            {title}
          </h3>
          <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${a.chip}`}>{count}</span>
          {/* Data ticker (scrolling) — fills the free space of the cornice */}
          <DataTicker className="ml-3 hidden sm:flex flex-1 min-w-0 max-w-[280px]" text="++ LIBREM·SYNC ++ 01001101·01000001·01010011 ++ KOLEKCJA·FANTASTYKI ++" />
          <div className="ml-auto shrink-0 flex items-center gap-3">{headerExtra}</div>
          {/* Subtle light strip under the cornice (in the color of the Regał frame) */}
          <div className="absolute bottom-0 inset-x-6 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(var(--sk-frame-accent),.28), transparent)" }} />
        </div>

        {/* Shelf interior — dark „back" with vertical boards + holo layer */}
        <div
          className="relative rounded-lg p-3 pt-4 overflow-hidden"
          style={{
            background: "var(--sk-well-bg)",
            boxShadow: "inset 0 3px 12px rgba(0,0,0,.75), inset 0 -2px 6px rgba(0,0,0,.5)",
          }}
        >
          <HoloField />
          <div className="relative z-10">{children}</div>
        </div>
      </div>

      {/* Holo emblem (projection) + HUD corners */}
      <NoosphericCrest className="absolute -top-[22px] left-1/2 -translate-x-1/2 z-20" size={46} />
      <HudCorner corner="tl" />
      <HudCorner corner="tr" />
      <HudCorner corner="bl" />
      <HudCorner corner="br" />
    </div>
  );
};
