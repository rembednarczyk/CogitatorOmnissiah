import { useState, useCallback, useRef } from "react";

export interface VintedResult {
  id: string;
  title: string;
  author: string;
  searchUrl?: string;
  vintedItems: {
    id?: string;
    title: string;
    price: string | number;
    currency: string;
    url: string;
  }[];
}

export interface VintedSearchAttempt {
  id: string;
  title: string;
  author: string;
  url: string;
  status: "pending" | "success" | "no_results" | "blocked" | "error";
  itemCount: number;
}

export function useVintedCheck() {
  const [vintedResults, setVintedResults] = useState<VintedResult[]>([]);
  const [searchAttempts, setSearchAttempts] = useState<VintedSearchAttempt[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number; message: string; startTime: number | null } | null>(null);
  const [vintedError, setVintedError] = useState<string | null>(null);
  // Ref zamiast stanu w strażniku — stan w domknięciu bywa nieaktualny
  const isCheckingRef = useRef(false);

  const runVintedCheck = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);
    setVintedResults([]);
    setSearchAttempts([]);
    setCheckProgress({ current: 0, total: 0, message: "Inicjowanie...", startTime: Date.now() });
    setVintedError(null);
    
    try {
      const response = await fetch("/api/vinted-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Błąd serwera: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setIsChecking(false);
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
              setVintedResults(prev => {
                if (prev.some(r => r.id === data.result.id)) return prev;
                return [...prev, data.result];
              });
            } else if (data.type === "search_attempt") {
              setSearchAttempts(prev => {
                const existing = prev.findIndex(a => a.id === data.result.id);
                if (existing !== -1) {
                  const next = [...prev];
                  next[existing] = data.result;
                  return next;
                }
                return [...prev, data.result];
              });
            } else if (data.type === "complete") {
              setVintedResults(data.result.results);
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          }
        }
      }
    } catch (err: any) {
      setVintedError(err.message);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
      setCheckProgress(null);
    }
  }, []);

  const stopVintedCheck = useCallback(async () => {
    try {
      await fetch("/api/vinted-check/stop", { method: "POST" });
    } catch (err) {
      console.error("Error stopping Vinted check:", err);
    }
  }, []);

  return { 
    vintedResults, 
    searchAttempts,
    isChecking, 
    checkProgress, 
    vintedError, 
    runVintedCheck, 
    stopVintedCheck 
  };
}
