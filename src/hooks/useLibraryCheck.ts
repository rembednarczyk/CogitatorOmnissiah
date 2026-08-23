import { useState, useCallback, useRef } from "react";
import { IdentifiedBooks } from "./useStats";
import { useSSEStream } from "./useSSEStream";

export type { IdentifiedBooks };

export function useLibraryCheck() {
  const [identifiedBooks, setIdentifiedBooks] = useState<IdentifiedBooks>({});
  const [checkingLibrary, setCheckingLibrary] = useState<string | null>(null);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number; message: string; startTime: number | null } | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  // Ref zamiast stanu w strażniku — stan w domknięciu bywa nieaktualny
  // (dwa kliknięcia w tym samym ticku uruchamiały dwa równoległe skany)
  const isCheckingRef = useRef(false);
  const { run } = useSSEStream("/api/library-check");

  const checkLibrary = useCallback(async (libraryId: string, libraryCode: string) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setCheckingLibrary(libraryId);
    setIdentifiedBooks(prev => ({ ...prev, [libraryId]: [] }));
    setCheckProgress({ current: 0, total: 0, message: "Inicjowanie...", startTime: Date.now() });
    setLibraryError(null);

    const result = await run({ libraryCode }, (data) => {
      if (data.type === "progress") {
        setCheckProgress(prev => ({
          current: data.current ?? 0,
          total: data.total ?? 0,
          message: data.message ?? "",
          startTime: prev?.startTime || Date.now()
        }));
      } else if (data.type === "status") {
        setCheckProgress(prev => ({
          current: prev?.current || 0,
          total: prev?.total || 0,
          message: data.message ?? "",
          startTime: prev?.startTime || Date.now()
        }));
      } else if (data.type === "match") {
        setIdentifiedBooks(prev => {
          const currentLibraryBooks = prev[libraryId] || [];
          if (currentLibraryBooks.some(b => b.id === data.result.id)) return prev;
          return { ...prev, [libraryId]: [...currentLibraryBooks, data.result] };
        });
      } else if (data.type === "complete") {
        setIdentifiedBooks(prev => ({ ...prev, [libraryId]: data.result.results }));
      } else if (data.type === "error") {
        throw new Error(data.error);
      }
    });

    // Błąd nie przerywa całości — `checkAllLibraries` leci dalej do kolejnej filii.
    if (!result.ok && result.error) setLibraryError(result.error);
    isCheckingRef.current = false;
    setCheckingLibrary(null);
    setCheckProgress(null);
  }, [run]);

  const stopLibraryCheck = useCallback(async () => {
    try {
      await fetch("/api/library-check/stop", { method: "POST" });
    } catch (err) {
      console.error("Error stopping library check:", err);
    }
  }, []);

  const checkAllLibraries = useCallback(async (branches: { id: string; code: string }[]) => {
    if (isCheckingRef.current) return;

    for (const branch of branches) {
      // checkLibrary jest teraz zwykłym async i rozwiązuje się po zakończeniu strumienia
      // (bez ręcznego opakowania w Promise) — czekamy na każdą filię po kolei.
      await checkLibrary(branch.id, branch.code);
      // Krótka przerwa między filiami.
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, [checkLibrary]);

  return { 
    identifiedBooks, 
    checkingLibrary, 
    checkProgress, 
    libraryError, 
    checkLibrary, 
    checkAllLibraries,
    stopLibraryCheck 
  };
}
