import React, { useMemo } from "react";
import { BookIndexEntry } from "../../types";
import { spineStyle, SHELF_ROW_H, SHELF_PLANK_H } from "../../utils/bookshelf";
import { RenderSlot, assignDividerPlacement } from "../../utils/shelfLayout";
import { PlacedItem } from "../../utils/shelfPacking";
import { BookSpine } from "./BookSpine";
import { BookStack } from "./BookStack";
import { ShelfDivider } from "./ShelfDivider";

export const PLANK_STYLE: React.CSSProperties = {
  height: SHELF_PLANK_H,
  background: "var(--sk-plank-bg)",
  boxShadow: "0 8px 14px -6px rgba(0,0,0,.75)",
  borderRadius: 2,
};

/**
 * Szczelina precyzyjnego dropu: `beforeId` = wstaw przed tą książką; `afterId`
 * (ostatnia granica rzędu) = wstaw za tą książką — Shelf mapuje ją na `beforeId`
 * następnika w globalnej sekwencji (lub koniec półki).
 */
export interface GapBoundary {
  x: number;
  beforeId?: string;
  afterId?: string;
}

/** Kursor wstawienia (stan trzymany w Shelf; rząd rysuje swój fragment). */
export interface GapCaret {
  row: number;
  x: number;
  valid: boolean;
}

