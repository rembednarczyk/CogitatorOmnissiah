import React from "react";
import { motion } from "motion/react";
import { Calendar } from "lucide-react";
import { YearlyStat } from "../../hooks/useStats";
import { YearlyProgressItem } from "./YearlyProgressItem";

export const YearlyCard: React.FC<{ years: YearlyStat[] }> = ({ years }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 rounded-3xl border-orange-500/10 space-y-6">
    <h3 className="text-sm font-bold font-display uppercase tracking-widest text-orange-500 flex items-center gap-2 mb-4">
      <Calendar className="w-4 h-4" />
      Chronologia Przeczytanych
    </h3>
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {years.map((year) => (
        <YearlyProgressItem key={year.year} year={year} />
      ))}
    </div>
  </motion.div>
);
