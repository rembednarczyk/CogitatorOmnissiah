import React from "react";
import { motion } from "motion/react";
import { Search, RefreshCw } from "lucide-react";
import { IdentifiedBooks } from "../../hooks/useStats";
import { IdentifiedLibraryItem } from "./IdentifiedLibraryItem";

type Branch = React.ComponentProps<typeof IdentifiedLibraryItem>["library"];
type Progress = React.ComponentProps<typeof IdentifiedLibraryItem>["progress"];
type OnMark = React.ComponentProps<typeof IdentifiedLibraryItem>["onMarkAsRead"];
type MarkedIds = React.ComponentProps<typeof IdentifiedLibraryItem>["markedIds"];

interface Props {
  branches: Branch[];
  identifiedBooks: IdentifiedBooks;
  onCheck: (id: string, code: string) => void;
  onCheckAll: () => void;
  onStop: () => void;
  checkingLibrary: string | null;
  checkProgress: Progress;
  libraryError: string | null;
  onMarkAsRead: OnMark;
  markingId: string | null;
  markedIds: MarkedIds;
}

export const IdentifiedLibraryCard: React.FC<Props> = ({
  branches, identifiedBooks, onCheck, onCheckAll, onStop, checkingLibrary, checkProgress, libraryError, onMarkAsRead, markingId, markedIds,
}) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-6 rounded-3xl border-blue-500/10 space-y-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-bold font-display uppercase tracking-widest text-blue-400 flex items-center gap-2">
        <Search className="w-4 h-4" />
        Zidentyfikowane w bibliotekach
      </h3>
      <button
        onClick={onCheckAll}
        disabled={checkingLibrary !== null}
        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-xl border border-blue-500/30 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
      >
        {checkingLibrary ? (
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
            <RefreshCw className="w-3 h-3" />
          </motion.div>
        ) : (
          <Search className="w-3 h-3" />
        )}
        Skanuj Wszystkie
      </button>
    </div>
    {libraryError && (
      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold mb-4">
        Błąd skanowania: {libraryError}
      </div>
    )}
    <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
      {branches.map((library) => (
        <IdentifiedLibraryItem
          key={library.id}
          library={library}
          books={identifiedBooks[library.id] || []}
          onCheck={() => onCheck(library.id, library.code)}
          onStop={onStop}
          onMarkAsRead={onMarkAsRead}
          markingId={markingId}
          markedIds={markedIds}
          isChecking={checkingLibrary === library.id}
          progress={checkingLibrary === library.id ? checkProgress : null}
        />
      ))}
    </div>
  </motion.div>
);
