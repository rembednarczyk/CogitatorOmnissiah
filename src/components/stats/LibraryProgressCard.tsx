import React from "react";
import { motion } from "motion/react";
import { Library } from "lucide-react";
import { LibraryProgressItem } from "./LibraryProgressItem";

type Lib = React.ComponentProps<typeof LibraryProgressItem>["library"];
type OnMark = React.ComponentProps<typeof LibraryProgressItem>["onMarkAsRead"];

export const LibraryProgressCard: React.FC<{ libraries: Lib[]; onMarkAsRead: OnMark; markingId: string | null }> = ({ libraries, onMarkAsRead, markingId }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6 rounded-3xl border-blue-500/10 space-y-6">
    <h3 className="text-sm font-bold font-display uppercase tracking-widest text-blue-500 flex items-center gap-2 mb-4">
      <Library className="w-4 h-4" />
      Książki dostępne w bibliotekach
    </h3>
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {libraries.map((library) => (
        <LibraryProgressItem key={library.id} library={library} onMarkAsRead={onMarkAsRead} markingId={markingId} />
      ))}
    </div>
  </motion.div>
);
