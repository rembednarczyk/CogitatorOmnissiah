import React from "react";
import { SHELF_ROW_H } from "../../utils/bookshelf";

interface Props {
  label: string;      // np. „1950–1959" (w przyszłości litera alfabetu / nazwisko autora)
  width?: number;     // szerokość deseczki (footprint na półce)
  height?: number;    // wysokość toru rzędu (wyrównanie tabliczki u góry)
}

/** Wysokość widocznej deseczki — spójna z `DIVIDER_H` w `shelfLayout` (podpora fizyki). */
export const BOARD_H = 168;

/**
 * Generyczna **przekładka sekcji**: cienka **deseczka** stojąca między woluminami
 * (na dole toru) + pozioma **tabliczka** rocznika u góry półki, wyrównana do
 * początku zakresu (wariant A: tylko przy pierwszym pojawieniu dekady). Etykieta
 * jest zwykłym stringiem — ten sam komponent obsłuży literę alfabetu / nazwisko
 * autora itp. Nieprzeciągalna.
 */
export const ShelfDivider: React.FC<Props> = ({ label, width = 10, height = SHELF_ROW_H }) => (
  <div className="relative select-none" style={{ width, height }} title={label} aria-hidden>
    {/* cienka deseczka rozgraniczająca (dół toru) */}
    <div
      className="absolute bottom-0 left-0 rounded-[2px_2px_1px_1px]"
      style={{
        width, height: BOARD_H,
        background: "linear-gradient(90deg, #6b4a26 0, #3e2814 45%, #59391d 55%, #23150a 100%)",
        boxShadow: "inset 1px 0 0 rgba(255,225,170,.35), inset -1px 0 2px rgba(0,0,0,.5), 0 6px 10px -6px rgba(0,0,0,.6)",
      }}
    >
      {/* mosiężny ćwiek */}
      <span className="absolute top-3 left-1/2 -translate-x-1/2 w-[4px] h-[4px] rounded-full"
        style={{ background: "radial-gradient(circle at 40% 35%, #f7e0a0, #b8860b 68%, #6b4a08)" }} />
    </div>

    {/* tabliczka rocznika u góry, lewą krawędzią przy deseczce (rozwija się w prawo) */}
    <div
      className="absolute top-0 left-0 flex items-center gap-[6px] whitespace-nowrap font-display font-black rounded-[5px] px-[10px] pt-[3px] pb-[4px]"
      style={{
        color: "#4a3418", fontSize: 11.5, letterSpacing: "0.04em",
        background: "linear-gradient(180deg, #ecdfbe 0%, #d5c193 55%, #b89c68 100%)",
        boxShadow: "inset 0 0 0 1.5px rgba(120,80,30,.45), inset 0 1px 0 rgba(255,255,255,.5), 0 6px 10px -5px rgba(0,0,0,.7)",
        textShadow: "0 1px 0 rgba(255,255,255,.35)",
      }}
    >
      <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: "radial-gradient(circle at 40% 35%, #f7e0a0, #9a6f12 70%, #5e4108)" }} />
      {label}
      <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: "radial-gradient(circle at 40% 35%, #f7e0a0, #9a6f12 70%, #5e4108)" }} />
    </div>
  </div>
);
