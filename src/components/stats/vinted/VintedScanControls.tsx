import React from "react";
import { Loader2, Search, Bug, Database, HardDriveDownload, Trash2 } from "lucide-react";
import { RitualButton } from "../RitualButton";


interface Props {
  /** Okno „Kontynuuj" (h) z konfiguracji — tylko do tooltipa. */
  resumeHours: number;
  isChecking: boolean;
  isResolving: boolean;
  isLoadingStored: boolean;
  usingStored: boolean;
  hasAttempts: boolean;
  resumeScan: boolean;
  setResumeScan: (v: boolean) => void;
  showLogs: boolean;
  setShowLogs: (v: boolean) => void;
  onScanToggle: () => void;
  onResolveToggle: () => void;
  onLoadStored: () => void;
  onClearStored: () => void;
}

/** Nagłówek skanera + rytuały (skan / identyfikacja handlarzy / przywołanie z bazy). */
export const VintedScanControls: React.FC<Props> = ({
  resumeHours,
  isChecking, isResolving, isLoadingStored, usingStored, hasAttempts,
  resumeScan, setResumeScan, showLogs, setShowLogs,
  onScanToggle, onResolveToggle, onLoadStored, onClearStored,
}) => (
  <>
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <h3 className="text-lg font-bold text-slate-200 uppercase tracking-widest">Katalog Beletrystyka</h3>
        <p className="text-xs text-slate-500 font-medium">Skanowanie ofert Vinted (język polski, od 2 PLN)</p>
      </div>

      <div className="flex items-center gap-3">
        {!isChecking && (
          <label
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 cursor-pointer select-none"
            title={`Pomiń książki skanowane w ostatnich ${resumeHours} h (bieżąca partia); resztę skanuj OD NAJSTARSZYCH — kontynuuje przerwany przebieg i odświeża najstarsze. Odznacz, by skanować wszystko od nowa (też od najstarszych).`}
          >
            <input type="checkbox" checked={resumeScan} onChange={(e) => setResumeScan(e.target.checked)} className="accent-cyan-500 w-3.5 h-3.5" />
            Kontynuuj
          </label>
        )}
        {hasAttempts && (
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`p-3 rounded-2xl transition-all border ${showLogs ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300"}`}
            title="Pokaż logi skanowania"
          >
            <Bug className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>

    {/* Rytuały skanera — w stylu liturgii synchronizacji */}
    <div className="grid sm:grid-cols-2 gap-3">
      <RitualButton
        className="sm:col-span-2"
        color={isChecking ? "rose" : "cyan"}
        icon={isChecking ? Loader2 : Search}
        animate={isChecking ? "spin" : undefined}
        disabled={!isChecking && isResolving}
        title={isChecking ? "Przerwij Rytuał Skanowania" : "Rytuał Skanowania Vinted"}
        subtitle={isChecking ? "Zatrzymanie aktywnego przeszukania katalogu" : "Przeszukanie katalogu Vinted — język polski, od 2 PLN"}
        onClick={onScanToggle}
      />

      {!isChecking && !usingStored && (
        <RitualButton
          color={isResolving ? "rose" : "emerald"}
          icon={isResolving ? Loader2 : Database}
          animate={isResolving ? "spin" : undefined}
          title={isResolving ? "Przerwij Identyfikację" : "Rytuał Identyfikacji Handlarzy"}
          subtitle={isResolving ? "Zatrzymanie dociągania sprzedawców" : "Dociągnięcie sprzedawców do bazy — wznawialny"}
          onClick={onResolveToggle}
        />
      )}

      {!isChecking && !isResolving && (
        usingStored ? (
          <RitualButton color="indigo" icon={Trash2} title="Rozwiej Przywołanie" subtitle="Powrót do wyników bieżącego skanu" onClick={onClearStored} />
        ) : (
          <RitualButton
            color="indigo"
            icon={isLoadingStored ? Loader2 : HardDriveDownload}
            animate={isLoadingStored ? "spin" : undefined}
            disabled={isLoadingStored}
            title="Rytuał Przywołania z Archiwum"
            subtitle="Kafelki i paczki ze składowanych danych — bez skanu"
            onClick={onLoadStored}
          />
        )
      )}
    </div>
  </>
);
