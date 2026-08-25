import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Layers, X, Loader2, Check, Package, Award, CircleDashed, MapPin, AlertTriangle } from "lucide-react";
import { useCycle } from "../../hooks/useCycle";

/**
 * Modal podglądu cyklu (Skryptorium). Pobiera na żądanie uporządkowaną listę tomów
 * i pokazuje status każdego względem bazy (masz / przeczytana / nagrodzona / brak) +
 * wyróżnia bieżącą pozycję i licznik „ile tomów do nadrobienia przed fabułą".
 */

const STATUS = (v: { read: boolean; owned: boolean; inBase: boolean }) => {
  if (v.read) return { icon: Check, cls: "text-cyan-400", label: "przeczytana" };
  if (v.owned) return { icon: Package, cls: "text-emerald-400", label: "posiadana" };
  if (v.inBase) return { icon: CircleDashed, cls: "text-slate-400", label: "w bazie" };
  return { icon: AlertTriangle, cls: "text-amber-400", label: "brak w bazie" };
};

interface Props {
  title: string;
  author: string;
  onClose: () => void;
}

export const CyclePanel: React.FC<Props> = ({ title, author, onClose }) => {
  const { view, loading, error, fetchCycle } = useCycle();

  useEffect(() => { fetchCycle(title, author); }, [title, author, fetchCycle]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          className="glass-card rounded-3xl border-amber-500/20 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Nagłówek */}
          <div className="flex items-start gap-3 p-5 border-b border-white/5">
            <div className="shrink-0 p-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold font-display uppercase tracking-widest text-amber-300 truncate">
                {view?.cycleName || "Cykl"}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">{title}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors" aria-label="Zamknij">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Treść */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
            {loading && (
              <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span className="text-sm uppercase tracking-widest font-bold">Odpytywanie Archiwum Cyklu...</span>
              </div>
            )}

            {error && !loading && (
              <p className="text-sm text-slate-400 italic text-center py-10">{error}</p>
            )}

            {view && !loading && (
              <>
                {view.unreadBefore > 0 && (
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Przed tą pozycją masz <b>{view.unreadBefore}</b> {view.unreadBefore === 1 ? "nieprzeczytany tom" : "nieprzeczytane tomy"} — warto nadrobić dla fabuły.</span>
                  </div>
                )}

                <ol className="space-y-1.5">
                  {view.volumes.map((v, i) => {
                    const s = STATUS(v);
                    const Icon = s.icon;
                    return (
                      <li
                        key={i}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${
                          v.isCurrent ? "bg-cyan-500/10 border-cyan-500/30" : "bg-slate-950/40 border-white/5"
                        }`}
                      >
                        <span className="text-[10px] font-bold tabular-nums text-slate-500 w-5 text-right shrink-0">{i + 1}.</span>
                        <Icon className={`w-4 h-4 shrink-0 ${s.cls}`} />
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm truncate block ${v.isCurrent ? "text-cyan-200 font-bold" : v.inBase ? "text-slate-200" : "text-slate-400"}`}>
                            {v.title}
                            {v.isCurrent && <MapPin className="inline w-3 h-3 ml-1 text-cyan-400" />}
                          </span>
                        </div>
                        {v.awarded && <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="nagrodzona" />}
                        <span className={`text-[10px] uppercase tracking-wider font-bold shrink-0 ${s.cls}`}>{s.label}</span>
                      </li>
                    );
                  })}
                </ol>

                <p className="text-[10px] text-slate-600 text-center pt-1">
                  Dane pobrane z Encyklopedii na żądanie — nie zapisujemy ich w bazie.
                </p>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
