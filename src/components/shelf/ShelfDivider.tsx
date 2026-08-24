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
        background: "linear-gradient(90deg, #8a6b34, #4a3315 45%, #6b4e22 55%, #2a1c0a)",
        boxShadow: "inset 1px 0 0 rgba(255,230,170,.40), inset -1px 0 2px rgba(0,0,0,.6), 0 6px 10px -6px rgba(0,0,0,.6)",
      }}
    >
      {/* cog-finial na szczycie deseczki */}
      <CogSigil className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-[13px] h-[13px] drop-shadow-[0_0_3px_rgba(63,224,208,.6)]" />
      {/* świecąca żyła danych */}
      <div
        className="noo-data absolute left-1/2 -translate-x-1/2 rounded-[2px]"
        style={{ top: 14, bottom: 8, width: 2, background: "linear-gradient(180deg, rgba(63,224,208,.9), rgba(63,224,208,.15))", boxShadow: "0 0 6px rgba(63,224,208,.8)" }}
      />
    </div>

    {/* projekcyjna smużka światła z tabliczki w dół do deseczki */}
    <div
      className="noo-data absolute top-[22px]"
      style={{ left: 4, width: 2, height: 150, background: "linear-gradient(180deg, rgba(63,224,208,.55), rgba(63,224,208,0))", boxShadow: "0 0 6px rgba(63,224,208,.5)" }}
    />

    {/* tabliczka-runa rocznika u góry, lewą krawędzią przy deseczce (rozwija się w prawo) */}
    <div
      className="absolute top-0 left-0 flex items-center gap-[6px] whitespace-nowrap font-mono rounded-[3px] px-[9px] pt-[3px] pb-[4px]"
      style={{
        color: "#1c1206", fontSize: 11, letterSpacing: "0.06em",
        background: "linear-gradient(180deg, #d8b877 0%, #b8860b 58%, #8a6413 100%)",
        boxShadow: "inset 0 0 0 1.5px #5e4108, inset 0 1px 0 rgba(255,240,200,.6), 0 5px 9px -4px #000, 0 0 12px rgba(63,224,208,.25)",
        textShadow: "0 1px 0 rgba(255,240,200,.5)",
      }}
    >
      <CogSigil className="w-[13px] h-[13px] shrink-0 drop-shadow-[0_0_3px_rgba(63,224,208,.6)]" />
      {label}
    </div>
  </div>
);
