import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Generyczny modal potwierdzenia operacji destrukcyjnej. */
export const ConfirmDialog: React.FC<Props> = ({ open, title, subtitle = "Operacja nieodwracalna", body, confirmLabel, cancelLabel = "Anuluj", onConfirm, onCancel }) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

          <div className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-slate-100 uppercase tracking-wider">{title}</h3>
                <p className="text-sm text-slate-500 font-medium">{subtitle}</p>
              </div>
            </div>

            <p className="text-lg text-slate-300 mb-8 font-medium leading-relaxed">{body}</p>

            <div className="flex gap-4">
              <button onClick={onCancel} className="flex-1 px-6 py-3 text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all active:scale-95">
                {cancelLabel}
              </button>
              <button onClick={onConfirm} className="flex-1 px-6 py-3 text-sm font-bold bg-gradient-to-br from-red-600 to-red-900 hover:from-red-500 hover:to-red-800 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 border border-red-500/30">
                {confirmLabel}
              </button>
            </div>
          </div>

          <button onClick={onCancel} className="absolute top-4 right-4 p-1 text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);
