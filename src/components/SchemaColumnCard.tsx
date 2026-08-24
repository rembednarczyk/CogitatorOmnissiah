import React from "react";
import { motion } from "motion/react";
import { Plus, Loader2, X, AlertCircle } from "lucide-react";

interface Props {
  name: string;
  value: any;
  isSelectType: boolean;
  options: any[];        // posortowane opcje (dla select/multi_select)
  isOverLimit: boolean;
  limit: number;
  index: number;         // do animacji wejścia (delay)
  updating: boolean;     // czy trwa mutacja tej kolumny
  newOptionValue: string;
  onNewOptionChange: (v: string) => void;
  onAdd: () => void;
  onDeleteRequest: (optionName: string) => void;
}

/** Karta jednej kolumny schematu: nazwa, licznik limitu, opcje + dodawanie/usuwanie. */
export const SchemaColumnCard: React.FC<Props> = ({ name, value, isSelectType, options, isOverLimit, limit, index, updating, newOptionValue, onNewOptionChange, onAdd, onDeleteRequest }) => {
  // „Autor" jest tylko do odczytu — nie pokazujemy licznika, przycisków usuwania ani warnu.
  const isEditable = name !== "Autor";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-slate-900/20 border border-white/5 rounded-3xl p-6 backdrop-blur-md hover:border-cyan-500/20 transition-all duration-500 group relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex flex-col gap-1">
          <span className="font-display font-bold text-xl text-slate-200 tracking-tight group-hover:text-cyan-400 transition-colors duration-300">{name}</span>
          {isSelectType && isEditable && (
            <div className="flex items-center gap-2">
              <div className="h-1 w-24 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${isOverLimit ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: `${Math.min(100, (options.length / limit) * 100)}%` }} />
              </div>
              <span className={`text-[9px] font-display font-bold uppercase tracking-widest ${isOverLimit ? 'text-red-400' : 'text-slate-500'}`}>
                {options.length} / {limit}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full text-[9px] font-display border border-cyan-500/20 uppercase tracking-[0.15em] font-black shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            {value.type}
          </span>
        </div>
      </div>

      {isSelectType && (
        <div className="mt-6 pt-6 border-t border-white/5 relative z-10">
          {isOverLimit && isEditable && (
            <div className="mb-6 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-red-300/80 font-display font-medium leading-relaxed">
                <span className="font-bold block mb-1 uppercase tracking-wider text-red-400">Krytyczny Limit API</span>
                Wykryto {options.length} wpisów. Notion blokuje edycję powyżej {limit}.
                Zalecana konwersja na <span className="text-cyan-400 font-bold">Plain Text</span> w panelu sterowania Notion.
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Zasoby Opcji</p>
            {options.length === 0 && <span className="text-[10px] text-slate-600 italic font-display">Baza pusta</span>}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {options.map((opt: any) => (
              <motion.span
                layout
                key={opt.id || opt.name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950/40 border border-white/5 text-slate-400 rounded-2xl text-xs font-display font-medium group/opt hover:border-cyan-500/40 hover:text-cyan-300 transition-all duration-300 shadow-sm"
              >
                {opt.name}
                {isEditable && (
                  <button
                    onClick={() => onDeleteRequest(opt.name)}
                    disabled={updating}
                    className="text-slate-600 hover:text-red-500 disabled:opacity-50 transition-colors p-0.5 rounded-md hover:bg-red-500/10"
                    title="Usuń opcję"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 group/input">
              <input
                type="text"
                placeholder="Wprowadź nową desygnację..."
                className="w-full pl-4 pr-4 py-3 text-xs bg-slate-950/60 border border-white/5 text-slate-300 rounded-2xl focus:outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 placeholder-slate-700 transition-all duration-300 font-display font-medium"
                value={newOptionValue}
                onChange={(e) => onNewOptionChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
              />
            </div>
            <button
              onClick={onAdd}
              disabled={!newOptionValue.trim() || updating || isOverLimit}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-2xl text-xs font-display font-bold hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 active:scale-95 shadow-lg shadow-cyan-500/20 uppercase tracking-widest"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Inicjuj
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
