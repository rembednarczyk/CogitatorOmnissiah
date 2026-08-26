import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "motion/react";
import { Layers, ChevronDown, Check, CheckCheck, Package, PackageOpen, Book, CircleDashed, AlertTriangle, Award, ExternalLink, Loader2, ShoppingCart } from "lucide-react";
import { useCyclesHarvest, HarvestVolume } from "../../hooks/useCyclesHarvest";
import { encyclopediaUrl } from "../../utils/encyclopedia";
import { sortCycles, CycleSortMode } from "../../utils/cycleSort";

const SORTS: { mode: CycleSortMode; label: string }[] = [
  { mode: "easywins", label: "Blisko końca" },
  { mode: "acquire", label: "Najwięcej braków" },
];

const volStatus = (v: HarvestVolume) => {
  if (v.read) return { icon: Check, cls: "text-cyan-400", label: "przeczytana" };
  if (v.owned) return { icon: Package, cls: "text-emerald-400", label: "posiadana" };
  // Tomy są teraz wierszami bazy — brak posiadania/przeczytania = „do zdobycia".
  // Łagodny znacznik (dashed circle) zamiast trójkąta ostrzegawczego — poboczne
  // tomy to zaproszenie do skompletowania, nie błąd.
  return { icon: CircleDashed, cls: "text-amber-400/70", label: "do zdobycia" };
};

/**
 * Archiwum Cykli — zbiorczy widok tomów cykli (wiersze bazy z pola `Cykl`). Pokazuje
 * ile tomów masz / do zdobycia i pozwala oznaczać tomy przeczytane/posiadane w miejscu.
 */
export const CyclesHarvestCard: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { view, loading, error, busyId, fetchHarvest, toggleSource } = useCyclesHarvest();
  const [open, setOpen] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<CycleSortMode>("easywins");
  const sortedCycles = useMemo(() => (view ? sortCycles(view.cycles, sortMode) : []), [view, sortMode]);

  // „Odśwież Dane" (StatsSection) inkrementuje refreshSignal → dociągnij świeże cykle
  // (silent = bez migania kartą, fresh = pomiń cache). Pomiń pierwszy przebieg (mount
  // już pobiera w hooku), by nie dublować żądania.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    fetchHarvest(true, true);
  }, [refreshSignal, fetchHarvest]);

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

      {/* Błąd wczytywania (brak danych) → duży komunikat; błąd oznaczania (dane są) → zwięzły baner nad listą. */}
      {error && !loading && !view && <p className="text-sm text-slate-400 italic text-center py-8">{error}</p>}
      {error && !loading && view && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {view && !loading && view.totalCycles === 0 && (
        <p className="text-slate-400 text-sm italic text-center py-8">
          Brak zebranych cykli. Uruchom <span className="text-amber-300 not-italic font-bold">Rytuał Żniw Cykli</span> w Liturgiach, aby zebrać sąsiednie tomy z Encyklopedii.
        </p>
      )}

      {view && !loading && view.totalCycles > 1 && (
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-900/60 border border-amber-500/15 w-fit">
          {SORTS.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${sortMode === mode ? "bg-amber-500/20 text-amber-200 border border-amber-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}
              title={mode === "easywins" ? "Najmniej tomów do przeczytania na górze (szybkie zwycięstwa)" : "Najwięcej tomów do zdobycia na górze"}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view && !loading && view.totalCycles > 0 && (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
          {sortedCycles.map((c) => {
            const isOpen = open === c.cycle;
            // Cykl przeczytany w całości → wygaszony (nic nie zostało do nadrobienia).
            const done = c.total > 0 && c.read === c.total;
            // Dwie NIEZALEŻNE luki (dotąd zlane w jeden licznik „missing"):
            // do zdobycia = nieposiadane; do przeczytania = nieprzeczytane.
            const toAcquire = c.total - c.owned;
            const toRead = c.total - c.read;
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
                  ) : (
                    <>
                      {toAcquire > 0 && (
                        <span
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-[9px] font-bold tabular-nums uppercase tracking-wider"
                          title={`${toAcquire} do zdobycia (nieposiadane)`}
                        >
                          <PackageOpen className="w-2.5 h-2.5" /> {toAcquire}
                        </span>
                      )}
                      {toRead > 0 && (
                        <span
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 text-[9px] font-bold tabular-nums uppercase tracking-wider"
                          title={`${toRead} do przeczytania`}
                        >
                          <Book className="w-2.5 h-2.5" /> {toRead}
                        </span>
                      )}
                    </>
                  )}
                  {c.acquireCost != null && (
                    <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border border-rose-500/25 bg-rose-500/10 text-rose-300 text-[9px] font-bold uppercase tracking-wider" title={`Skompletuj ${c.acquirable} tomów z Vinted`}>
                      <ShoppingCart className="w-2.5 h-2.5" /> ~{c.acquireCost} zł
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

                          {v.vinted && !v.owned && (
                            <a
                              href={v.vinted.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[10px] font-bold tabular-nums hover:bg-rose-500/20 transition-colors"
                              title={`${v.vinted.count} ${v.vinted.count === 1 ? "oferta" : "ofert"} na Vinted — najtańsza`}
                            >
                              <ShoppingCart className="w-3 h-3" /> {v.vinted.price} zł
                            </a>
                          )}

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
