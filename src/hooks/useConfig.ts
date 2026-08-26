import { useState, useEffect, useCallback } from "react";

export function useConfig() {
  const [configStatus, setConfigStatus] = useState({
    hasNotionKey: false,
    hasDatabaseId: false,
    loading: true,
  });

  const [schema, setSchema] = useState<any>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const healthRes = await fetch("/api/health");
      if (!healthRes.ok) throw new Error(`Błąd serwera: ${healthRes.status}`);
      const health = await healthRes.json();

      const configRes = await fetch("/api/config");
      if (!configRes.ok) throw new Error(`Błąd serwera: ${configRes.status}`);
      const configData = await configRes.json();

      setConfigStatus({ ...configData, isSyncing: health.isSyncing, loading: false });
    } catch (err) {
      console.error("Config fetch error:", err);
      // Don't leave the status card stuck forever in "Inicjalizacji Duchów Maszyny"
      setConfigStatus(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const fetchSchema = useCallback(async () => {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const res = await fetch("/api/notion/schema");
      const text = await res.text();
      
      if (!text) {
        throw new Error(`Pusta odpowiedź z serwera (Status: ${res.status})`);
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Otrzymano nieprawidłową odpowiedź z serwera (Status: ${res.status}). Spróbuj odświeżyć stronę.`);
      }

      if (res.ok) {
        setSchema(data);
      } else {
        setSchemaError(data.error || "Wystąpił błąd API");
      }
    } catch (err: any) {
      setSchemaError(err.message);
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (configStatus.hasNotionKey && configStatus.hasDatabaseId) {
      fetchSchema();
    }
  }, [configStatus.hasNotionKey, configStatus.hasDatabaseId, fetchSchema]);

  return { configStatus, schema, schemaLoading, schemaError, fetchSchema, fetchConfig };
}
