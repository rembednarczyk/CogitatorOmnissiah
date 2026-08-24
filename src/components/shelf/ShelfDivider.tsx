import React from "react";
import { SHELF_ROW_H } from "../../utils/bookshelf";
import { CogSigil } from "./ShelfOrnaments";

interface Props {
  label: string;      // np. „1950–1959" (w przyszłości litera alfabetu / nazwisko autora)
  width?: number;     // szerokość deseczki (footprint na półce)
  height?: number;    // wysokość toru rzędu (wyrównanie tabliczki u góry)
}

/** Wysokość widocznej deseczki — spójna z `DIVIDER_H` w `shelfLayout` (podpora fizyki). */
export const BOARD_H = 168;

/**
 * Generyczna **przekładka sekcji** w stylu noosferycznym: cienka **deseczka** z
 * mosiądzu ze świecącą żyłą danych (na dole toru) + pozioma **tabliczka-runa**
 * rocznika u góry półki, wyrównana do początku zakresu (wariant A: tylko przy
 * pierwszym pojawieniu dekady) z projekcyjną smużką światła w dół do deseczki.
 * Etykieta jest zwykłym stringiem — ten sam komponent obsłuży literę alfabetu /
 * nazwisko autora itp. Nieprzeciągalna.
 */
export const ShelfDivider: React.FC<Props> = ({ label, width = 10, height = SHELF_ROW_H }) => (
  <div className="relative select-none" style={{ width, height }} title={label} aria-hidden>
    {/* cienka deseczka rozgraniczająca (dół toru) */}
    <div
      className="absolute bottom-0 left-0 rounded-[2px_2px_1px_1px]"
      style={{
        width, height: BOARD_H,
        background: "var(--sk-board-bg)",
        boxShadow: "inset 1px 0 0 rgba(var(--noo-glow),.35), inset -1px 0 2px rgba(0,0,0,.6), 0 6px 10px -6px rgba(0,0,0,.6)",
      }}
    >
      {/* cog-finial na szczycie deseczki */}
      <CogSigil className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-[13px] h-[13px] drop-shadow-[0_0_3px_rgba(var(--noo-glow),.6)]" />
      {/* świecąca żyła danych */}
      <div
        className="noo-data absolute left-1/2 -translate-x-1/2 rounded-[2px]"
        style={{ top: 14, bottom: 8, width: 2, background: "linear-gradient(180deg, rgba(var(--noo-glow),.9), rgba(var(--noo-glow),.15))", boxShadow: "0 0 6px rgba(var(--noo-glow),.8)" }}
      />
    </div>

    {/* projekcyjna smużka światła z tabliczki w dół do deseczki */}
    <div
      className="noo-data absolute top-[22px]"
      style={{ left: 4, width: 2, height: 150, background: "linear-gradient(180deg, rgba(var(--noo-glow),.55), rgba(var(--noo-glow),0))", boxShadow: "0 0 6px rgba(var(--noo-glow),.5)" }}
    />

    {/* tabliczka-runa rocznika u góry, lewą krawędzią przy deseczce (rozwija się w prawo) */}
    <div
      className="absolute top-0 left-0 flex items-center gap-[6px] whitespace-nowrap font-mono rounded-[3px] px-[9px] pt-[3px] pb-[4px]"
      style={{
        color: "var(--sk-plate-text)", fontSize: 11, letterSpacing: "0.06em",
        background: "var(--sk-plate-bg)",
        boxShadow: "inset 0 0 0 1.5px var(--sk-plate-edge), inset 0 1px 0 rgba(var(--noo-glow),.30), 0 5px 9px -4px #000, 0 0 12px rgba(var(--noo-glow),.25)",
        textShadow: "0 0 6px rgba(var(--noo-glow),.45)",
      }}
    >
      <CogSigil className="w-[13px] h-[13px] shrink-0 drop-shadow-[0_0_3px_rgba(63,224,208,.6)]" />
      {label}
    </div>
  </div>
);
