/**
 * Centralny motyw kolorów rytuałów.
 *
 * Każdy rytuał (synchronizacja) niesie swój kolor w `SyncState.color`; paski
 * postępu, karty podsumowań i kropki kroków dziedziczą go, by wzmacniać tożsamość
 * rytuału (zob. COGITATOR_GUIDELINES §2 "Dynamic UI"). Wcześniej te same mapy
 * klas Tailwinda były duplikowane w kilku komponentach — tutaj są w jednym miejscu.
 *
 * UWAGA: klasy muszą być pełnymi literałami (`text-cyan-400`, nie `text-${c}-400`),
 * inaczej skaner JIT Tailwinda ich nie wykryje i nie trafią do builda.
 */

export type RitualColor =
  | "cyan"
  | "rose"
  | "indigo"
  | "blue"
  | "purple"
  | "orange"
  | "amber"
  | "emerald";

export interface RitualTheme {
  /** Tekst akcentu, np. nagłówki (text-*-400). */
  text: string;
  /** Obramowanie kart (border-*-500/20). */
  border: string;
  /** Miękkie tło panelu/karty (bg-*-500/10). */
  bgSoft: string;
  /** Pełne tło, np. wypełnienie paska postępu (bg-*-500). */
  bgSolid: string;
  /** Poświata paska postępu (shadow-[…0.4]). */
  glow: string;
  /** Kropka kroku na osi rytuałów (bg-*-500 + mniejsza poświata). */
  dot: string;
}

export const ritualTheme: Record<RitualColor, RitualTheme> = {
  cyan:    { text: "text-cyan-400",    border: "border-cyan-500/20",    bgSoft: "bg-cyan-500/10",    bgSolid: "bg-cyan-500",    glow: "shadow-[0_0_15px_rgba(34,211,238,0.4)]",  dot: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" },
  rose:    { text: "text-rose-400",    border: "border-rose-500/20",    bgSoft: "bg-rose-500/10",    bgSolid: "bg-rose-500",    glow: "shadow-[0_0_15px_rgba(244,63,94,0.4)]",   dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" },
  indigo:  { text: "text-indigo-400",  border: "border-indigo-500/20",  bgSoft: "bg-indigo-500/10",  bgSolid: "bg-indigo-500",  glow: "shadow-[0_0_15px_rgba(99,102,241,0.4)]",  dot: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" },
  blue:    { text: "text-blue-400",    border: "border-blue-500/20",    bgSoft: "bg-blue-500/10",    bgSolid: "bg-blue-500",    glow: "shadow-[0_0_15px_rgba(59,130,246,0.4)]",  dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" },
  purple:  { text: "text-purple-400",  border: "border-purple-500/20",  bgSoft: "bg-purple-500/10",  bgSolid: "bg-purple-500",  glow: "shadow-[0_0_15px_rgba(168,85,247,0.4)]",  dot: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" },
  orange:  { text: "text-orange-400",  border: "border-orange-500/20",  bgSoft: "bg-orange-500/10",  bgSolid: "bg-orange-500",  glow: "shadow-[0_0_15px_rgba(249,115,22,0.4)]",  dot: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" },
  amber:   { text: "text-amber-400",   border: "border-amber-500/20",   bgSoft: "bg-amber-500/10",   bgSolid: "bg-amber-500",   glow: "shadow-[0_0_15px_rgba(245,158,11,0.4)]",  dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" },
  emerald: { text: "text-emerald-400", border: "border-emerald-500/20", bgSoft: "bg-emerald-500/10", bgSolid: "bg-emerald-500", glow: "shadow-[0_0_15px_rgba(16,185,129,0.4)]",  dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" },
};

/** Pełny motyw rytuału z bezpiecznym fallbackiem do cyan. */
export const getRitualTheme = (color?: string | null): RitualTheme =>
  ritualTheme[(color as RitualColor)] ?? ritualTheme.cyan;

/** Sama kropka kroku (z fallbackiem do cyan). */
export const getRitualDot = (color?: string | null): string => getRitualTheme(color).dot;

/**
 * Gradientowe paski postępu (ProgressBar / AuthorProgressItem). Osobna mapa, bo
 * gradient ma inny kolor docelowy niż nazwa rytuału (cyan→blue, purple→indigo,
 * orange→red, emerald→teal). Fallback: emerald (zgodnie z poprzednim zachowaniem).
 */
export interface RitualGradient {
  gradient: string;
  shadow: string;
}

export const ritualGradient: Record<string, RitualGradient> = {
  cyan:    { gradient: "from-cyan-500 to-blue-600",     shadow: "shadow-cyan-500/20" },
  purple:  { gradient: "from-purple-500 to-indigo-600", shadow: "shadow-purple-500/20" },
  orange:  { gradient: "from-orange-500 to-red-600",    shadow: "shadow-orange-500/20" },
  emerald: { gradient: "from-emerald-500 to-teal-600",  shadow: "shadow-emerald-500/20" },
};

export const getRitualGradient = (color?: string | null): RitualGradient =>
  ritualGradient[color as string] ?? ritualGradient.emerald;
