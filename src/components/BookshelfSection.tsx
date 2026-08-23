import React, { useState, useMemo, useCallback, useRef } from "react";
import { Library, BookOpen, CheckCircle2, Sparkles, Loader2, AlertCircle, X } from "lucide-react";
import { BookIndexEntry } from "../types";
import { useBooks } from "../hooks/useBooks";
import { useMarkRead } from "../hooks/useMarkRead";
import { ShelfId, ReadOverrides, isRead, splitShelves, featuredReads } from "../utils/bookshelf";
import { Shelf } from "./shelf/Shelf";
import { CoverCard } from "./shelf/CoverCard";

export const BookshelfSection: React.FC = () => {
  const { books, loading, error, fetchBooks } = useBooks();
  const { setRead } = useMarkRead();

  const [overrides, setOverrides] = useState<ReadOverrides>({});
  const [dragging, setDragging] = useState<BookIndexEntry | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Zapis stanu „przeczytane" jest SERIALIZOWANY per książka (latest-wins). Backend
  // `mutateMultiSelect` to nieatomowy retrieve→modify→update, więc dwa nakładające się
  // zapisy tej samej książki mogłyby przeczytać ten sam stan i rozjechać Notion z UI.
  // `pendingRef` trzyma najświeższy żądany stan, `runningRef` — książki z aktywnym runnerem.
  const pendingRef = useRef<Record<string, boolean>>({});
  const runningRef = useRef<Set<string>>(new Set());

  const all = books ?? [];
  const { read, toRead } = useMemo(() => splitShelves(all, overrides), [all, overrides]);
  const featured = useMemo(() => featuredReads(all, overrides), [all, overrides]);

  const handleDrop = useCallback((target: ShelfId) => {
    const book = dragging;
    setDragging(null);
    if (!book) return;

    const targetRead = target === "read";
    const wasRead = isRead(book, overrides);
    if (wasRead === targetRead) return; // upuszczono na tę samą półkę — nic

    // Optymistyczny ruch od razu.
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
  }, [dragging, overrides, setRead]);

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
        Przeciągnij wolumin między regałami — zapis trafia do kolumny „Źródło" w Notion
      </p>

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
        <>
          {/* Półka „Wyróżnione" (okładki twarzą) */}
          {featured.length > 0 && (
            <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-b from-purple-950/20 to-black/40 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-purple-300" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-purple-200">Wyróżnione — nagrodzone, przeczytane</h3>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-purple-500/10 border-purple-500/25 text-purple-300">{featured.length}</span>
              </div>
              <div className="flex gap-3.5 overflow-x-auto pb-1 custom-scrollbar">
                {featured.map((b) => <CoverCard key={b.id} book={b} />)}
              </div>
              <div className="h-4 rounded-[3px] mt-1 bg-gradient-to-b from-amber-800/70 via-amber-950/80 to-black shadow-[0_10px_16px_-6px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,220,170,.12)]" />
            </div>
          )}

          {/* Dwa regały */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Shelf
              shelfId="toRead" title="Do przeczytania" accent="cyan"
              icon={<BookOpen className="w-4 h-4" />}
              books={toRead} dragging={!!dragging}
              onDragStart={setDragging} onDragEnd={() => setDragging(null)} onDropBook={handleDrop}
            />
            <Shelf
              shelfId="read" title="Przeczytane" accent="emerald"
              icon={<CheckCircle2 className="w-4 h-4" />}
              books={read} dragging={!!dragging}
              onDragStart={setDragging} onDragEnd={() => setDragging(null)} onDropBook={handleDrop}
            />
          </div>

          <p className="text-center text-[10px] text-slate-600 uppercase tracking-widest font-bold">
            {all.length} woluminów · <span className="text-amber-400/70">●</span> = nagroda · najedź, by wysunąć grzbiet
          </p>
        </>
      )}
    </div>
  );
};
