import React from "react";
import type { AwardCoverageStat } from "../../hooks/useStats";

interface Props {
  coverage: AwardCoverageStat[];
}

/** Coverage grid of individual awards — percent obtained out of the total. */
export const AwardCoverageGrid: React.FC<Props> = ({ coverage }) => (
  <div className="pt-4 space-y-3">
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Pokrycie Poszczególnych Nagród</p>
    <div className="grid grid-cols-2 gap-3">
      {coverage.map((award, idx) => (
        <div key={idx} className="bg-slate-950/50 border border-slate-800 p-2 rounded-xl">
          <div className="text-xs font-bold text-slate-400 uppercase truncate">{award.name}</div>
          <div className="text-lg font-bold font-display text-purple-400">
            {Math.round((award.count / award.total) * 100)}%
          </div>
        </div>
      ))}
    </div>
  </div>
);
