import React from "react";
import { motion } from "motion/react";
import { Database, Clock } from "lucide-react";
import { StoredView } from "../../../utils/vintedSellers";
import { shortDate } from "../../../utils/vintedFormat";

interface Props {
  isResolving: boolean;
  resolveProgress: any;
  resolveError: string | null;
  resolveResult: { message?: string } | null;
  storedError: string | null;
  stored: StoredView | null;
  isLoadingStored: boolean;
  usingStored: boolean;
  displayCount: number;
}

/** Paski/banery statusu: identyfikacja sprzedawców + źródło danych z bazy. */
export const VintedResolveStatus: React.FC<Props> = ({
  isResolving, resolveProgress, resolveError, resolveResult, storedError, stored, isLoadingStored, usingStored, displayCount,
}) => (
  <>
    {isResolving && resolveProgress && (
      <div className="px-2 space-y-1">
        <div className="flex justify-between text-xs text-indigo-300 uppercase font-bold">
          <span className="break-words">{resolveProgress.message}</span>
          {resolveProgress.total > 0 && <span>{resolveProgress.current} / {resolveProgress.total}</span>}
        </div>
        {resolveProgress.total > 0 && (
          <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(resolveProgress.current / resolveProgress.total) * 100}%` }} className="h-full bg-indigo-500" />
          </div>
        )}
      </div>
    )}
    {resolveError && <p className="text-xs text-red-400 italic px-2">{resolveError}</p>}
    {!isResolving && resolveResult && <p className="text-xs text-indigo-300/80 px-2">{resolveResult.message}</p>}
    {storedError && <p className="text-xs text-red-400 italic px-2">{storedError}</p>}
    {stored && stored.results.length === 0 && !isLoadingStored && (
      <p className="text-xs text-slate-500 italic px-2">Baza Vinted jest pusta — najpierw uruchom skan (i „Ustal sprzedawców (baza)").</p>
    )}

    {usingStored && stored && (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200 font-medium">
        <Database className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
        <span className="font-bold uppercase tracking-widest">Dane z bazy</span>
        <span className="text-indigo-300/70">· {displayCount} książek z ofertami</span>
        {stored.oldest && (
          <span className="flex items-center gap-1 text-indigo-300/70">
            <Clock className="w-3 h-3" />
            skany {shortDate(stored.oldest)}{stored.newest && stored.newest !== stored.oldest ? `–${shortDate(stored.newest)}` : ""}
          </span>
        )}
      </div>
    )}
  </>
);
