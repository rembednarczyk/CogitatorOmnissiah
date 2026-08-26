/**
 * Central ritual color theme.
 *
 * Every ritual (sync) carries its color in `SyncState.color`; progress bars,
 * summary cards and step dots inherit it to reinforce the ritual's identity
 * (see COGITATOR_GUIDELINES §2 "Dynamic UI"). Previously these same Tailwind
 * class maps were duplicated across several components — here they live in one place.
 *
 * NOTE: classes must be full literals (`text-cyan-400`, not `text-${c}-400`),
 * otherwise Tailwind's JIT scanner won't detect them and they won't reach the build.
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
  /** Accent text, e.g. headings (text-*-400). */
  text: string;
  /** Card border (border-*-500/20). */
  border: string;
  /** Soft panel/card background (bg-*-500/10). */
  bgSoft: string;
  /** Solid background, e.g. progress bar fill (bg-*-500). */
  bgSolid: string;
  /** Progress bar glow (shadow-[…0.4]). */
  glow: string;
  /** Step dot on the ritual timeline (bg-*-500 + smaller glow). */
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

/** Full ritual theme with a safe fallback to cyan. */
export const getRitualTheme = (color?: string | null): RitualTheme =>
  ritualTheme[(color as RitualColor)] ?? ritualTheme.cyan;

/**
 * Ritual-button classes (the „liturgii synchronizacji" style: dark slate-950 base,
 * colored border/glow accent on hover, icon in a box). Full literals — see the note
 * about Tailwind's JIT scanner at the top of the file. Used by the `RitualButton` component.
 */
export interface RitualButtonTheme {
  hoverBorder: string;
  hoverShadow: string;
  iconBg: string;
  iconText: string;
  hoverText: string;
}

export const ritualButtonTheme: Record<RitualColor, RitualButtonTheme> = {
  cyan:    { hoverBorder: "hover:border-cyan-500/50",    hoverShadow: "hover:shadow-cyan-500/10",    iconBg: "bg-cyan-500/10",    iconText: "text-cyan-400",    hoverText: "group-hover:text-cyan-400" },
  rose:    { hoverBorder: "hover:border-rose-500/50",    hoverShadow: "hover:shadow-rose-500/10",    iconBg: "bg-rose-500/10",    iconText: "text-rose-400",    hoverText: "group-hover:text-rose-400" },
  indigo:  { hoverBorder: "hover:border-indigo-500/50",  hoverShadow: "hover:shadow-indigo-500/10",  iconBg: "bg-indigo-500/10",  iconText: "text-indigo-400",  hoverText: "group-hover:text-indigo-400" },
  blue:    { hoverBorder: "hover:border-blue-500/50",    hoverShadow: "hover:shadow-blue-500/10",    iconBg: "bg-blue-500/10",    iconText: "text-blue-400",    hoverText: "group-hover:text-blue-400" },
  purple:  { hoverBorder: "hover:border-purple-500/50",  hoverShadow: "hover:shadow-purple-500/10",  iconBg: "bg-purple-500/10",  iconText: "text-purple-400",  hoverText: "group-hover:text-purple-400" },
  orange:  { hoverBorder: "hover:border-orange-500/50",  hoverShadow: "hover:shadow-orange-500/10",  iconBg: "bg-orange-500/10",  iconText: "text-orange-400",  hoverText: "group-hover:text-orange-400" },
  amber:   { hoverBorder: "hover:border-amber-500/50",   hoverShadow: "hover:shadow-amber-500/10",   iconBg: "bg-amber-500/10",   iconText: "text-amber-400",   hoverText: "group-hover:text-amber-400" },
  emerald: { hoverBorder: "hover:border-emerald-500/50", hoverShadow: "hover:shadow-emerald-500/10", iconBg: "bg-emerald-500/10", iconText: "text-emerald-400", hoverText: "group-hover:text-emerald-400" },
};

export const getRitualButtonTheme = (color?: string | null): RitualButtonTheme =>
  ritualButtonTheme[(color as RitualColor)] ?? ritualButtonTheme.cyan;

/** Just the step dot (with a fallback to cyan). */
export const getRitualDot = (color?: string | null): string => getRitualTheme(color).dot;

/**
 * Gradient progress bars (ProgressBar / AuthorProgressItem). Separate map because
 * the gradient's target color differs from the ritual name (cyan→blue, purple→indigo,
 * orange→red, emerald→teal). Fallback: emerald (matching prior behavior).
 */
export interface RitualGradient {
  gradient: string;
  shadow: string;
}

export const ritualGradient: Record<RitualColor, RitualGradient> = {
  cyan:    { gradient: "from-cyan-500 to-blue-600",      shadow: "shadow-cyan-500/20" },
  purple:  { gradient: "from-purple-500 to-indigo-600",  shadow: "shadow-purple-500/20" },
  orange:  { gradient: "from-orange-500 to-red-600",     shadow: "shadow-orange-500/20" },
  emerald: { gradient: "from-emerald-500 to-teal-600",   shadow: "shadow-emerald-500/20" },
  rose:    { gradient: "from-rose-500 to-pink-600",      shadow: "shadow-rose-500/20" },
  indigo:  { gradient: "from-indigo-500 to-purple-600",  shadow: "shadow-indigo-500/20" },
  blue:    { gradient: "from-blue-500 to-indigo-600",    shadow: "shadow-blue-500/20" },
  amber:   { gradient: "from-amber-500 to-orange-600",   shadow: "shadow-amber-500/20" },
};

export const getRitualGradient = (color?: string | null): RitualGradient =>
  ritualGradient[color as RitualColor] ?? ritualGradient.emerald;
