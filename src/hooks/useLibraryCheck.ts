import { useState, useCallback, useRef } from "react";

export interface IdentifiedBooks {
  [libraryId: string]: { title: string; author: string; year?: number | null }[];
}

export function useLibraryCheck() {
  const [identifiedBooks, setIdentifiedBooks] = useState<IdentifiedBooks>({});
  const [checkingLibrary, setCheckingLibrary] = useState<string | null>(null);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number; message: string; startTime: number | null } | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  // Ref zamiast stanu w strażniku — stan w domknięciu bywa nieaktualny
  // (dwa kliknięcia w tym samym ticku uruchamiały dwa równoległe skany)
  const isCheckingRef = useRef(false);

  const checkLibrary = useCallback(async (libraryId: string, libraryCode: string) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setCheckingLibrary(libraryId);
    setIdentifiedBooks(prev => ({ ...prev, [libraryId]: [] }));
    setCheckProgress({ current: 0, total: 0, message: "Inicjowanie...", startTime: Date.now() });
    setLibraryError(null);
    
    return new Promise<void>(async (resolve, reject) => {
      try {
        const response = await fetch("/api/library-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ libraryCode })
        });

        if (!response.ok) throw new Error("Błąd podczas sprawdzania biblioteki");

        const reader = response.body?.getReader();
        if (!reader) {
          resolve();
          return;
        }

        // Buforuj między chunkami (wzorzec z useSync) — zdarzenie SSE może być
        // rozcięte między dwa odczyty TCP i JSON.parse na fragmencie wywala skan
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              let data: any;
              try {
                data = JSON.parse(line.substring(6));
              } catch (e) {
                console.error("Błąd parsowania SSE:", e);
                continue;
              }
              if (data.type === "progress") {
                setCheckProgress(prev => ({ 
                  current: data.current, 
                  total: data.total, 
                  message: data.message,
                  startTime: prev?.startTime || Date.now()
                }));
              } else if (data.type === "status") {
                setCheckProgress(prev => ({ 
                  current: prev?.current || 0, 
                  total: prev?.total || 0, 
                  message: data.message,
                  startTime: prev?.startTime || Date.now()
                }));
              } else if (data.type === "match") {
                setIdentifiedBooks(prev => {
                  const currentLibraryBooks = prev[libraryId] || [];
                  // Check if already exists to avoid duplicates (though server shouldn't send them)
                  if (currentLibraryBooks.some(b => (b as any).id === data.result.id)) return prev;
                  return {
                    ...prev,
                    [libraryId]: [...currentLibraryBooks, data.result]
                  };
                });
              } else if (data.type === "complete") {
                setIdentifiedBooks(prev => ({
                  ...prev,
                  [libraryId]: data.result.results
                }));
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            }
          }
        }
        resolve();
      } catch (err: any) {
        setLibraryError(err.message);
        resolve(); // Resolve anyway so the next library can be checked
      } finally {
        isCheckingRef.current = false;
        setCheckingLibrary(null);
        setCheckProgress(null);
      }
    });
  }, []);

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
      // Need to await the completion of each check.
      // Since checkLibrary sets state and doesn't return a promise that resolves on completion,
      // we need to wrap the fetch logic or modify checkLibrary to return a promise.
      // For simplicity, we'll implement the sequential check here or modify checkLibrary.
      await checkLibrary(branch.id, branch.code);
      // Wait a moment between libraries
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
