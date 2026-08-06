import { useState, useCallback, useRef } from "react";

export interface WikiDiagnostic {
  award: string;
  pageTitle: string;
  ok: boolean;
  booksParsed?: number;
  classification?: string;
  status?: number;
  hint?: string;
  error?: string;
  note?: string;
  ms?: number;
}

export interface DiagnosticsReport {
  env: { hasNotionKey: boolean; hasDatabaseId: boolean; hasGeminiKey: boolean; nodeEnv: string };
  notion: { ok: boolean; propertyCount?: number; error?: string };
  wiki: WikiDiagnostic[];
  summary: string;
  ms?: number;
}

export function useDiagnostics() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const runDiagnostics = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/diagnostics");
      if (!res.ok) throw new Error(`Serwer zwrócił status ${res.status}`);
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err?.message || "Diagnostyka nie powiodła się.");
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, []);

  return { report, loading, error, runDiagnostics };
}
