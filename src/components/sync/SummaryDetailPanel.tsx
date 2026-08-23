import React from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  title: string;
  count: number;
  icon: React.ReactNode;
  /** Kolor nagłówka, np. "text-emerald-400". */
  accentClass: string;
  /** Klasy obramowania + tła wiersza, np. "border-emerald-500/30 bg-emerald-500/5". */
  rowClass: string;
  /** Kolor tekstu wiersza (domyślnie slate-300). */
  rowTextClass?: string;
  items: string[];
  /** Opcjonalny przycisk kopiowania listy (używane przez panel duplikatów). */
  onCopy?: () => void;
  copied?: boolean;
  copyTitle?: string;
}

/** Panel listy podsumowania (Nowe / Zaktualizowane / Pominięte / Duplikaty) — jeden wzorzec. */
export const SummaryDetailPanel: React.FC<Props> = ({ title, count, icon, accentClass, rowClass, rowTextClass = "text-slate-300", items, onCopy, copied, copyTitle }) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
    <div className="flex items-center justify-between mb-4">
      <h4 className={`text-sm font-bold ${accentClass} uppercase tracking-widest flex items-center gap-2`}>
        {icon} {title} ({count})
      </h4>
      {onCopy && (
        <button
          onClick={onCopy}
          className="p-2 hover:bg-amber-500/10 rounded-lg text-amber-400/60 hover:text-amber-400 transition-all"
          title={copyTitle}
          aria-label={copyTitle}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
    </div>
    <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-2">
      {items.map((item, i) => (
        <div key={i} className={`text-xs ${rowTextClass} font-medium border-l-2 ${rowClass} pl-3 py-1 rounded-r-lg`}>
          {item}
        </div>
      ))}
    </div>
  </div>
);
