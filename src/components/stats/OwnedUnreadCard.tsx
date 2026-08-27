import React from "react";
import { motion } from "motion/react";
import { Package } from "lucide-react";
import { OwnedUnreadItem } from "./OwnedUnreadItem";

type Book = React.ComponentProps<typeof OwnedUnreadItem>["book"];
type OnMark = React.ComponentProps<typeof OwnedUnreadItem>["onMarkAsRead"];

export const OwnedUnreadCard: React.FC<{ books: Book[]; markingId: string | null; onMarkAsRead: OnMark }> = ({ books, markingId, onMarkAsRead }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-6 rounded-3xl border-emerald-500/10 space-y-6">
    <h3 className="text-sm font-bold font-display uppercase tracking-widest text-emerald-500 flex items-center gap-2 mb-4">
      <Package className="w-4 h-4" />
      Zasoby Oczekujące (Posiadane)
    </h3>
    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
      {books.length === 0 ? (
        <p className="text-slate-400 text-sm italic text-center py-8">Wszystkie posiadane zasoby zostały przyswojone.</p>
      ) : (
        books.map((book, idx) => (
          <OwnedUnreadItem key={idx} book={book} marking={markingId === book.id} disabled={markingId !== null} onMarkAsRead={onMarkAsRead} />
        ))
      )}
    </div>
  </motion.div>
);
