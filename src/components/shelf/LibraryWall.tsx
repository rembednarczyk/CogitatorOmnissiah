import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, BookOpen, CheckCircle2 } from "lucide-react";
import { BookIndexEntry } from "../../types";
import { ShelfId } from "../../utils/bookshelf";
import { packAndLayout } from "../../utils/shelfPacking";
import { buildShelfItems, chunk } from "../../utils/shelfLayout";
import { Bookcase } from "./Bookcase";

interface Props {
  toRead: BookIndexEntry[];
  read: BookIndexEntry[];
  dragging: boolean;
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
  onDropBook: (target: ShelfId) => void;
}

const CASE_W = 300;        // szerokość rzędu w regale (== rowWidth)
const SHELVES = 5;         // półek na regał
const GAP = 26;            // odstęp między regałami (naturalny, przed skalą)
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/**
 * Gęsta pozioma ŚCIANA regałów. Aktywną kolekcję (do przeczytania / przeczytane)
 * dzieli na regały po `SHELVES` półek, skaluje do wysokości viewportu i pokazuje
 * tyle regałów, ile zmieści się na szerokość; resztę przełączasz strzałkami.
 * Przenoszenie między kolekcjami: dok upuszczania na dole (podczas przeciągania).
 */
export const LibraryWall: React.FC<Props> = ({ toRead, read, dragging, onDragStart, onDragEnd, onDropBook }) => {
  const [collection, setCollection] = useState<ShelfId>("toRead");
  const [win, setWin] = useState(0);
  const [availW, setAvailW] = useState(0);
  const [availH, setAvailH] = useState(560);
  const [dockOver, setDockOver] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const measRef = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState({ w: CASE_W + 40, h: 900 });

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const upd = () => {
      setAvailW(el.clientWidth);
      setAvailH(Math.max(420, Math.min(920, window.innerHeight - 260)));
    };
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    window.addEventListener("resize", upd);
    return () => { ro.disconnect(); window.removeEventListener("resize", upd); };
  }, []);

  const books = collection === "toRead" ? toRead : read;
  const { items, slotByKey } = useMemo(() => buildShelfItems(books), [books]);
  const rows = availW > 0 ? packAndLayout(items, { rowWidth: CASE_W }) : [];
  const cases = chunk(rows, SHELVES);

  // Zmierz naturalny rozmiar jednego regału (stały — dopełniany do SHELVES).
  useLayoutEffect(() => {
    const el = measRef.current;
    if (el && el.offsetHeight > 0) setNat({ w: el.offsetWidth, h: el.offsetHeight });
  }, [cases.length === 0]);

  const scale = Math.min(1, availH / nat.h);
  const perScreen = Math.max(1, Math.floor((availW / scale + GAP) / (nat.w + GAP)));
  const winCount = Math.max(1, Math.ceil(cases.length / perScreen));
  const winIdx = Math.min(win, winCount - 1);
  const from = winIdx * perScreen;
  const shown = cases.slice(from, from + perScreen);

  const other: ShelfId = collection === "toRead" ? "read" : "toRead";
  const toggle = (id: ShelfId, label: string, n: number, Icon: React.FC<{ className?: string }>) => (
    <button
      onClick={() => { setCollection(id); setWin(0); }}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-display font-bold uppercase tracking-widest border transition-all ${
        collection === id ? "bg-amber-500/15 border-amber-500/40 text-amber-100" : "border-white/10 text-amber-200/50 hover:text-amber-100"}`}
    >
      <Icon className="w-4 h-4" />{label}<span className="text-amber-200/40">· {n}</span>
    </button>
  );

  return (
    <div className="relative z-10">
      {/* Przełącznik kolekcji + pager */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {toggle("toRead", "Do przeczytania", toRead.length, BookOpen)}
        {toggle("read", "Przeczytane", read.length, CheckCircle2)}
        {winCount > 1 && (
          <div className="flex items-center gap-1.5 ml-2">
            <button onClick={() => setWin((p) => Math.max(0, Math.min(p, winCount - 1) - 1))} disabled={winIdx === 0}
              className="p-1.5 rounded-md text-amber-200/70 hover:text-amber-100 disabled:opacity-30" aria-label="Poprzednie regały">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-[11px] font-display font-bold uppercase tracking-widest text-amber-200/80">
              Regały {ROMAN[from] ?? from + 1}–{ROMAN[Math.min(from + shown.length, cases.length) - 1] ?? Math.min(from + shown.length, cases.length)}<span className="text-amber-200/40"> / {cases.length}</span>
            </span>
            <button onClick={() => setWin((p) => Math.min(winCount - 1, Math.min(p, winCount - 1) + 1))} disabled={winIdx >= winCount - 1}
              className="p-1.5 rounded-md text-amber-200/70 hover:text-amber-100 disabled:opacity-30" aria-label="Następne regały">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Ściana regałów (skalowana do wysokości) */}
      <div ref={rowRef} className="relative flex justify-center" style={{ height: nat.h * scale + 40 }}>
        {books.length === 0 ? (
          <div className="text-sm text-amber-200/40 italic pt-16">Ta kolekcja jest pusta.</div>
        ) : (
          <div className="absolute top-0 left-1/2" style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center", display: "flex", gap: GAP }}>
            {shown.map((caseRows, i) => (
              <Bookcase
                key={from + i}
                name={`Regał ${ROMAN[from + i] ?? from + i + 1}`}
                count={caseRows.reduce((s, r) => s + r.length, 0)}
                rows={caseRows} slotByKey={slotByKey} shelves={SHELVES} innerWidth={CASE_W}
                onDragStart={onDragStart} onDragEnd={onDragEnd}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ukryty regał do pomiaru naturalnego rozmiaru */}
      <div ref={measRef} className="absolute -left-[9999px] top-0 pointer-events-none opacity-0" aria-hidden>
        <Bookcase name="Regał" count={0} rows={cases[0] ?? []} slotByKey={slotByKey} shelves={SHELVES} innerWidth={CASE_W} onDragStart={() => {}} onDragEnd={() => {}} />
      </div>

      {/* Dok upuszczania (podczas przeciągania) — przenosi do drugiej kolekcji */}
      {dragging && (
        <div
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!dockOver) setDockOver(true); }}
          onDragLeave={() => setDockOver(false)}
          onDrop={(e) => { e.preventDefault(); setDockOver(false); onDropBook(other); }}
          className={`mt-6 mx-auto max-w-2xl flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-dashed transition-all ${
            dockOver ? "border-amber-400/70 bg-amber-500/10 text-amber-100" : "border-amber-500/30 text-amber-200/70"}`}
        >
          {other === "read" ? <CheckCircle2 className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          <span className="text-sm font-display font-bold uppercase tracking-widest">
            Upuść tutaj → {other === "read" ? "Przeczytane" : "Do przeczytania"}
          </span>
        </div>
      )}
    </div>
  );
};
