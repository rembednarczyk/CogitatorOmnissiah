import React from "react";
import { motion } from "motion/react";
import { ShoppingCart } from "lucide-react";
import { VintedCheckItem } from "./stats/VintedCheckItem";
import { useVintedCheck } from "../hooks/useVintedCheck";

export const VintedSection: React.FC = () => {
  const { vintedResults, searchAttempts, isChecking, checkProgress, vintedError, runVintedCheck, stopVintedCheck } = useVintedCheck();

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-6 mb-12">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-rose-500/20 to-transparent"></div>
        <div className="flex items-center gap-4">
          <ShoppingCart className="w-6 h-6 text-rose-400" />
          <h2 className="text-xl font-bold font-display uppercase tracking-[0.4em] text-rose-100/90 whitespace-nowrap">
            Skaner Vinted
          </h2>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-rose-500/20 to-transparent"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 rounded-3xl border-rose-500/10"
      >
        {vintedError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400 font-bold mb-6">
            Błąd Vinted: {vintedError}
          </div>
        )}

        <VintedCheckItem 
          results={vintedResults}
          searchAttempts={searchAttempts}
          onCheck={runVintedCheck}
          onStop={stopVintedCheck}
          isChecking={isChecking}
          progress={checkProgress}
        />
      </motion.div>
    </div>
  );
};
