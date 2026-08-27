import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ScanBarcode, Loader2, AlertCircle, Keyboard } from "lucide-react";
import { looksLikeBookIsbn } from "../../utils/barcode";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the raw scanned/typed code once a book-looking EAN-13 is captured. */
  onDetect: (code: string) => void;
}

// The native BarcodeDetector API isn't in the TS DOM lib yet — minimal local shape.
interface DetectedBarcode { rawValue: string; format: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/**
 * Mobile barcode scanner for Skryptorium. Streams the rear camera into a <video>
 * and polls the native BarcodeDetector for an EAN-13 (= book ISBN-13). On a hit it
 * hands the code up (parent decides: direct row match, ISBN resolve, or „not found").
 * A manual ISBN field is always available as a fallback (bad light, denied camera,
 * or a browser without the API).
 */
export const ScanModal: React.FC<Props> = ({ open, onClose, onDetect }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manual, setManual] = useState("");
  const [manualErr, setManualErr] = useState("");

  // Stop the camera + detection loop and release the stream.
  const teardown = () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  };

  const finish = (code: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    teardown();
    onDetect(code);
  };

  useEffect(() => {
    if (!open) return;
    doneRef.current = false;
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

    // No native detector → the modal still opens for the manual ISBN fallback.
    if (!Ctor) { setStatus("error"); setErrorMsg("Ta przeglądarka nie wspiera skanera — wpisz ISBN ręcznie."); return; }

    let cancelled = false;
    setStatus("starting");
    const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a"] });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");

        const tick = async () => {
          if (doneRef.current || cancelled) return;
          try {
            const codes = await detector.detect(video);
            const hit = codes.map((c) => c.rawValue).find((v) => looksLikeBookIsbn(v));
            if (hit) { finish(hit); return; }
          } catch {
            // A transient detect() failure (frame not ready) — keep polling.
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        // getUserMedia OR video.play() can reject (denied permission, blocked autoplay) —
        // release any stream we already acquired so the camera light doesn't stay on.
        teardown();
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(
          e?.name === "NotAllowedError"
            ? "Brak dostępu do kamery — zezwól w przeglądarce lub wpisz ISBN ręcznie."
            : "Nie udało się uruchomić kamery — wpisz ISBN ręcznie."
        );
      }
    })();

    return () => { cancelled = true; teardown(); };
  }, [open]);

  const handleClose = () => { teardown(); onClose(); };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = manual.replace(/[^0-9Xx]/g, "");
    // A real ISBN is 10 or 13 chars — reject junk instead of closing with no feedback.
    if (digits.length !== 10 && digits.length !== 13) {
      setManualErr("Wpisz pełny ISBN — 10 lub 13 cyfr.");
      return;
    }
    setManualErr("");
    finish(manual.trim());
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-cyan-500/10 rounded-full border border-cyan-500/20">
                  <ScanBarcode className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-100 uppercase tracking-wider">Skan Sygnatury</h3>
                  <p className="text-xs text-slate-500 font-medium">Nakieruj kamerę na kod kreskowy książki</p>
                </div>
              </div>

              {/* Camera viewport */}
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/10 mb-5">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                {(status === "starting" || status === "idle") && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest">Uruchamianie kamery…</span>
                  </div>
                )}
                {status === "scanning" && (
                  <>
                    <div className="absolute inset-x-8 top-1/2 h-px bg-cyan-400/70 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                    <div className="absolute inset-6 border-2 border-cyan-400/30 rounded-lg" />
                  </>
                )}
                {status === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 text-red-300">
                    <AlertCircle className="w-7 h-7" />
                    <span className="text-xs font-medium leading-relaxed">{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* Manual fallback */}
              <form onSubmit={submitManual} className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-500 uppercase tracking-widest font-bold">
                  <Keyboard className="w-3.5 h-3.5" /> Lub wpisz ISBN ręcznie
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manual}
                    onChange={(e) => { setManual(e.target.value); if (manualErr) setManualErr(""); }}
                    placeholder="978…"
                    aria-label="Wpisz ISBN ręcznie"
                    className="flex-1 px-4 py-2.5 text-sm bg-slate-950/60 border border-white/10 text-slate-200 rounded-xl focus:outline-none focus:border-cyan-500/50 placeholder-slate-600"
                  />
                  <button
                    type="submit"
                    disabled={!manual.trim()}
                    className="px-5 py-2.5 text-sm font-bold bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all active:scale-95"
                  >
                    Szukaj
                  </button>
                </div>
                {manualErr && <p className="text-[11px] text-red-400 font-medium">{manualErr}</p>}
              </form>
            </div>

            <button onClick={handleClose} className="absolute top-4 right-4 p-1 text-slate-500 hover:text-slate-200 transition-colors" aria-label="Zamknij skaner">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
