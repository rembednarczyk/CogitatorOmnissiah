import React from "react";

export interface TabDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Active-state classes (color/border/glow) for the given tab. */
  activeClass: string;
}

/** Tab bar — one button pattern instead of 5× copy-paste. */
export const TabNav: React.FC<{ tabs: TabDef[]; active: string; onSelect: (id: string) => void }> = ({ tabs, active, onSelect }) => (
  <div className="flex flex-col sm:flex-row sm:items-stretch justify-center gap-4 mt-8">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onSelect(tab.id)}
        className={`w-full sm:flex-1 px-4 py-4 rounded-2xl border font-bold uppercase tracking-wide text-sm transition-all flex items-center justify-center gap-3 ${
          active === tab.id ? tab.activeClass : "bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
        }`}
      >
        {tab.icon}
        {tab.label}
      </button>
    ))}
  </div>
);
