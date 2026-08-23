import React, { useState } from 'react';
import { X, AlertCircle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";
import { useSchemaMutations } from "../hooks/useSchemaMutations";
import { ConfirmDialog } from "./ConfirmDialog";
import { SchemaColumnCard } from "./SchemaColumnCard";

interface SchemaEditorProps {
  schema: any;
  onSchemaUpdated: () => void;
}

const NOTION_OPTION_LIMIT = 100;

export function SchemaEditor({ schema, onSchemaUpdated }: SchemaEditorProps) {
  const { updatingProperty, error, setError, newOptionNames, setNewOptionNames, addOption, deleteOption } = useSchemaMutations(schema, onSchemaUpdated);
  const [confirmDelete, setConfirmDelete] = useState<{ propertyName: string; propertyType: string; optionName: string } | null>(null);

  const columns = Object.entries(schema).filter(([key]) => key !== "_empty").sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="mt-4 space-y-6">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-rose-950/30 text-rose-400 rounded-lg text-xs border border-rose-900/50 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Potwierdź usunięcie"
        body={<>Czy na pewno chcesz usunąć opcję <span className="text-cyan-400 font-bold underline decoration-cyan-400/30 underline-offset-4">"{confirmDelete?.optionName}"</span> z bazy danych?</>}
        confirmLabel="Usuń na zawsze"
        onConfirm={() => {
          const c = confirmDelete;
          setConfirmDelete(null);
          if (c) deleteOption(c.propertyName, c.propertyType, c.optionName);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <h3 className="text-sm font-display font-bold mb-6 text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
        <div className="w-8 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent" />
        <Settings className="w-4 h-4 text-cyan-400/80" />
        Konfiguracja Systemowa Kolumn
      </h3>
      <div className="space-y-5">
        {schema._empty && (
          <p className="text-xs text-slate-500 font-mono">{(schema._empty as any).type}</p>
        )}
        {columns.map(([key, value]: [string, any], index) => {
          const isSelectType = value.type === 'multi_select' || value.type === 'select';
          const options = isSelectType ? [...(value[value.type]?.options || [])].sort((a, b) => a.name.localeCompare(b.name)) : [];
          const isOverLimit = options.length >= NOTION_OPTION_LIMIT;

          return (
            <SchemaColumnCard
              key={key}
              name={key}
              value={value}
              isSelectType={isSelectType}
              options={options}
              isOverLimit={isOverLimit}
              limit={NOTION_OPTION_LIMIT}
              index={index}
              updating={updatingProperty === key}
              newOptionValue={newOptionNames[key] || ""}
              onNewOptionChange={(v) => setNewOptionNames(prev => ({ ...prev, [key]: v }))}
              onAdd={() => addOption(key, value.type)}
              onDeleteRequest={(optionName) => setConfirmDelete({ propertyName: key, propertyType: value.type, optionName })}
            />
          );
        })}
      </div>
    </div>
  );
}
