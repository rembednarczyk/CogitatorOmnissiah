import { useState, useCallback } from "react";

/**
 * Mutacje opcji schematu Notion (dodanie/usunięcie w kolumnie select/multi_select).
 * Trzyma stan operacji (`updatingProperty`, `error`, wpisywane nazwy) i wspólny
 * `PATCH /api/notion/schema` — add/delete to cienkie przypadki na jednym zapisie.
 */
export function useSchemaMutations(schema: any, onSchemaUpdated: () => void) {
  const [updatingProperty, setUpdatingProperty] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newOptionNames, setNewOptionNames] = useState<Record<string, string>>({});

  const patchOptions = async (propertyName: string, propertyType: string, newOptions: { name: string }[]) => {
    const res = await fetch("/api/notion/schema", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyName, propertyType, newOptions }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Błąd aktualizacji schematu");
    }
    onSchemaUpdated();
  };

  const addOption = useCallback(async (propertyName: string, propertyType: string) => {
    const newOptionName = newOptionNames[propertyName]?.trim();
    if (!newOptionName) return;

    setError(null);
    setUpdatingProperty(propertyName);
    try {
      const existing = schema[propertyName][propertyType]?.options || [];
      if (existing.some((opt: any) => opt.name.toLowerCase() === newOptionName.toLowerCase())) {
        throw new Error("Taka opcja już istnieje.");
      }
      await patchOptions(propertyName, propertyType, [...existing, { name: newOptionName }]);
      setNewOptionNames(prev => ({ ...prev, [propertyName]: "" }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingProperty(null);
    }
  }, [schema, newOptionNames, onSchemaUpdated]);

  const deleteOption = useCallback(async (propertyName: string, propertyType: string, optionName: string) => {
    setError(null);
    setUpdatingProperty(propertyName);
    try {
      const existing = schema[propertyName][propertyType]?.options || [];
      await patchOptions(propertyName, propertyType, existing.filter((opt: any) => opt.name !== optionName));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingProperty(null);
    }
  }, [schema, onSchemaUpdated]);

  return { updatingProperty, error, setError, newOptionNames, setNewOptionNames, addOption, deleteOption };
}
