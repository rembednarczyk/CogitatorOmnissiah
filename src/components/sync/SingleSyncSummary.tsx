import React from "react";
import { motion } from "motion/react";
import { XCircle, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import { useSync } from "../../hooks/useSync";
import { getRitualTheme } from "../../theme/ritualColors";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { StatCard } from "./StatCard";
import { SummaryDetailPanel } from "./SummaryDetailPanel";

/** Summary of a single ritual (added / updated / skipped / duplicates). */
export const SingleSyncSummary: React.FC<{ sync: ReturnType<typeof useSync>; onClose: () => void }> = ({ sync, onClose }) => {
  const { copied, copy } = useCopyToClipboard();

  const activeResult = sync.state.result;
  const color = sync.state.color || "cyan";
  const summary = activeResult?.summary;

  // Ritual theme (see src/theme/ritualColors.ts). Here bg = soft card background.
  const t = getRitualTheme(color);
  const theme = { text: t.text, border: t.border, bg: t.bgSoft };

  const hasDetails = summary && (summary.added?.length > 0 || summary.updated?.length > 0 || summary.duplicates?.length > 0 || summary.skipped?.length > 0);
  // Errors are a distinct channel from „skipped" (no match): an API outage / rate-limit
  // must be visible, or a ritual that errored on every book looks like it just found nothing.
  const errors: string[] = Array.isArray(activeResult?.errors) ? activeResult.errors : [];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`glass-card p-8 rounded-3xl ${theme.border}`}>
      <div className="flex items-center justify-between mb-8">
        <h3 className={`text-xl font-bold font-display ${theme.text} uppercase tracking-widest`}>Zapisane zmiany</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-6">
        {summary ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard label="Dodano" count={summary.added?.length || 0} color="text-emerald-400" bg="bg-emerald-500/10" countClass="text-3xl" labelClass="text-xs" />
            <StatCard label="Zaktualizowano" count={activeResult.updated || summary.updated?.length || 0} color={theme.text} bg={theme.bg} countClass="text-3xl" labelClass="text-xs" />
            <StatCard label="Pominięto" count={summary.skipped?.length || 0} color="text-slate-400" bg="bg-slate-500/10" countClass="text-3xl" labelClass="text-xs" />
            <StatCard label="Duplikaty" count={summary.duplicates?.length || 0} color="text-amber-400" bg="bg-amber-500/10" countClass="text-3xl" labelClass="text-xs" />
          </div>
        ) : (
          <div className={`p-6 ${theme.bg} border ${theme.border} rounded-2xl text-center mb-8`}>
            <div className={`${theme.text} font-bold uppercase tracking-widest mb-2`}>Synchronizacja zakończona</div>
            <div className="text-slate-400 text-sm">
              Przetworzono {activeResult.found || 0} woluminów. Zaktualizowano {activeResult.updated || 0} wpisów.
            </div>
          </div>
        )}

        {hasDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.added?.length > 0 && (
              <SummaryDetailPanel title="Nowe Zapisy" count={summary.added.length} icon={<CheckCircle2 className="w-4 h-4" />} accentClass="text-emerald-400" rowClass="border-emerald-500/30 bg-emerald-500/5" items={summary.added} />
            )}
            {summary.updated?.length > 0 && (
              <SummaryDetailPanel title="Zaktualizowane" count={summary.updated.length} icon={<RefreshCw className="w-4 h-4" />} accentClass="text-cyan-400" rowClass="border-cyan-500/30 bg-cyan-500/5" items={summary.updated} />
            )}
            {summary.skipped?.length > 0 && (
              <SummaryDetailPanel title="Pominięte — nie oceniono" count={summary.skipped.length} icon={<AlertCircle className="w-4 h-4" />} accentClass="text-slate-400" rowClass="border-slate-600/40 bg-slate-500/5" rowTextClass="text-slate-400" items={summary.skipped} />
            )}
            {summary.duplicates?.length > 0 && (
              <SummaryDetailPanel
                title="Potencjalne Duplikaty" count={summary.duplicates.length} icon={<AlertCircle className="w-4 h-4" />}
                accentClass="text-amber-400" rowClass="border-amber-500/30 bg-amber-500/5" items={summary.duplicates}
                onCopy={() => copy(summary.duplicates.join("\n"))} copied={copied} copyTitle="Kopiuj listę duplikatów"
              />
            )}
          </div>
        )}

        {errors.length > 0 && (
          <SummaryDetailPanel
            title="Błędy — nie zapisano" count={errors.length} icon={<XCircle className="w-4 h-4" />}
            accentClass="text-red-400" rowClass="border-red-500/30 bg-red-500/5" rowTextClass="text-red-300" items={errors}
            onCopy={() => copy(errors.join("\n"))} copied={copied} copyTitle="Kopiuj listę błędów"
          />
        )}
      </div>
    </motion.div>
  );
};
