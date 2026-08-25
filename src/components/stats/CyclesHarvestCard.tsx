import React, { useState } from "react";
import { motion } from "motion/react";
import { Layers, ChevronDown, Check, CheckCheck, Package, AlertTriangle, Award, ExternalLink, Loader2 } from "lucide-react";
import { useCyclesHarvest, HarvestVolume } from "../../hooks/useCyclesHarvest";

/** Link do tomu w Archiwum Encyklopedii Fantastyki (ten sam wzorzec co parser/panel). */
const encyclopediaUrl = (title: string) =>
  `https://encyklopediafantastyki.pl/index.php?title=${encodeURIComponent(title.replace(/ /g, "_"))}`;

const volStatus = (v: HarvestVolume) => {
  if (v.read) return { icon: Check, cls: "text-cyan-400", label: "przeczytana" };
  if (v.owned) return { icon: Package, cls: "text-emerald-400", label: "posiadana" };
  // Tomy są teraz wierszami bazy — brak posiadania/przeczytania = „do zdobycia".
  return { icon: AlertTriangle, cls: "text-amber-400", label: "do zdobycia" };
};

/**
 * Archiwum Cykli — zbiorczy widok tomów cykli (wiersze bazy z pola `Cykl`). Pokazuje
 * ile tomów masz / do zdobycia i pozwala oznaczać tomy przeczytane/posiadane w miejscu.
 */
export const CyclesHarvestCard: React.FC = () => {
  const { view, loading, error, busyId, toggleSource } = useCyclesHarvest();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 rounded-3xl border-amber-500/10 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold font-display uppercase tracking-widest text-amber-400 flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Archiwum Cykli
        </h3>
        {view && view.totalCycles > 0 && (
          <span className="text-[10px] font-bold tabular-nums text-slate-500 uppercase tracking-wider">{view.totalCycles} cykli</span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-10 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span className="text-xs uppercase tracking-widest font-bold">Odczyt zebranych cykli...</span>
        </div>
      )}

      {error && !loading && <p className="text-sm text-slate-400 italic text-center py-8">{error}</p>}

      {view && !loading && view.totalCycles === 0 && (
        <p className="text-slate-400 text-sm italic text-center py-8">
          Brak zebranych cykli. Uruchom <span className="text-amber-300 not-italic font-bold">Rytuał Żniw Cykli</span> w Liturgiach, aby zebrać sąsiednie tomy z Encyklopedii.
        </p>
      )}

      {view && !loading && view.totalCycles > 0 && (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
          {view.cycles.map((c) => {
            const isOpen = open === c.cycle;
            // Cykl przeczytany w całości → wygaszony (nic nie zostało do nadrobienia).
            const done = c.total > 0 && c.read === c.total;
            return (
              <div key={c.cycle} className={`rounded-2xl border border-white/5 bg-slate-950/40 overflow-hidden transition-opacity ${done && !isOpen ? "opacity-45" : ""}`}>
                <button
                  onClick={() => setOpen(isOpen ? null : c.cycle)}
                  className="w-full flex items-center gap-2.5 p-3 text-left hover:bg-white/5 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <span className={`flex-1 min-w-0 text-sm font-bold truncate ${done ? "text-slate-400" : "text-slate-200"}`}>{c.cycle}</span>
                  {done ? (
                    <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 text-cyan-300/90 text-[9px] font-bold uppercase tracking-wider">
                      <CheckCheck className="w-2.5 h-2.5" /> ukończony
                    </span>
                  ) : c.missing > 0 && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                      {c.missing} do zdobycia
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] tabular-nums text-slate-500 font-bold">{c.inBase}/{c.total}</span>
                </button>

                {isOpen && (
                  <ol className="px-3 pb-3 space-y-1">
                    {c.volumes.map((v, i) => {
                      const s = volStatus(v);
                      const Icon = s.icon;
                      return (
                        <li key={v.id || i} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/40">
                          <span className="text-[10px] font-bold tabular-nums text-slate-500 w-4 text-right shrink-0">{i + 1}.</span>
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${s.cls}`} />
                          <span className={`flex-1 min-w-0 text-sm truncate ${v.read || v.owned ? "text-slate-200" : "text-slate-400"}`}>{v.title}</span>
                          {v.awarded && <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="nagrodzona" />}

                          {busyId === v.id ? (
                            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-slate-400" />
                          ) : (
                            <>
                              <button
                                onClick={() => toggleSource(v.id, "Posiadam", !v.owned)}
                                disabled={!!busyId}
                                className={`shrink-0 p-1 rounded-md transition-colors disabled:opacity-40 ${v.owned ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/10"}`}
                                title={v.owned ? "Oznacz jako nieposiadaną" : "Oznacz jako posiadaną"}
                                aria-label={`Przełącz posiadanie: ${v.title}`}
                              >
                                <Package className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => toggleSource(v.id, "Przeczytane", !v.read)}
                                disabled={!!busyId}
                                className={`shrink-0 p-1 rounded-md transition-colors disabled:opacity-40 ${v.read ? "text-cyan-400 bg-cyan-500/10" : "text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10"}`}
                                title={v.read ? "Oznacz jako nieprzeczytaną" : "Oznacz jako przeczytaną"}
                                aria-label={`Przełącz przeczytanie: ${v.title}`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          <a
                            href={encyclopediaUrl(v.title)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-1 rounded-md text-slate-500 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                            title="Otwórz w Encyklopedii (nowa karta)"
                            aria-label={`Otwórz ${v.title} w Encyklopedii`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
