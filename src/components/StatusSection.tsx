import React from "react";
import { Zap, Loader2, ExternalLink, History } from "lucide-react";
import { motion } from "motion/react";
import { useWikiUpdates, WikiLink } from "../hooks/useWikiUpdates";

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
        </div>
      )}
    </motion.section>
  );
};
