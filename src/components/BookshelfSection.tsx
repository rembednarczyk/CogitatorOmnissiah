import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Library, BookOpen, CheckCircle2, Sparkles, Loader2, AlertCircle, X } from "lucide-react";
import { BookIndexEntry } from "../types";
import { useBooks } from "../hooks/useBooks";
import { useShelfMutations } from "../hooks/useShelfMutations";
import { ShelfId, isRead, splitShelves, featuredReads } from "../utils/bookshelf";
import { planInsertion } from "../utils/shelfInsertion";
import { ShelfSkin, SHELF_SKINS, skinClass, loadSkin, saveSkin } from "../utils/shelfSkin";
import { useEffectiveConfig } from "../hooks/useAppConfig";
import { useTheme } from "../hooks/useTheme";
import { Shelf } from "./shelf/Shelf";
import { CoverCard } from "./shelf/CoverCard";
import { ShelfFrame } from "./shelf/ShelfFrame";
import { RoomDecor } from "./shelf/RoomDecor";

export const BookshelfSection: React.FC = () => {
  const { books, loading, error, fetchBooks } = useBooks();
  const { overrides, orderOverrides, moveError, setMoveError, applyReadChange, applyOrderPlan } = useShelfMutations();

  const [dragging, setDragging] = useState<BookIndexEntry | null>(null);
  const [skin, setSkin] = useState<ShelfSkin>(loadSkin);
  const { theme } = useTheme();
  // Jasny motyw „Librem" = jeden regał jak z makiety: wymuszamy matową skórę
  // (`noospheric`) i chowamy przełącznik. Zapisany wybór skóry zostaje dla
  // motywu ciemnego — nie nadpisujemy `skin`, tylko klasę renderowaną tutaj.
  const renderedSkin: ShelfSkin = theme === "light" ? "noospheric" : skin;
  // UI knobs: number of „Regał" rows per page + precise drop.
  const uiCfg = useEffectiveConfig().ui;
  const rowsPerPage = uiCfg.shelfRowsPerPage;
  useEffect(() => { saveSkin(skin); }, [skin]);

  // Book collection with overridden order keys (optimistically, until refetch).
  const all = useMemo(() => {
    const src = books ?? [];
    return src.map((b) => (orderOverrides[b.id] !== undefined ? { ...b, shelfOrder: orderOverrides[b.id] } : b));
  }, [books, orderOverrides]);
  const { read, toRead } = useMemo(() => splitShelves(all, overrides), [all, overrides]);
  const featured = useMemo(() => featuredReads(all, overrides), [all, overrides]);

  const handleDrop = useCallback((target: ShelfId) => {
    const book = dragging;
    setDragging(null);
    if (!book) return;

    const targetRead = target === "read";
    if (isRead(book, overrides) === targetRead) return; // dropped on the same shelf — nothing
    applyReadChange(book, targetRead);
  }, [dragging, overrides, applyReadChange]);

  /**
   * Precise drop: insert the book before `insertBeforeId` (null = end of shelf).
   * Keys are computed by the pure `planInsertion` (usually 1 entry; year tie → small renumbering);
   * optimistic save + POST /api/shelf-order with rollback. On a shelf change
   * the standard „przeczytane" change is added on top.
   */
  const handlePreciseDrop = useCallback((target: ShelfId, insertBeforeId: string | null) => {
    const book = dragging;
    setDragging(null);
    if (!book) return;

    const targetRead = target === "read";
    const wasRead = isRead(book, overrides);
    const seq = (targetRead ? read : toRead).filter((b) => b.id !== book.id);
    const plan = planInsertion(seq, book, insertBeforeId);

    if (plan && plan.orders.length > 0) applyOrderPlan(book, plan.orders);
    if (wasRead !== targetRead) applyReadChange(book, targetRead);
  }, [dragging, overrides, read, toRead, applyReadChange, applyOrderPlan]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        <div className="flex items-center gap-4">
          <Library className="w-6 h-6 text-amber-300" />
          <h2 className="text-xl font-bold font-display uppercase tracking-[0.4em] text-amber-100/90 whitespace-nowrap">Regał</h2>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      </div>
      {/* Hint differs by input: a swipe is undiscoverable without saying so, and the
          chevrons are the mouse affordance. Shown per breakpoint, not per device. */}
      <p className="text-center text-[11px] text-slate-500 uppercase tracking-widest font-bold -mt-4">
        <span className="hidden sm:inline">Przeciągnij wolumin między regałami · strzałkami przełączasz segmenty „Regał N"</span>
        <span className="sm:hidden">Przesuń palcem w bok, aby zmienić segment „Regał N"</span>
      </p>

      {/* „Regał" skin switch (Holo+ / Klasyczny) — choice persists in localStorage.
          Ukryty w jasnym motywie: tam regał ma jeden wygląd (jak z makiety). */}
      {theme !== "light" && (
        <div className="flex items-center justify-center gap-2 -mt-3">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Skóra</span>
          <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
            {SHELF_SKINS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSkin(s.id)}
                aria-pressed={skin === s.id}
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider font-display transition-colors ${skin === s.id ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {moveError && (
        <div className="glass-card p-4 rounded-2xl border-red-500/30 bg-red-500/5 max-w-2xl mx-auto flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{moveError}</p>
          <button onClick={() => setMoveError(null)} className="text-red-400/70 hover:text-red-300" aria-label="Zamknij">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-bold uppercase tracking-widest">Wczytywanie księgozbioru…</span>
        </div>
      ) : error ? (
        <div className="glass-card p-6 rounded-3xl border-red-500/30 bg-red-500/5 max-w-xl mx-auto flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-300 font-bold">{error}</p>
            <button onClick={fetchBooks} className="mt-2 text-[11px] text-red-400/70 hover:text-red-300 uppercase tracking-widest font-bold">Spróbuj ponownie</button>
          </div>
        </div>
      ) : (
        <div className={skinClass(renderedSkin)}>
        <RoomDecor>
          {/* „Wyróżnione" shelf (covers facing out) */}
          {featured.length > 0 && (
            <div className="mb-8">
              <ShelfFrame
                title="Wyróżnione — nagrodzone, przeczytane"
                icon={<Sparkles className="w-4 h-4" />}
                accent="purple" count={featured.length}
              >
                <div className="flex items-end gap-3.5 overflow-x-auto pb-1 pt-1 custom-scrollbar">
                  {featured.map((b) => <CoverCard key={b.id} book={b} />)}
                </div>
                <div
                  className="h-[15px] mt-[2px] rounded-[2px]"
                  style={{ background: "var(--sk-plank-bg)", boxShadow: "0 8px 14px -6px rgba(0,0,0,.75)" }}
                />
              </ShelfFrame>
            </div>
          )}

          {/* Two fixed-height shelves: left „Do przeczytania", right always
              „Przeczytane" — drag&drop between them. Each paginated (Regał N/M). */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Shelf
              shelfId="toRead" title="Do przeczytania" accent="cyan" pageSize={rowsPerPage}
              icon={<BookOpen className="w-4 h-4" />}
              books={toRead} draggingBook={dragging}
              preciseEnabled={uiCfg.preciseShelfDrop} onPreciseDrop={handlePreciseDrop}
              onDragStart={setDragging} onDragEnd={() => setDragging(null)} onDropBook={handleDrop}
            />
            <Shelf
              shelfId="read" title="Przeczytane" accent="emerald" pageSize={rowsPerPage}
              icon={<CheckCircle2 className="w-4 h-4" />}
              books={read} draggingBook={dragging}
              preciseEnabled={uiCfg.preciseShelfDrop} onPreciseDrop={handlePreciseDrop}
              onDragStart={setDragging} onDragEnd={() => setDragging(null)} onDropBook={handleDrop}
            />
          </div>

          <p className="text-center text-[10px] text-amber-200/60 uppercase tracking-widest font-bold mt-6">
            {all.length} woluminów · <span className="text-amber-400/70">●</span> = nagroda · najedź, by wysunąć grzbiet
          </p>
        </RoomDecor>
        </div>
      )}
    </div>
  );
};
