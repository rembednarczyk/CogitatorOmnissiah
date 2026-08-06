import React, { useState } from 'react';
import { Plus, Loader2, X, AlertCircle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";

interface SchemaEditorProps {
  schema: any;
  onSchemaUpdated: () => void;
}

export function SchemaEditor({ schema, onSchemaUpdated }: SchemaEditorProps) {
  const [updatingProperty, setUpdatingProperty] = useState<string | null>(null);
  const [newOptionNames, setNewOptionNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ propertyName: string, propertyType: string, optionName: string } | null>(null);

  const NOTION_OPTION_LIMIT = 100;

  const handleAddOption = async (propertyName: string, propertyType: string) => {
    const newOptionName = newOptionNames[propertyName]?.trim();
    if (!newOptionName) return;

    setError(null);
    setUpdatingProperty(propertyName);
    try {
      const existingOptions = schema[propertyName][propertyType]?.options || [];
      
      if (existingOptions.some((opt: any) => opt.name.toLowerCase() === newOptionName.toLowerCase())) {
        throw new Error("Taka opcja już istnieje.");
      }

      const newOptions = [...existingOptions, { name: newOptionName }];

      const res = await fetch("/api/notion/schema", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyName,
          propertyType,
          newOptions
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Błąd aktualizacji schematu");
      }

      setNewOptionNames(prev => ({ ...prev, [propertyName]: "" }));
      onSchemaUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingProperty(null);
    }
  };

  const handleDeleteOption = async () => {
    if (!confirmDelete) return;
    const { propertyName, propertyType, optionName } = confirmDelete;

    setError(null);
    setUpdatingProperty(propertyName);
    setConfirmDelete(null);
    try {
      const existingOptions = schema[propertyName][propertyType]?.options || [];
      const newOptions = existingOptions.filter((opt: any) => opt.name !== optionName);

      const res = await fetch("/api/notion/schema", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyName,
          propertyType,
          newOptions
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Błąd aktualizacji schematu");
      }

      onSchemaUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingProperty(null);
    }
  };

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

      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
              
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-rose-500/10 rounded-full border border-rose-500/20">
                    <AlertCircle className="w-8 h-8 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold text-slate-100 uppercase tracking-wider">Potwierdź usunięcie</h3>
                    <p className="text-sm text-slate-500 font-medium">Operacja nieodwracalna</p>
                  </div>
                </div>

                <p className="text-lg text-slate-300 mb-8 font-medium leading-relaxed">
                  Czy na pewno chcesz usunąć opcję <span className="text-cyan-400 font-bold underline decoration-cyan-400/30 underline-offset-4">"{confirmDelete.optionName}"</span> z bazy danych?
                </p>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all active:scale-95"
                  >
                    Anuluj
                  </button>
                  <button 
                    onClick={handleDeleteOption}
                    className="flex-1 px-6 py-3 text-sm font-bold bg-gradient-to-br from-rose-600 to-rose-900 hover:from-rose-500 hover:to-rose-800 text-white rounded-xl shadow-lg shadow-rose-500/20 transition-all active:scale-95 border border-rose-500/30"
                  >
                    Usuń na zawsze
                  </button>
                </div>
              </div>
              
              <button 
                onClick={() => setConfirmDelete(null)}
                className="absolute top-4 right-4 p-1 text-slate-500 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <h3 className="text-sm font-display font-bold mb-6 text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
        <div className="w-8 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent" />
        <Settings className="w-4 h-4 text-cyan-400/80" />
        Konfiguracja Systemowa Kolumn
      </h3>
      <div className="space-y-5">
        {Object.entries(schema).sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]: [string, any], index) => {
          const isSelectType = value.type === 'multi_select' || value.type === 'select';
          const options = isSelectType ? [...(value[value.type]?.options || [])].sort((a, b) => a.name.localeCompare(b.name)) : [];
          const isOverLimit = options.length >= NOTION_OPTION_LIMIT;

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: index * 0.05 }}
              key={key} 
              className="bg-slate-900/20 border border-white/5 rounded-3xl p-6 backdrop-blur-md hover:border-cyan-500/20 transition-all duration-500 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex flex-col gap-1">
                  <span className="font-display font-bold text-xl text-slate-200 tracking-tight group-hover:text-cyan-400 transition-colors duration-300">{key}</span>
                  {isSelectType && key !== 'Autor' && (
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-24 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${isOverLimit ? 'bg-rose-500' : 'bg-cyan-500'}`}
                          style={{ width: `${Math.min(100, (options.length / NOTION_OPTION_LIMIT) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-[9px] font-display font-bold uppercase tracking-widest ${isOverLimit ? 'text-rose-400' : 'text-slate-500'}`}>
                        {options.length} / {NOTION_OPTION_LIMIT}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full text-[9px] font-display border border-cyan-500/20 uppercase tracking-[0.15em] font-black shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                    {value.type}
                  </span>
                </div>
              </div>
              
              {isSelectType && (
                <div className="mt-6 pt-6 border-t border-white/5 relative z-10">
                  {isOverLimit && key !== 'Autor' && (
                    <div className="mb-6 p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
                      <div className="text-[11px] text-rose-300/80 font-display font-medium leading-relaxed">
                        <span className="font-bold block mb-1 uppercase tracking-wider text-rose-400">Krytyczny Limit API</span>
                        Wykryto {options.length} wpisów. Notion blokuje edycję powyżej {NOTION_OPTION_LIMIT}. 
                        Zalecana konwersja na <span className="text-cyan-400 font-bold">Plain Text</span> w panelu sterowania Notion.
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Zasoby Opcji</p>
                    {options.length === 0 && (
                      <span className="text-[10px] text-slate-600 italic font-display">Baza pusta</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {options.map((opt: any) => (
                      <motion.span 
                        layout
                        key={opt.id || opt.name} 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950/40 border border-white/5 text-slate-400 rounded-2xl text-xs font-display font-medium group/opt hover:border-cyan-500/40 hover:text-cyan-300 transition-all duration-300 shadow-sm"
                      >
                        {opt.name}
                        {key !== 'Autor' && (
                          <button
                            onClick={() => setConfirmDelete({ propertyName: key, propertyType: value.type, optionName: opt.name })}
                            disabled={updatingProperty === key}
                            className="text-slate-600 hover:text-rose-500 disabled:opacity-50 transition-colors p-0.5 rounded-md hover:bg-rose-500/10"
                            title="Usuń opcję"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </motion.span>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 group/input">
                      <input
                        type="text"
                        placeholder="Wprowadź nową desygnację..."
                        className="w-full pl-4 pr-4 py-3 text-xs bg-slate-950/60 border border-white/5 text-slate-300 rounded-2xl focus:outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 placeholder-slate-700 transition-all duration-300 font-display font-medium"
                        value={newOptionNames[key] || ""}
                        onChange={(e) => setNewOptionNames(prev => ({ ...prev, [key]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddOption(key, value.type);
                          }
                        }}
                      />
                    </div>
                    <button
                      onClick={() => handleAddOption(key, value.type)}
                      disabled={!newOptionNames[key]?.trim() || updatingProperty === key || isOverLimit}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-2xl text-xs font-display font-bold hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 active:scale-95 shadow-lg shadow-cyan-500/20 uppercase tracking-widest"
                    >
                      {updatingProperty === key ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Inicjuj
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
