import React, { useState } from "react";
import { Layers } from "lucide-react";
import { CyclePanel } from "./search/CyclePanel";
import { AnchorRect } from "../utils/popoverPosition";

interface Props {
  title: string;
  author: string;
  /** Renderuje kafelek tylko dla książek należących do cyklu. */
  partOfCycle?: boolean;
  /** Nazwa cyklu (kolumna „Cykl", z żniw) — tylko w tooltipie (hover), nie na chipie. */
  cykl?: string;
  /** Numer tomu w cyklu (kolumna „CyklNr", z żniw) — pokazywany jako „Cykl · N". */
  cyklNr?: number;
  /** Rozmiar: „sm" (kafelki), „xs" (ciasne wiersze paczek). */
  size?: "sm" | "xs";
}

/**
 * Interaktywny kafelek cyklu: klik → `CyclePanel` z listą tomów (kolejność czytania +
 * status w bazie), zakotwiczony w miejscu kliknięcia. Reużywa istniejący podgląd cyklu
 * (`useCycle` + `GET /api/cycle`) ze Skryptorium — jedyny wymagany wkład to (title,
 * author). Renderuje się tylko dla `partOfCycle`. Etykieta: „Cykl · N", gdy numer tomu
 * ustalono żniwami; inaczej samo „cykl". Pełna nazwa cyklu żyje w tooltipie (hover).
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
