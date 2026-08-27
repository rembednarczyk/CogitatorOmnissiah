import React from "react";
import { motion } from "motion/react";
import { Award, Book } from "lucide-react";
import { AwardCoverageStat } from "../../hooks/useStats";
import { ProgressBar } from "./ProgressBar";
import { AwardCoverageGrid } from "./AwardCoverageGrid";

interface Props {
  awardBooks: { read: number; total: number };
  allAwards: { read: number; total: number };
  coverage: AwardCoverageStat[];
}

export const AwardsProgressCard: React.FC<Props> = ({ awardBooks, allAwards, coverage }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 rounded-3xl border-purple-500/10 space-y-6">
    <h3 className="text-sm font-bold font-display uppercase tracking-widest text-purple-500 flex items-center gap-2 mb-4">
      <Award className="w-4 h-4" />
      Postęp kolekcji
    </h3>
    <div className="space-y-6">
      <ProgressBar current={awardBooks.read} total={awardBooks.total} label="Polskie wydania z listy nagród" icon={Book} color="purple" />
      <ProgressBar current={allAwards.read} total={allAwards.total} label="Książki mające Wszystkie Nagrody" icon={Award} color="emerald" />
      <AwardCoverageGrid coverage={coverage} />
    </div>
  </motion.div>
);
