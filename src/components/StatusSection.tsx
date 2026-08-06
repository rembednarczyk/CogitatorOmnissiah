import React from "react";
import { Zap, Loader2, ExternalLink, History, Stethoscope, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useWikiUpdates, WikiLink } from "../hooks/useWikiUpdates";
import { useDiagnostics } from "../hooks/useDiagnostics";

interface StatusSectionProps {
  configStatus: {
    loading: boolean;
    hasNotionKey: boolean;
    hasDatabaseId: boolean;
    isSyncing?: boolean;
  };
}

const WIKI_LINKS: WikiLink[] = [
  { name: "Hugo", url: "https://encyklopediafantastyki.pl/index.php?title=Hugo_nagroda_powie%C5%9B%C4%87", title: "Hugo nagroda powieść" },
  { name: "Locus", url: "https://encyklopediafantastyki.pl/index.php?title=Locus_nagroda_powie%C5%9B%C4%87", title: "Locus nagroda powieść" },
  { name: "Nebula", url: "https://encyklopediafantastyki.pl/index.php?title=Nebula_nagroda_najlepsza_powie%C5%9B%C4%87", title: "Nebula nagroda najlepsza powieść" }
];

export const StatusSection: React.FC<StatusSectionProps> = ({ configStatus }) => {
  const wikiUpdates = useWikiUpdates(WIKI_LINKS, !configStatus.loading);
  const { report, loading: diagLoading, error: diagError, runDiagnostics } = useDiagnostics();

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-8 rounded-3xl relative overflow-hidden group"
    >
      <h2 className="text-xl font-bold font-display flex items-center gap-3 mb-8 uppercase tracking-widest text-cyan-400">
        <Zap className="w-5 h-5" />
        Status Ducha Maszyny
      </h2>
      
      {configStatus.loading ? (
        <div className="flex items-center gap-4 text-slate-400 animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-medium">Inicjalizacja Duchów Maszyny...</span>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "NOTION_API_KEY", status: configStatus.hasNotionKey, ok: "Pieczęć Przyłożona", err: "Brak Autoryzacji" },
              { label: "NOTION_DATABASE_ID", status: configStatus.hasDatabaseId, ok: "Baza Zlokalizowana", err: "Baza Nieznana" },
              { label: "STATUS PROCESÓW", status: !configStatus.isSyncing, ok: "Gotowość do Pracy", err: "Synchronizacja w Toku" }
            ].map((item, idx) => (
              <motion.div 
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/50"
              >
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] ${item.status ? 'bg-cyan-500 shadow-cyan-500/50' : 'bg-red-600 shadow-red-600/50'}`} />
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-tighter mb-1">{item.label}</div>
                  <div className={`text-sm font-bold ${item.status ? 'text-slate-200' : 'text-red-400'}`}>
                    {item.status ? item.ok : item.err}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800/50">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 ml-1">Sektory Archiwum Encyklopedii</div>
            <div className="flex flex-wrap gap-4">
              {WIKI_LINKS.map((link, idx) => (
                <motion.div
                  key={link.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className="flex flex-col gap-1"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/5 text-slate-400 hover:text-cyan-400 transition-all text-xs font-bold uppercase tracking-widest group"
                  >
                    <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    {link.name}
                  </a>
                  {wikiUpdates[link.name] && (
                    <div className="flex items-center gap-1.5 px-2 text-[9px] text-slate-500 font-mono uppercase tracking-tight">
                      <History className="w-2.5 h-2.5 text-purple-500/70" />
                      <span>Ostatnia Edycja: {wikiUpdates[link.name]}</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/50">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">
                Diagnostyka Połączeń (Notion + Encyklopedia)
              </div>
              <button
                onClick={() => runDiagnostics()}
                disabled={diagLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/50 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-400 transition-all text-xs font-bold uppercase tracking-widest disabled:opacity-50"
              >
                {diagLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
                {diagLoading ? "Diagnozuję..." : "Uruchom Diagnostykę"}
              </button>
            </div>

            <AnimatePresence>
              {diagError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium"
                >
                  {diagError}
                </motion.div>
              )}
              {report && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-medium leading-relaxed">
                    {report.summary}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    {report.notion.ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className="text-slate-400">Notion: {report.notion.ok ? `OK (${report.notion.propertyCount} kolumn)` : (report.notion.error || "błąd")}</span>
                  </div>
                  {report.wiki.map((w) => (
                    <div key={w.award} className="flex items-start gap-2 text-[11px] font-mono">
                      {w.ok && (w.booksParsed ?? 0) > 0
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                      <span className="text-slate-400">
                        {w.award}: {w.ok ? `${w.booksParsed} książek` : `${w.classification || "błąd"}${w.status ? ` (HTTP ${w.status})` : ""}`}
                        {w.hint && !w.ok && <span className="block text-slate-500 mt-0.5">{w.hint}</span>}
                        {w.note && <span className="block text-amber-500/80 mt-0.5">{w.note}</span>}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.section>
  );
};
