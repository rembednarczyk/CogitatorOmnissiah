import React from "react";
import { motion } from "motion/react";
import { formatETA } from "../../../utils/time";

/** Pasek postępu aktywnego skanu (message + ETA + current/total). */
export const VintedScanProgress: React.FC<{ progress: any }> = ({ progress }) => {
  if (!progress) return null;
  return (
    <div className="px-2 space-y-1">
      <div className="flex justify-between text-xs text-slate-400 uppercase font-bold">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="break-words">{progress.message}</span>
          {progress.startTime && (
            <span className="text-[10px] text-slate-500 lowercase font-medium">
              {formatETA(progress.current, progress.total, progress.startTime)}
            </span>
          )}
        </div>
        {progress.total > 0 && <span>{progress.current} / {progress.total}</span>}
      </div>
      {progress.total > 0 && (
        <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${(progress.current / progress.total) * 100}%` }} className="h-full bg-cyan-500" />
        </div>
      )}
    </div>
  );
};
