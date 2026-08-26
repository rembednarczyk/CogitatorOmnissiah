import React from "react";
import { LucideIcon } from "lucide-react";
import { RitualColor, getRitualButtonTheme } from "../../theme/ritualColors";

interface RitualButtonProps {
  color: RitualColor;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
  /** Animate the icon: „spin" (loader) or „pulse" (active ritual). */
  animate?: "spin" | "pulse";
  disabled?: boolean;
  /** Extra layout classes, e.g. `sm:col-span-2`. */
  className?: string;
}

/**
 * A ritual-style button from the sync liturgies (see OtherToolsCard): dark
 * slate-950 base, icon in a box, colored border/glow/scale accent on hover, „Rytuał X" title
 * + uppercase subtitle. Color comes from the central `ritualButtonTheme`. The state
 * (run/stop/loader) is set by the caller, passing the right color/icon/title.
 */
export const RitualButton: React.FC<RitualButtonProps> = ({
  color, icon: Icon, title, subtitle, onClick, animate, disabled, className,
}) => {
  const t = getRitualButtonTheme(color);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-left transition-all duration-200 group hover:bg-slate-900/50 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg ${t.hoverBorder} ${t.hoverShadow} disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed ${className ?? ""}`}
    >
      <div className={`p-3 rounded-xl ${t.iconBg} ${t.iconText} group-hover:scale-110 transition-transform shrink-0`}>
        <Icon className={`w-5 h-5 ${animate === "spin" ? "animate-spin" : animate === "pulse" ? "animate-pulse" : ""}`} />
      </div>
      <div className="min-w-0">
        <div className={`font-bold text-slate-200 ${t.hoverText} transition-colors`}>{title}</div>
        <div className="text-xs text-slate-500 uppercase font-bold tracking-tighter">{subtitle}</div>
      </div>
    </button>
  );
};
