import React, { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BookIndexEntry } from "../../types";
import { ShelfId, SHELF_ROW_GAP, SHELF_PLANK_H } from "../../utils/bookshelf";
import { packAndLayout } from "../../utils/shelfPacking";
import { buildShelfItems, chunk } from "../../utils/shelfLayout";
import { ShelfRow, EmptyShelfRow } from "./ShelfRow";
import { ShelfFrame, ShelfAccent } from "./ShelfFrame";

interface Props {
  shelfId: ShelfId;
  title: string;
  icon: React.ReactNode;
  accent: Extract<ShelfAccent, "emerald" | "cyan">;
  books: BookIndexEntry[];
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
  onDropBook: (target: ShelfId) => void;
  dragging: boolean;
  /** Gdy podane: regał ma STAŁĄ wysokość tylu rzędów i dzieli się na segmenty „Regał I/N". */
  pageSize?: number;
}

/** Jeden regał: drewniany korpus + FIZYCZNE rozłożenie woluminów (wypełnione półki, oparte pochyły). */
export const Shelf: React.FC<Props> = ({ shelfId, title, icon, accent, books, onDragStart, onDragEnd, onDropBook, dragging, pageSize }) => {
  const [over, setOver] = useState(false);
  const [page, setPage] = useState(0);
  const wellRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wellRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rootProps: React.HTMLAttributes<HTMLDivElement> = {
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!over) setOver(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); },
    onDrop: (e) => { e.preventDefault(); setOver(false); onDropBook(shelfId); },
  };

  const { items, slotByKey } = buildShelfItems(books);
  const rows = width > 0 ? packAndLayout(items, { rowWidth: width }) : [];

  // Segmenty „Regał I/N" przy stałej wysokości.
  const segments = pageSize ? chunk(rows, pageSize) : [rows];
  const pageCount = Math.max(1, segments.length);
  const cur = Math.min(page, pageCount - 1);
  const shown = segments[cur] ?? [];
  const pad = pageSize ? Math.max(0, pageSize - shown.length) : 0;

  const headerExtra = (
    <div className="flex items-center gap-2">
      {dragging && <span className="text-[10px] uppercase tracking-widest text-amber-200/70 font-bold">upuść tutaj</span>}
      {pageSize && pageCount > 1 && (
        <div className="flex items-center gap-1.5">
          <button onClick={() => setPage((p) => Math.max(0, Math.min(p, pageCount - 1) - 1))} disabled={cur === 0}
            className="p-1 rounded-md text-amber-200/70 hover:text-amber-100 disabled:opacity-30" aria-label="Poprzedni regał">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-display font-bold uppercase tracking-widest text-amber-200/80">Regał {cur + 1}<span className="text-amber-200/40"> / {pageCount}</span></span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, Math.min(p, pageCount - 1) + 1))} disabled={cur >= pageCount - 1}
            className="p-1 rounded-md text-amber-200/70 hover:text-amber-100 disabled:opacity-30" aria-label="Następny regał">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      {/* Świeca na szczycie regału */}
      <div className="absolute -top-[26px] left-8 z-20 pointer-events-none" aria-hidden>
        <div className="w-[9px] h-[24px] mx-auto rounded-[2px] bg-gradient-to-b from-[#e8dcc0] via-[#d8c8a2] to-[#b9a271]" />
        <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 w-[8px] h-[13px] rounded-[50%_50%_45%_45%/60%_60%_40%_40%]"
          style={{ background: "radial-gradient(circle at 50% 72%, #fff3c0, #ffb03a 55%, #ff6a00)", boxShadow: "0 0 14px 5px rgba(255,150,40,.5)" }} />
      </div>

      <ShelfFrame
        title={title} icon={icon} accent={accent} count={books.length}
        highlight={over ? "target" : dragging ? "dragging" : "idle"}
        headerExtra={headerExtra}
        rootProps={rootProps}
      >
        {books.length === 0 ? (
          <div className="min-h-[140px] flex items-center justify-center text-xs text-slate-500 italic">
            {dragging ? "Upuść wolumin, aby przenieść" : "Pusto na tej półce"}
          </div>
        ) : (
          <div ref={wellRef} className="flex flex-col" style={{ rowGap: SHELF_ROW_GAP - SHELF_PLANK_H }}>
            {shown.map((row, ri) => (
              <ShelfRow key={cur * 1000 + ri} row={row} slotByKey={slotByKey} onDragStart={onDragStart} onDragEnd={onDragEnd} />
            ))}
            {Array.from({ length: pad }).map((_, i) => <EmptyShelfRow key={`pad${i}`} />)}
          </div>
        )}
      </ShelfFrame>

      {/* Cokół / nóżki — regał „stoi na podłodze" */}
      <div className="mx-2 h-[10px] rounded-b-[6px]" style={{ background: "var(--sk-plinth)", boxShadow: "0 10px 16px -6px rgba(0,0,0,.7)" }} aria-hidden />
      <div className="flex justify-between px-6" aria-hidden>
        {[0, 1].map((i) => <div key={i} className="w-8 h-[9px] rounded-b-[4px]" style={{ background: "var(--sk-foot)" }} />)}
      </div>
    </div>
  );
};
