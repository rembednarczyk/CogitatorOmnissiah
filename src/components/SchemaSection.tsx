import React from "react";
import { Database, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SchemaEditor } from "./SchemaEditor";

interface SchemaSectionProps {
  schema: any;
  schemaLoading: boolean;
  schemaError: string | null;
  configStatus: {
    hasNotionKey: boolean;
    hasDatabaseId: boolean;
  };
  fetchSchema: () => void;
}

export const SchemaSection: React.FC<SchemaSectionProps> = ({
  schema,
  schemaLoading,
  schemaError,
  configStatus,
  fetchSchema
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: 0.7 }}
      className="glass-card p-8 rounded-3xl"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold font-display uppercase tracking-widest text-cyan-400">
            Schemat bazy Notion
          </h2>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-slate-900 rounded-xl text-slate-500 hover:text-cyan-400 transition-all border border-slate-800"
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="text-slate-400 text-sm mb-6">Edytuj strukturę danych w bazie Notion.</p>
            
            <button 
              onClick={fetchSchema}
              disabled={!configStatus.hasNotionKey || !configStatus.hasDatabaseId || schemaLoading}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-2xl font-bold transition-all hover:-translate-y-1 shadow-xl mb-8 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${schemaLoading ? 'animate-spin' : ''}`} />
              {schemaLoading ? "Wczytywanie..." : "Odśwież schemat z bazy Notion"}
            </button>

            {schemaError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm mb-6">
                {schemaError}
              </motion.div>
            )}

            {schema && (
              <SchemaEditor schema={schema} onSchemaUpdated={fetchSchema} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};
