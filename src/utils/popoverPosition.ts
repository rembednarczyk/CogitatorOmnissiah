/**
 * Pozycjonowanie popovera „w miejscu kliknięcia" (podgląd cyklu). Zakotwiczony pod
 * (lub nad) triggerem, przycięty do viewportu. Stronę (nad/pod) wybiera wg tego, gdzie
 * jest więcej miejsca, a `maxHeight` = dostępna przestrzeń — treść krótsza kurczy się
 * do liczby pozycji, dłuższa scrolluje wewnątrz (nic nie ucieka poza ekran / nie jest
 * ucinane). Czysta funkcja (bez DOM) — łatwa do przetestowania.
 */

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface PopoverPosition {
  left: number;
  width: number;
  placement: "below" | "above";
  /** px od GÓRY viewportu — ustawione, gdy placement === "below". */
  top?: number;
  /** px od DOŁU viewportu — ustawione, gdy placement === "above". */
  bottom?: number;
  /** Górny limit wysokości; dłuższa lista scrolluje w środku. */
  maxHeight: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function computePopoverPosition(
  anchor: AnchorRect,
  vp: Viewport,
  opts?: { width?: number; gap?: number; margin?: number; minHeight?: number },
): PopoverPosition {
  const margin = opts?.margin ?? 8;
  const gap = opts?.gap ?? 6;
  const minHeight = opts?.minHeight ?? 140;
  const width = Math.min(opts?.width ?? 380, vp.width - margin * 2);
  const left = clamp(anchor.left, margin, Math.max(margin, vp.width - width - margin));

  const spaceBelow = vp.height - anchor.bottom - gap - margin;
  const spaceAbove = anchor.top - gap - margin;

  if (spaceBelow >= spaceAbove) {
    return { left, width, placement: "below", top: anchor.bottom + gap, maxHeight: Math.max(minHeight, spaceBelow) };
  }
  return { left, width, placement: "above", bottom: vp.height - anchor.top + gap, maxHeight: Math.max(minHeight, spaceAbove) };
}
