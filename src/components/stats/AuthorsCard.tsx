import React from "react";
import { motion } from "motion/react";
import { User } from "lucide-react";
import { AuthorStat } from "../../hooks/useStats";
import { AuthorProgressItem } from "./AuthorProgressItem";

export const AuthorsCard: React.FC<{ authors: AuthorStat[] }> = ({ authors }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-3xl border-cyan-500/10 space-y-6">
    <h3 className="text-sm font-bold font-display uppercase tracking-widest text-cyan-500 flex items-center gap-2 mb-4">
      <User className="w-4 h-4" />
      Indeks Autorów
    </h3>
    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
      {authors.map((author) => (
        <AuthorProgressItem key={author.name} author={author} />
      ))}
    </div>
  </motion.div>
);
