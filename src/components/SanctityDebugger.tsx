import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bug, ChevronRight, AlertCircle, Database, Globe } from "lucide-react";
import { IntegrityCheckResult } from "../types";

interface SanctityDebuggerProps {
  result: IntegrityCheckResult | null;
}

export const SanctityDebugger: React.FC<SanctityDebuggerProps> = ({ result }) => {
  const [selectedDiff, setSelectedDiff] = React.useState<string | null>(null);

  if (!result) return null;

  const hasHeresy = !result.lpUniqueness.status || 
                    !result.yearCountMatch.status || 
                    !result.originalTitleUniqueness.status || 
                    !result.polishTitleUniqueness.status || 
                    !result.awardCountMatch.status;

  if (!hasHeresy) return null;

  const diffItems = [
    {
      id: "years",
      label: "Rozbieżności Roczników",
      status: result.yearCountMatch.status,
      data: result.yearCountMatch.diffs.map(d => ({
        title: `Rok ${d.year}`,
        notion: d.notion,
        wiki: d.wiki,
        notionOnly: d.notionOnly,
        wikiOnly: d.wikiOnly,
        misplaced: d.misplaced,
        collisions: d.collisions
      }))
    },
    {
      id: "awards",
      label: "Rozbieżności Nagród",
      status: result.awardCountMatch.status,
      data: result.awardCountMatch.diffs.map(d => ({
        title: d.award,
        notion: d.notion,
        wiki: d.wiki,
        notionOnly: d.notionOnly,
        wikiOnly: d.wikiOnly
      }))
    }
  ].filter(item => !item.status);

  return (
    <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-6 backdrop-blur-md shadow-2xl shadow-amber-900/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <Bug className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-amber-400">Protokół Debugowania Sanctity</h3>
          <p className="text-[10px] text-slate-500 font-mono mt-1">ANALIZA ROZBIEŻNOŚCI STRUKTURALNYCH [NOTION vs WIKI]</p>
        </div>
      </div>

      <div className="space-y-4">
        {diffItems.map((item) => (
          <div key={item.id} className="space-y-2">
            <button
              onClick={() => setSelectedDiff(selectedDiff === item.id ? null : item.id)}
              className="w-full flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-amber-500/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{item.label}</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${selectedDiff === item.id ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {selectedDiff === item.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 p-1">
                    {item.data.map((diff, idx) => (
                      <div key={idx} className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                        <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">{diff.title}</span>
                          <div className="flex gap-4 text-[9px] font-mono">
                            <span className="text-cyan-400">NOTION: {diff.notion}</span>
                            <span className="text-purple-400">WIKI: {diff.wiki}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                          {/* Notion Side */}
                          <div className="p-3 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Database className="w-3 h-3 text-cyan-500" />
                              <span className="text-[9px] font-bold text-cyan-500/70 uppercase tracking-tighter">Tylko w Notion</span>
                            </div>
                            {diff.notionOnly && diff.notionOnly.length > 0 ? (
                              <div className="space-y-1">
                                {diff.notionOnly.map((book, i) => (
                                  <div key={i} className="text-[9px] text-slate-400 font-mono bg-cyan-500/5 p-1.5 rounded border border-cyan-500/10">
                                    + {book}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[9px] text-slate-600 italic p-2">Brak unikalnych rekordów</div>
                            )}
                          </div>

                          {/* Wiki Side */}
                          <div className="p-3 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Globe className="w-3 h-3 text-purple-500" />
                              <span className="text-[9px] font-bold text-purple-500/70 uppercase tracking-tighter">Tylko na Wiki</span>
                            </div>
                            {diff.wikiOnly && diff.wikiOnly.length > 0 ? (
                              <div className="space-y-1">
                                {diff.wikiOnly.map((book, i) => (
                                  <div key={i} className="text-[9px] text-slate-400 font-mono bg-purple-500/5 p-1.5 rounded border border-purple-500/10">
                                    - {book}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[9px] text-slate-600 italic p-2">Brak unikalnych rekordów</div>
                            )}
                          </div>
                        </div>

                        {/* Misplaced Section */}
                        {diff.misplaced && diff.misplaced.length > 0 && (
                          <div className="p-3 bg-amber-500/5 border-t border-slate-800">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="w-3 h-3 text-amber-500" />
                              <span className="text-[9px] font-bold text-amber-500/70 uppercase tracking-tighter">Błędny Rok (Wykryto w innym roczniku)</span>
                            </div>
                            <div className="space-y-1">
                              {diff.misplaced.map((item, i) => (
                                <div key={i} className="flex justify-between items-center text-[9px] text-slate-400 font-mono bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                                  <span>? {item.title}</span>
                                  <span className="text-amber-500/80">{item.otherYear}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Collisions Section */}
                        {diff.collisions && diff.collisions.length > 0 && (
                          <div className="p-3 bg-red-500/5 border-t border-slate-800">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="w-3 h-3 text-red-500" />
                              <span className="text-[9px] font-bold text-red-500/70 uppercase tracking-tighter">Kolizje (Wiele rekordów Wiki vs Jeden Notion)</span>
                            </div>
                            <div className="space-y-2">
                              {diff.collisions.map((item, i) => (
                                <div key={i} className="text-[9px] text-slate-400 font-mono bg-red-500/10 p-2 rounded border border-red-500/20">
                                  <div className="font-bold text-red-400 mb-1">{item.title}</div>
                                  <div className="pl-2 border-l border-red-500/30 space-y-1">
                                    {item.matches.map((m, j) => (
                                      <div key={j} className="text-slate-500">{m}</div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};
