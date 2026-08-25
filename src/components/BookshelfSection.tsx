import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Library, BookOpen, CheckCircle2, Sparkles, Loader2, AlertCircle, X } from "lucide-react";
import { BookIndexEntry } from "../types";
import { useBooks } from "../hooks/useBooks";
import { useMarkRead } from "../hooks/useMarkRead";
import { useShelfOrder } from "../hooks/useShelfOrder";
import { ShelfId, ReadOverrides, isRead, splitShelves, featuredReads } from "../utils/bookshelf";
import { planInsertion } from "../utils/shelfInsertion";
import { ShelfSkin, SHELF_SKINS, skinClass, loadSkin, saveSkin } from "../utils/shelfSkin";
import { useEffectiveConfig } from "../hooks/useAppConfig";
import { Shelf } from "./shelf/Shelf";
import { CoverCard } from "./shelf/CoverCard";
import { ShelfFrame } from "./shelf/ShelfFrame";
import { RoomDecor } from "./shelf/RoomDecor";

export const BookshelfSection: React.FC = () => {
  const { books, loading, error, fetchBooks } = useBooks();
  const { setRead } = useMarkRead();
  const { saveOrders } = useShelfOrder();

  const [overrides, setOverrides] = useState<ReadOverrides>({});
  const [dragging, setDragging] = useState<BookIndexEntry | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [skin, setSkin] = useState<ShelfSkin>(loadSkin);
  // Knoby UI: liczba rzędów regału na stronę + precyzyjny drop.
  const uiCfg = useEffectiveConfig().ui;
  const rowsPerPage = uiCfg.shelfRowsPerPage;
  // Optymistyczne nadpisania ręcznych kluczy porządku (precyzyjny drop) do czasu refetch.
  const [orderOverrides, setOrderOverrides] = useState<Record<string, number>>({});
  useEffect(() => { saveSkin(skin); }, [skin]);

  // Zapis stanu „przeczytane" jest SERIALIZOWANY per książka (latest-wins). Backend
  // `mutateMultiSelect` to nieatomowy retrieve→modify→update, więc dwa nakładające się
  // zapisy tej samej książki mogłyby przeczytać ten sam stan i rozjechać Notion z UI.
  // `pendingRef` trzyma najświeższy żądany stan, `runningRef` — książki z aktywnym runnerem.
  const pendingRef = useRef<Record<string, boolean>>({});
  const runningRef = useRef<Set<string>>(new Set());

  // Księgozbiór z nadpisanymi kluczami porządku (optymistycznie, do czasu refetch).
  const all = useMemo(() => {
    const src = books ?? [];
    return src.map((b) => (orderOverrides[b.id] !== undefined ? { ...b, shelfOrder: orderOverrides[b.id] } : b));
  }, [books, orderOverrides]);
  const { read, toRead } = useMemo(() => splitShelves(all, overrides), [all, overrides]);
  const featured = useMemo(() => featuredReads(all, overrides), [all, overrides]);

  /** Optymistyczna zmiana „przeczytane" + serializowany zapis (latest-wins per książka). */
  const applyReadChange = useCallback((book: BookIndexEntry, targetRead: boolean) => {
    setOverrides((prev) => ({ ...prev, [book.id]: targetRead }));
    setMoveError(null);

    // Zapisz najświeższy żądany stan; jeśli runner tej książki już działa, weźmie go sam.
    pendingRef.current[book.id] = targetRead;
    if (runningRef.current.has(book.id)) return;
    runningRef.current.add(book.id);
    void (async () => {
      try {
        while (book.id in pendingRef.current) {
          const desired = pendingRef.current[book.id];
          delete pendingRef.current[book.id];
          await setRead(book.id, desired);
        }
      } catch (e: any) {
        // Zapis nie doszedł — wróć do stanu z bazy i pokaż błąd.
        delete pendingRef.current[book.id];
        setOverrides((prev) => { const next = { ...prev }; delete next[book.id]; return next; });
        setMoveError(`Nie udało się zapisać „${book.plTitle || book.origTitle}": ${e.message}`);
      } finally {
        runningRef.current.delete(book.id);
      }
    })();
  }, [setRead]);

  const handleDrop = useCallback((target: ShelfId) => {
    const book = dragging;
    setDragging(null);
    if (!book) return;

    const targetRead = target === "read";
    if (isRead(book, overrides) === targetRead) return; // upuszczono na tę samą półkę — nic
    applyReadChange(book, targetRead);
  }, [dragging, overrides, applyReadChange]);

  /**
   * Precyzyjny drop: wstaw książkę przed `insertBeforeId` (null = koniec półki).
   * Klucze liczy czysty `planInsertion` (zwykle 1 wpis; remis roku → mała renumeracja);
   * zapis optymistyczny + POST /api/shelf-order z rollbackiem. Przy zmianie półki
   * dokłada się standardowa zmiana „przeczytane".
   */
  const handlePreciseDrop = useCallback((target: ShelfId, insertBeforeId: string | null) => {
    const book = dragging;
    setDragging(null);
    if (!book) return;

    const targetRead = target === "read";
    const wasRead = isRead(book, overrides);
    const seq = (targetRead ? read : toRead).filter((b) => b.id !== book.id);
    const plan = planInsertion(seq, book, insertBeforeId);

    if (plan && plan.orders.length > 0) {
      setOrderOverrides((prev) => {
        const next = { ...prev };
        for (const o of plan.orders) next[o.pageId] = o.order;
        return next;
      });
      void (async () => {
        try {
          await saveOrders(plan.orders);
        } catch (e: any) {
          setOrderOverrides((prev) => {
            const next = { ...prev };
            for (const o of plan.orders) delete next[o.pageId];
            return next;
          });
          setMoveError(`Nie udało się zapisać pozycji „${book.plTitle || book.origTitle}": ${e.message}`);
        }
      })();
    }

    if (wasRead !== targetRead) applyReadChange(book, targetRead);
  }, [dragging, overrides, read, toRead, applyReadChange]);

  return (
    <div className="space-y-8">
      {/* Nagłówek */}
      <div className="flex items-center gap-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        <div className="flex items-center gap-4">
          <Library className="w-6 h-6 text-amber-300" />
          <h2 className="text-xl font-bold font-display uppercase tracking-[0.4em] text-amber-100/90 whitespace-nowrap">Regał Archiwum</h2>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      </div>
      <p className="text-center text-[11px] text-slate-500 uppercase tracking-widest font-bold -mt-4">
        Przeciągnij wolumin między regałami · strzałkami przełączasz segmenty „Regał N"
      </p>

      {/* Przełącznik skóry regału (Holo+ / Relikwiarz) — wybór trwa w localStorage */}
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
        <div className={skinClass(skin)}>
        <RoomDecor>
          {/* Półka „Wyróżnione" (okładki twarzą) */}
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

          {/* Dwa regały stałej wysokości: lewy „Do przeczytania", prawy zawsze
              „Przeczytane" — drag&drop między nimi. Każdy paginowany (Regał N/M). */}
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
