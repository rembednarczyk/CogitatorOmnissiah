import React, { useState, useMemo, useDeferredValue, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, Loader2, ScrollText, AlertCircle } from "lucide-react";
import { useBooks } from "../hooks/useBooks";
import { matchBooks, buildSearchVocab, didYouMean, replaceLastToken } from "../utils/bookSearch";
import { BookResultCard } from "./search/BookResultCard";

/** Ile kart maksymalnie rysujemy (ochrona DOM przy „pustym" zapytaniu = cały zbiór). */
const RENDER_CAP = 150;

export const SearchSection: React.FC = () => {
  const { books, loading, error, fetchBooks } = useBooks();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => matchBooks(deferredQuery, books ?? []), [deferredQuery, books]);
  const shown = results.slice(0, RENDER_CAP);
  const total = books?.length ?? 0;

  // „Czy chodziło Ci o…" — słownik liczony raz na zbiór; podpowiedzi tylko przy 0 trafień.
  const vocab = useMemo(() => buildSearchVocab(books ?? []), [books]);
  const suggestions = useMemo(
    () => (results.length === 0 && deferredQuery.trim() ? didYouMean(deferredQuery, vocab) : []),
    [results.length, deferredQuery, vocab]
  );

  return (
    <div className="space-y-8">
      {/* Nagłówek sekcji */}
      <div className="flex items-center gap-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        <div className="flex items-center gap-4">
          <ScrollText className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold font-display uppercase tracking-[0.4em] text-cyan-100/90 whitespace-nowrap">
            Skryptorium
          </h2>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </div>

      <p className="text-center text-[11px] text-slate-500 uppercase tracking-widest font-bold -mt-4">
        Przeszukiwanie zapisów archiwum — tytuł, tytuł oryginalny, autor
      </p>

      {/* Pole wyszukiwania */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400/50 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wpisz fragment tytułu lub nazwisko autora…"
          aria-label="Przeszukaj archiwum"
          className="w-full pl-14 pr-12 py-4 text-sm bg-slate-950/60 border border-white/10 text-slate-200 rounded-2xl focus:outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 placeholder-slate-600 transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
            title="Wyczyść"
            aria-label="Wyczyść zapytanie"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Licznik */}
      {books && !loading && (
        <p className="text-center text-xs text-slate-500 font-bold tracking-widest uppercase">
          {query.trim()
            ? `Znaleziono ${results.length} ${results.length === 1 ? "wolumin" : "woluminów"} z ${total}`
            : `${total} woluminów w archiwum`}
          {results.length > RENDER_CAP && ` · pokazano ${RENDER_CAP} — zawęź zapytanie`}
        </p>
      )}

      {/* Stany: ładowanie / błąd / brak trafień / siatka */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-bold uppercase tracking-widest">Wczytywanie zapisów…</span>
        </div>
      ) : error ? (
        <div className="glass-card p-6 rounded-3xl border-red-500/30 bg-red-500/5 max-w-xl mx-auto flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-300 font-bold">{error}</p>
            <button
              onClick={fetchBooks}
              className="mt-2 text-[11px] text-red-400/70 hover:text-red-300 uppercase tracking-widest font-bold"
            >
              Spróbuj ponownie
            </button>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-sm text-slate-600 italic">
            Archiwum milczy — żaden wolumin nie pasuje do „{query}".
          </p>
          {suggestions.length > 0 && (
            <p className="text-sm text-slate-400">
              Czy chodziło Ci o:{" "}
              {suggestions.map((s, i) => (
                <React.Fragment key={s}>
                  <button
                    onClick={() => { setQuery(replaceLastToken(query, s)); inputRef.current?.focus(); }}
                    className="text-cyan-300 hover:text-cyan-200 font-semibold underline decoration-dotted underline-offset-4 decoration-cyan-500/50"
                  >
                    {s}
                  </button>
                  {i < suggestions.length - 1 ? <span className="text-slate-600">, </span> : <span className="text-slate-500">?</span>}
                </React.Fragment>
              ))}
            </p>
          )}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {shown.map((book) => (
              <BookResultCard key={book.id} book={book} query={deferredQuery} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
