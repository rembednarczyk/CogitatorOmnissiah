import React, { useState } from "react";
import { Layers } from "lucide-react";
import { CyclePanel } from "./search/CyclePanel";

interface Props {
  title: string;
  author: string;
  /** Renderuje kafelek tylko dla książek należących do cyklu. */
  partOfCycle?: boolean;
  /** Nazwa cyklu (kolumna „Cykl", z żniw) — w etykiecie, gdy dostępna. */
  cykl?: string;
  /** Numer tomu w cyklu (kolumna „CyklNr", z żniw) — jako „· t.N". */
  cyklNr?: number;
  /** Rozmiar: „sm" (kafelki), „xs" (ciasne wiersze paczek). */
  size?: "sm" | "xs";
}

/**
 * Interaktywny kafelek cyklu: klik → `CyclePanel` z listą tomów (kolejność czytania +
 * status w bazie). Reużywa istniejący podgląd cyklu (`useCycle` + `GET /api/cycle`) ze
 * Skryptorium — jedyny wymagany wkład to (title, author). Renderuje się tylko dla
 * `partOfCycle`. Etykieta pokazuje nazwę cyklu i numer tomu, gdy ustalone żniwami;
 * inaczej samo „cykl".
 */
export const CycleTile: React.FC<Props> = ({ title, author, partOfCycle, cykl, cyklNr, size = "sm" }) => {
  const [open, setOpen] = useState(false);
  if (!partOfCycle) return null;

  const name = (cykl || "").trim();
  const label = name || "cykl";
  const sm = size === "sm";

  return (
    <>
      {open && <CyclePanel title={title} author={author || ""} onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={`shrink-0 min-w-0 max-w-[11rem] inline-flex items-center rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400/50 font-bold uppercase tracking-wider transition-all cursor-pointer ${sm ? "gap-0.5 px-1.5 py-0.5 text-[9px]" : "gap-0.5 px-1 py-0.5 text-[8px]"}`}
        title={`Pokaż tomy cyklu${name ? ` „${name}"` : ""} — sprawdź kolejność czytania`}
      >
        <Layers className={sm ? "w-2.5 h-2.5 shrink-0" : "w-2 h-2 shrink-0"} />
        <span className="truncate">{label}</span>
        {cyklNr != null && <span className="shrink-0 normal-case opacity-80">· t.{cyklNr}</span>}
      </button>
    </>
  );
};
