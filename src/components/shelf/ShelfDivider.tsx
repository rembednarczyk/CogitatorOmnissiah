import React from "react";
import { SHELF_ROW_H } from "../../utils/bookshelf";
import { DividerLevel, DividerDir } from "../../utils/shelfLayout";
import { CogSigil } from "./ShelfOrnaments";

interface Props {
  label: string;      // e.g. „1950–1959" (in the future an alphabet letter / author's surname)
  width?: number;     // divider board width (footprint on the shelf)
  height?: number;    // row track height (aligns the plate at the top)
  /** Plate level: „top" (default) or „bottom" when the top one would collide with a neighbor. */
  plate?: DividerLevel;
  /** Plate expansion direction: „right" (default) or „left" at the right edge of the shelf. */
  dir?: DividerDir;
  /** Render layer: „board" (board+sigils+vein) or „plate" (just the plate).
   *  `ShelfRow` paints all boards, and THEN all plates, on top — so
   *  the plate never hides under a neighbor's board. */
  part?: "board" | "plate";
}

/** Height of the visible board — consistent with `DIVIDER_H` in `shelfLayout` (physics support). */
export const BOARD_H = 168;

/**
 * A generic **section divider** in the noospheric style: a thin **board** with a data
 * vein and cog sigils at the top and bottom (`part="board"`) + a horizontal **rune-plate**
 * of the year (`part="plate"`). The layers are separated, because `ShelfRow` paints first
 * all boards, and then all plates on top (the plate is always on top).
 * The placement is computed by `assignDividerPlacement`: the plate defaults to top and right,
 * for a narrow decade → `plate="bottom"` (sits on the shelf edge so it doesn't cover
 * titles), and at the right edge of the shelf → `dir="left"`. The `shelf-divider` class lets
 * the skin repaint the divider (Holo+ = muted amber, in the tone of the Regał frame).
 * Not draggable.
 */
export const ShelfDivider: React.FC<Props> = ({ label, width = 10, height = SHELF_ROW_H, plate = "top", dir = "right", part = "board" }) => {
  const atBottom = plate === "bottom";
  const toLeft = dir === "left";
  return (
    <div className="shelf-divider relative select-none" style={{ width, height }} title={label} aria-hidden>
      {part === "board" ? (
        <>
          {/* thin separating board (bottom of the track) */}
          <div
            className="absolute bottom-0 left-0 rounded-[2px_2px_1px_1px]"
            style={{
              width, height: BOARD_H,
              background: "var(--sk-board-bg)",
              boxShadow: "inset 1px 0 0 rgba(var(--noo-glow),.35), inset -1px 0 2px rgba(0,0,0,.6), 0 6px 10px -6px rgba(0,0,0,.6)",
            }}
          >
            {/* cog-finial at the top of the board */}
            <CogSigil className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-[13px] h-[13px] drop-shadow-[0_0_3px_rgba(var(--noo-glow),.6)]" />
            {/* cog-finial at the bottom of the board (on the shelf line) */}
            <CogSigil className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-[13px] h-[13px] drop-shadow-[0_0_3px_rgba(var(--noo-glow),.6)]" />
            {/* glowing data vein */}
            <div
              className="noo-data absolute left-1/2 -translate-x-1/2 rounded-[2px]"
              style={{ top: 14, bottom: 8, width: 2, background: "linear-gradient(180deg, rgba(var(--noo-glow),.9), rgba(var(--noo-glow),.15))", boxShadow: "0 0 6px rgba(var(--noo-glow),.8)" }}
            />
          </div>

          {/* projected light streak connecting the plate to the board (direction depends on the level) */}
          <div
            className="noo-data absolute"
            style={{
              left: 4, width: 2, height: 150,
              boxShadow: "0 0 6px rgba(var(--noo-glow),.5)",
              ...(atBottom
                ? { bottom: 30, background: "linear-gradient(0deg, rgba(var(--noo-glow),.55), rgba(var(--noo-glow),0))" }
                : { top: 22, background: "linear-gradient(180deg, rgba(var(--noo-glow),.55), rgba(var(--noo-glow),0))" }),
            }}
          />
        </>
      ) : (
        /* year rune-plate, its edge next to the board; at the top by default, at the bottom
           (on the shelf line, overlapping the board) when the top one would collide with a neighbor;
           expands to the right, and to the left at the right edge of the shelf */
        <div
          className="absolute flex items-center gap-[6px] whitespace-nowrap font-mono rounded-[3px] px-[9px] pt-[3px] pb-[4px]"
          style={{
            ...(atBottom ? { bottom: -12 } : { top: 0 }),
            ...(toLeft ? { right: 0 } : { left: 0 }),
            color: "var(--sk-plate-text)", fontSize: 11, letterSpacing: "0.06em",
            background: "var(--sk-plate-bg)",
            boxShadow: "inset 0 0 0 1.5px var(--sk-plate-edge), inset 0 1px 0 rgba(var(--noo-glow),.30), 0 5px 9px -4px #000, 0 0 12px rgba(var(--noo-glow),.25)",
            textShadow: "0 0 6px rgba(var(--noo-glow),.45)",
          }}
        >
          <CogSigil className="w-[13px] h-[13px] shrink-0 drop-shadow-[0_0_3px_rgba(var(--noo-glow),.6)]" />
          {label}
        </div>
      )}
    </div>
  );
};
