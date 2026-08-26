import React, { useState } from "react";
import { Layers } from "lucide-react";
import { CyclePanel } from "./search/CyclePanel";
import { AnchorRect } from "../utils/popoverPosition";

interface Props {
  title: string;
  author: string;
  /** Renders the tile only for books belonging to a cycle. */
  partOfCycle?: boolean;
  /** Cycle name (column „Cykl", from harvest) — only in the tooltip (hover), not on the chip. */
  cykl?: string;
  /** Volume number in the cycle (column „CyklNr", from harvest) — shown as „Cykl · N". */
  cyklNr?: number;
  /** Size: „sm" (tiles), „xs" (tight bundle rows). */
  size?: "sm" | "xs";
}

/**
 * Interactive cycle tile: click → `CyclePanel` with the volume list (reading order +
 * status in the DB), anchored at the click point. Reuses the existing cycle preview
 * (`useCycle` + `GET /api/cycle`) from Skryptorium — the only required input is (title,
 * author). Renders only for `partOfCycle`. Label: „Cykl · N" when the volume number
 * was determined by harvest; otherwise just „cykl". The full cycle name lives in the tooltip (hover).
 */
export const CycleTile: React.FC<Props> = ({ title, author, partOfCycle, cykl, cyklNr, size = "sm" }) => {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  if (!partOfCycle) return null;

  const name = (cykl || "").trim();
  const label = cyklNr != null ? `Cykl · ${cyklNr}` : "cykl";
  const sm = size === "sm";

  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width });
  };

  return (
    <>
      {anchor && <CyclePanel title={title} author={author || ""} anchor={anchor} onClose={() => setAnchor(null)} />}
      <button
        type="button"
        onClick={open}
        className={`shrink-0 inline-flex items-center rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400/50 font-bold uppercase tracking-wider transition-all cursor-pointer ${sm ? "gap-0.5 px-1.5 py-0.5 text-[9px]" : "gap-0.5 px-1 py-0.5 text-[8px]"}`}
        title={`Pokaż tomy cyklu${name ? ` „${name}"` : ""} — sprawdź kolejność czytania`}
      >
        <Layers className={sm ? "w-2.5 h-2.5 shrink-0" : "w-2 h-2 shrink-0"} />
        <span className="whitespace-nowrap">{label}</span>
      </button>
    </>
  );
};
