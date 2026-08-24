import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, CheckCircle, AlertTriangle, Loader2, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { useSync } from "../hooks/useSync";
import { IntegrityCheckResult } from "../types";

interface IntegrityCheckCardProps {
  integritySync: ReturnType<typeof useSync>;
  isAnySyncLoading: boolean;
}

export const IntegrityCheckCard: React.FC<IntegrityCheckCardProps> = ({
  integritySync,
  isAnySyncLoading
}) => {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const state = integritySync.state;
  const result = state.result as IntegrityCheckResult | null;

  const toggleExpand = (key: string) => {
    setExpanded(expanded === key ? null : key);
  };

  const renderStatus = (status: boolean) => {
    return status ? (
      <div className="flex items-center gap-2 text-emerald-400 font-bold text-[9px] uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
        <CheckCircle className="w-2.5 h-2.5" />
        [ ZATWIERDZONO ]
      </div>
    ) : (
      <div className="flex items-center gap-2 text-red-400 font-bold text-[9px] uppercase tracking-widest bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 animate-pulse">
        <AlertTriangle className="w-2.5 h-2.5" />
        [ HEREZJA ]
      </div>
    );
  };

  const renderDetailList = (items: string[]) => (
    <div className="mt-2 p-2 bg-slate-950/90 rounded-xl border border-slate-800 font-mono text-[9px] text-slate-400 max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
      {items.length > 0 ? (
        items.map((item, i) => <div key={i} className="border-l border-slate-700 pl-2 py-0.5">{item}</div>)
      ) : (
        <div className="text-slate-600 italic">Brak szczegółów.</div>
      )}
    </div>
  );

  const checks = [
    { id: "lp", label: "Unikalność Lp", status: result?.lpUniqueness.status ?? true, details: result?.lpUniqueness.duplicates || [] },
    { id: "origTitle", label: "Tytuły Oryginalne", status: result?.originalTitleUniqueness.status ?? true, details: result?.originalTitleUniqueness.duplicates || [] },
    { id: "plTitle", label: "Tytuły Polskie", status: result?.polishTitleUniqueness.status ?? true, details: result?.polishTitleUniqueness.duplicates || [] },
    { 
      id: "years", 
      label: "Roczniki (Notion/Wiki)", 
      status: result?.yearCountMatch.status ?? true, 
      details: result?.yearCountMatch.diffs.flatMap(d => {
        const lines = [`Rok ${d.year}: Notion(${d.notion}) vs Wiki(${d.wiki})`];
        if (d.notionOnly && d.notionOnly.length > 0) {
          lines.push(`  [TYLKO NOTION]:`);
          d.notionOnly.forEach(b => lines.push(`    • ${b}`));
        }
        if (d.wikiOnly && d.wikiOnly.length > 0) {
          lines.push(`  [TYLKO WIKI]:`);
          d.wikiOnly.forEach(b => lines.push(`    • ${b}`));
        }
        return lines;
      }) || [] 
    },
    { id: "awards", label: "Nagrody (Notion/Wiki)", status: result?.awardCountMatch.status ?? true, details: result?.awardCountMatch.diffs.map(d => `${d.award}: Notion(${d.notion}) vs Wiki(${d.wiki})`) || [] }
  ];

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 mt-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`w-4 h-4 text-cyan-400 ${state.loading ? 'animate-pulse' : ''}`} />
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Skaner Sanctity</h3>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => integritySync.startSync({}, undefined, "Inicjowanie Skanera Sanctity...")}
          disabled={isAnySyncLoading}
          className={`p-2 rounded-full border transition-all ${
            state.loading 
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] animate-pulse' 
              : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/30'
          }`}
          title="Inicjuj Skanowanie Sanctity"
        >
          {state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
        </motion.button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {checks.map((check) => (
          <div key={check.id} className="relative">
            <button
              type="button"
              onClick={() => toggleExpand(check.id)}
              aria-expanded={expanded === check.id}
              className={`w-full flex flex-col p-2 rounded-xl border transition-all cursor-pointer text-left ${
                result ? (check.status ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/20 animate-pulse') : 'bg-slate-950/30 border-slate-800/50'
              } hover:border-slate-600`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{check.label}</span>
                {check.details.length > 0 && (
                  <div className="text-slate-600">
                    {expanded === check.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </div>
                )}
              </div>
              {result && (
                <div className="mt-1">
                  {renderStatus(check.status)}
                </div>
              )}
            </button>

            <AnimatePresence>
              {expanded === check.id && check.details.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden absolute z-20 left-0 right-0 top-full mt-1"
                >
                  {renderDetailList(check.details)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {state.error && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[9px] font-medium flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="truncate">{state.error}</span>
        </div>
      )}
    </div>
  );
};