interface Props {
  row: PlacedItem[];
  slotByKey: Map<string, RenderSlot>;
  /** Szerokość toru (well) — do wykrycia tabliczek wychodzących poza prawą krawędź. */
  rowWidth: number;
  /** Indeks rzędu na stronie (adresowanie kursora wstawienia). */
  rowIndex: number;
  /** Precyzyjny drop aktywny (knob włączony + trwa przeciąganie). */
  preciseActive: boolean;
  /** Kursor wstawienia, jeśli wskazuje ten rząd. */
  caret: GapCaret | null;
  /** Najechanie na szczelinę (rząd, granica) / opuszczenie rzędu / drop w kursor. */
  onGapOver: (rowIndex: number, boundary: GapBoundary) => void;
  onGapLeave: () => void;
  onGapDrop: () => boolean; // true = obsłużone precyzyjnie (zatrzymaj propagację)
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/** Jeden rząd półki: woluminy na pozycjach z fizyki + drewniana deska pod spodem. */
export const ShelfRow: React.FC<Props> = ({ row, slotByKey, rowWidth, rowIndex, preciseActive, caret, onGapOver, onGapLeave, onGapDrop, onDragStart, onDragEnd }) => {
  // Rozmieszczenie tabliczek dekad (góra/dół + lewo/prawo) — unika kolizji i wyjścia poza półkę.
  const placement = assignDividerPlacement(row, (k) => {
    const s = slotByKey.get(k);
    return s && s.kind === "divider" ? s.label : undefined;
  }, rowWidth);

  // Granice szczelin: start każdego slotu-książki (wstaw przed pierwszym woluminem
  // slotu; kupka = jeden slot) + prawa krawędź ostatniego slotu (wstaw za ostatnim).
  const boundaries = useMemo<GapBoundary[]>(() => {
    const items = row.filter((p) => p.kind !== "divider").slice().sort((a, b) => a.x - b.x);
    const out: GapBoundary[] = [];
    for (const p of items) {
      const slot = slotByKey.get(p.key)!;
      const firstId = slot.kind === "stack" ? slot.books[0]?.id : slot.kind === "spine" ? slot.book.id : undefined;
      if (firstId) out.push({ x: p.x, beforeId: firstId });
    }
    const last = items[items.length - 1];
    if (last) {
      const slot = slotByKey.get(last.key)!;
      const lastId = slot.kind === "stack" ? slot.books[slot.books.length - 1]?.id : slot.kind === "spine" ? slot.book.id : undefined;
      if (lastId) out.push({ x: last.x + last.w, afterId: lastId });
    }
    return out;
  }, [row, slotByKey]);

  const rowCaret = caret && caret.row === rowIndex ? caret : null;

  const dragHandlers = preciseActive ? {
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      if (boundaries.length === 0) return;
      e.preventDefault(); // szczeliny przyjmują drop (bez stopPropagation — rama dalej podświetla cel)
      const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
      let nearest = boundaries[0];
      for (const b of boundaries) if (Math.abs(b.x - x) < Math.abs(nearest.x - x)) nearest = b;
      onGapOver(rowIndex, nearest);
    },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) onGapLeave();
    },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      // Obsłużone precyzyjnie → zatrzymaj (inaczej rama zrobi globalny drop drugi raz).
      if (onGapDrop()) { e.preventDefault(); e.stopPropagation(); }
    },
  } : {};

  return (
  <div>
    <div className="relative" style={{ height: SHELF_ROW_H }} {...dragHandlers}>
      {/* Warstwa 1: grzbiety/kupki + deseczki przekładek (z-20, nad tłem i deską). */}
      {row.map((p) => {
        const slot = slotByKey.get(p.key)!;
        if (slot.kind === "divider") {
          const pl = placement.get(p.key);
          return (
            <div key={p.key} className="absolute bottom-0" style={{ left: p.x, zIndex: 20 }}>
              <ShelfDivider part="board" label={slot.label} width={p.w} plate={pl?.level ?? "top"} dir={pl?.dir ?? "right"} />
            </div>
          );
        }
        if (slot.kind === "stack") {
          return (
            <div key={p.key} className="absolute bottom-0" style={{ left: p.x }}>
              <BookStack books={slot.books} onDragStart={onDragStart} onDragEnd={onDragEnd} />
            </div>
          );
        }
        return (
          <div
            key={p.key}
            className="absolute bottom-0"
            style={p.deg
              ? { left: p.x, transform: `rotate(${p.deg}deg)`, transformOrigin: p.deg > 0 ? "bottom right" : "bottom left" }
              : { left: p.x }}
          >
            <BookSpine book={slot.book} style={{ ...spineStyle(slot.book), width: p.w }} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          </div>
        );
      })}
      {/* Warstwa 2: same tabliczki dekad — ZAWSZE na wierzchu (z-40), nigdy pod deseczką sąsiada. */}
      {row.map((p) => {
        const slot = slotByKey.get(p.key)!;
        if (slot.kind !== "divider") return null;
        const pl = placement.get(p.key);
        return (
          <div key={`plate-${p.key}`} className="absolute bottom-0" style={{ left: p.x, zIndex: 40 }}>
            <ShelfDivider part="plate" label={slot.label} width={p.w} plate={pl?.level ?? "top"} dir={pl?.dir ?? "right"} />
          </div>
        );
      })}
      {/* Kursor wstawienia — neonowa kreska w najbliższej szczelinie (cyan = OK, róż = zła dekada). */}
      {rowCaret && (
        <div
          className="absolute pointer-events-none rounded-[2px]"
          style={{
            left: rowCaret.x - 1.5, width: 3, top: 4, bottom: 0, zIndex: 50,
            background: rowCaret.valid
              ? "linear-gradient(180deg, rgba(34,211,238,.95), rgba(34,211,238,.25))"
              : "linear-gradient(180deg, rgba(244,63,94,.9), rgba(244,63,94,.2))",
            boxShadow: rowCaret.valid ? "0 0 10px rgba(34,211,238,.8)" : "0 0 10px rgba(244,63,94,.7)",
          }}
          aria-hidden
        />
      )}
    </div>
    <div style={PLANK_STYLE} />
  </div>
  );
};

/** Pusta półka (dla wyrównania stałej wysokości regału) — sama deska. */
export const EmptyShelfRow: React.FC = () => (
  <div>
    <div style={{ height: SHELF_ROW_H }} />
    <div style={PLANK_STYLE} />
  </div>
);
