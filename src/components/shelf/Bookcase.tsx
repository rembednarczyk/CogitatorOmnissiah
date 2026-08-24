import React from "react";
import { Library } from "lucide-react";
import { BookIndexEntry } from "../../types";
import { ShelfSlot, SHELF_ROW_GAP, SHELF_PLANK_H } from "../../utils/bookshelf";
import { PlacedItem } from "../../utils/shelfPacking";
import { ShelfRow, EmptyShelfRow } from "./ShelfRow";
import { ShelfFrame } from "./ShelfFrame";

interface Props {
  name: string;                 // „Regał III"
  count: number;                // ile woluminów w tym regale
  rows: PlacedItem[][];         // rzędy tego regału (≤ shelves)
  slotByKey: Map<string, ShelfSlot>;
  shelves: number;              // stała liczba półek (dopełniane pustą deską)
  innerWidth: number;           // szerokość rzędu (== rowWidth z packAndLayout)
  onDragStart: (book: BookIndexEntry) => void;
  onDragEnd: () => void;
}

/** Jeden regał ściany: stała liczba półek, świeca na szczycie, cokół. Bez pomiaru/pagera. */
export const Bookcase: React.FC<Props> = ({ name, count, rows, slotByKey, shelves, innerWidth, onDragStart, onDragEnd }) => {
  const pad = Math.max(0, shelves - rows.length);
  return (
    <div className="relative shrink-0">
      {/* Świeca na szczycie */}
      <div className="absolute -top-[24px] left-7 z-20 pointer-events-none" aria-hidden>
        <div className="w-[8px] h-[22px] mx-auto rounded-[2px] bg-gradient-to-b from-[#e8dcc0] via-[#d8c8a2] to-[#b9a271]" />
        <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 w-[7px] h-[12px] rounded-[50%_50%_45%_45%/60%_60%_40%_40%]"
          style={{ background: "radial-gradient(circle at 50% 72%, #fff3c0, #ffb03a 55%, #ff6a00)", boxShadow: "0 0 12px 4px rgba(255,150,40,.5)" }} />
      </div>

      <ShelfFrame title={name} icon={<Library className="w-4 h-4" />} accent="amber" count={count} highlight="idle">
        <div className="flex flex-col mx-auto" style={{ rowGap: SHELF_ROW_GAP - SHELF_PLANK_H, width: innerWidth }}>
          {rows.map((row, ri) => (
            <ShelfRow key={ri} row={row} slotByKey={slotByKey} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          ))}
          {Array.from({ length: pad }).map((_, i) => <EmptyShelfRow key={`pad${i}`} />)}
        </div>
      </ShelfFrame>

      {/* Cokół / nóżki */}
      <div className="mx-2 h-[10px] rounded-b-[6px]" style={{ background: "linear-gradient(180deg,#3a2915,#1c1108)", boxShadow: "0 10px 16px -6px rgba(0,0,0,.7)" }} aria-hidden />
      <div className="flex justify-between px-6" aria-hidden>
        {[0, 1].map((i) => <div key={i} className="w-8 h-[9px] rounded-b-[4px]" style={{ background: "linear-gradient(180deg,#2a1c0f,#120b06)" }} />)}
      </div>
    </div>
  );
};
