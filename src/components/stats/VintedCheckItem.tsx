import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingCart, ExternalLink, Loader2, Search, Bug, CheckCircle2, XCircle, AlertCircle, BookImage, Users, Package } from "lucide-react";
import { formatETA } from "../../utils/time";
import { VintedResult, VintedSearchAttempt } from "../../hooks/useVintedCheck";
import { sortOffersByPrice, offersPriceSummary, formatVintedPrice, cleanOfferTitle, sortResultsByCheapest } from "../../utils/vintedOffers";
import { useVintedGrouping } from "../../hooks/useVintedGrouping";
import { groupBySeller } from "../../utils/vintedSellers";

interface VintedCheckItemProps {
  results: VintedResult[];
  searchAttempts: VintedSearchAttempt[];
  onCheck: () => void;
  onStop: () => void;
  isChecking: boolean;
  progress: any;
}

// Zwięzła jednolinijkowa diagnostyka próby (Krok 2). Kluczowy sygnał:
// itemLinks>0 przy parsed:0 i bez markerów = parser zgubił oferty.
function formatDebug(d: NonNullable<VintedSearchAttempt["debug"]>): string {
  if (d.error) return `⚠ ${d.error}${d.httpStatus ? ` (${d.httpStatus})` : d.code ? ` (${d.code})` : ""}`;
  const parts: string[] = [];
  if (d.chars !== undefined) parts.push(`${(d.chars / 1000).toFixed(0)}k`);
  parts.push(d.hasCatalogJson ? "json" : d.hasFeedGrid ? "grid" : "html");
  if (d.itemLinks !== undefined) parts.push(`links:${d.itemLinks}`);
  if (d.parsed !== undefined) parts.push(`parsed:${d.parsed}`);
  if (d.blockedMarker) parts.push("BLOCK");
  if (d.noResultsMarker) parts.push("noRes");
  // Pamięć procesu — rosnące rssMb ku limitowi hostingu tuż przed śmiercią = OOM.
  if (d.rssMb !== undefined) parts.push(`mem:${d.rssMb}MB`);
  return parts.join(" · ");
}

export const VintedCheckItem: React.FC<VintedCheckItemProps> = ({ results, searchAttempts, onCheck, onStop, isChecking, progress }) => {
  const [showLogs, setShowLogs] = React.useState(false);
  const { sellersByUrl, isGrouping, groupProgress, groupError, runGrouping, stopGrouping } = useVintedGrouping();

  const [groupSkipped, setGroupSkipped] = React.useState(0);
  const GROUP_CAP = 150;

  // Paczki po sprzedawcy — liczone z map url→sprzedawca dociągniętych on-demand.
  const bundles = React.useMemo(() => groupBySeller(results, sellersByUrl), [results, sellersByUrl]);

  // Tryb „najtańsze": po jednej (najtańszej) ofercie z książki — 1 fetch/książkę.
  const handleGroupCheapest = () => {
    setGroupSkipped(0);
    const urls = results
      .map(r => sortOffersByPrice(r.vintedItems)[0]?.url)
      .filter((u): u is string => !!u);
    runGrouping(urls.slice(0, GROUP_CAP));
  };

  // Tryb „wszystkie oferty": każda oferta każdej książki — ujawnia many-to-many
  // (dopłać grosze, skonsoliduj przesyłkę). Drożej pod Cloudflare → cap 150 + raport.
  const handleGroupAll = () => {
    const urls = results
      .flatMap(r => r.vintedItems.map(i => i.url))
      .filter((u): u is string => !!u);
    setGroupSkipped(Math.max(0, urls.length - GROUP_CAP));
    runGrouping(urls.slice(0, GROUP_CAP));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-slate-200 uppercase tracking-widest">Katalog Beletrystyka</h3>
          <p className="text-xs text-slate-500 font-medium">Skanowanie ofert Vinted (język polski, od 2 PLN)</p>
        </div>
        
        <div className="flex items-center gap-3">
          {searchAttempts.length > 0 && (
            <button
              onClick={() => setShowLogs(!showLogs)}
              className={`p-3 rounded-2xl transition-all border ${
                showLogs 
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400" 
                  : "bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
              title="Pokaż logi skanowania"
            >
              <Bug className="w-5 h-5" />
            </button>
          )}

          {results.length > 0 && !isChecking && isGrouping && (
            <button
              onClick={() => stopGrouping()}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl transition-all text-sm font-bold border bg-red-600/90 border-red-500/50 text-white hover:bg-red-500"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Zatrzymaj grupowanie</span>
            </button>
          )}

          {results.length > 0 && !isChecking && !isGrouping && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGroupCheapest}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl transition-all text-sm font-bold border bg-purple-600/90 border-purple-500/50 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/20"
                title="Grupuj po sprzedawcy — po najtańszej ofercie z każdej książki (1 zapytanie/książkę, szybkie)"
              >
                <Users className="w-4 h-4" />
                <span>Najtańsze</span>
              </button>
              <button
                onClick={handleGroupAll}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl transition-all text-sm font-bold border bg-amber-600/90 border-amber-500/50 text-white hover:bg-amber-500 shadow-lg shadow-amber-500/20"
                title="Grupuj po sprzedawcy — WSZYSTKIE oferty (ujawnia many-to-many; wolniejsze, cap 150 zapytań)"
              >
                <Package className="w-4 h-4" />
                <span>Wszystkie oferty</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              if (isChecking) onStop();
              else onCheck(); 
            }}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all text-sm font-bold text-white shadow-xl ${
              isChecking 
                ? "bg-red-600 hover:bg-red-500 shadow-red-500/20" 
                : "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/20"
            }`}
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Zatrzymaj Skanowanie</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Uruchom Skaner Vinted</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isChecking && progress && (
        <div className="px-2 space-y-1">
          <div className="flex justify-between text-xs text-slate-400 uppercase font-bold">
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="break-words">{progress.message}</span>
              {progress.startTime && (
                <span className="text-[10px] text-slate-500 lowercase font-medium">
                  {formatETA(progress.current, progress.total, progress.startTime)}
                </span>
              )}
            </div>
            {progress.total > 0 && <span>{progress.current} / {progress.total}</span>}
          </div>
          {progress.total > 0 && (
            <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                className="h-full bg-cyan-500"
              />
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showLogs && searchAttempts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 rounded-3xl bg-slate-950/50 border border-amber-500/10 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                  <Bug className="w-3 h-3" />
                  Logi Skanowania (Debug)
                </h4>
                <span className="text-[10px] text-slate-500 uppercase font-bold">{searchAttempts.length} prób</span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {searchAttempts.map((attempt, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-slate-900/50 border border-slate-800/50 text-[11px] group/log hover:border-amber-500/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0">
                        {attempt.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {attempt.status === "no_results" && <XCircle className="w-4 h-4 text-slate-600" />}
                        {attempt.status === "blocked" && <AlertCircle className="w-4 h-4 text-amber-500" />}
                        {attempt.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                        {attempt.status === "pending" && <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />}
                      </div>
                      
                      <div className="flex flex-col min-w-0">
                        <span className="text-slate-200 font-bold truncate group-hover/log:text-slate-100 transition-colors">{attempt.title}</span>
                        <span className="text-slate-500 text-[9px] uppercase tracking-widest font-bold">{attempt.author}</span>
                        {attempt.debug && (
                          <span className="text-[9px] font-mono text-slate-500 truncate mt-0.5">{formatDebug(attempt.debug)}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      {attempt.itemCount > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                          {attempt.itemCount}
                        </span>
                      )}
                      <a 
                        href={attempt.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-slate-800/50 hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 transition-all"
                        title="Zobacz zapytanie"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {isGrouping && groupProgress && (
        <div className="px-2 space-y-1">
          <div className="flex justify-between text-xs text-purple-300 uppercase font-bold">
            <span className="break-words">{groupProgress.message}</span>
            {groupProgress.total > 0 && <span>{groupProgress.current} / {groupProgress.total}</span>}
          </div>
          {groupProgress.total > 0 && (
            <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(groupProgress.current / groupProgress.total) * 100}%` }}
                className="h-full bg-purple-500"
              />
            </div>
          )}
        </div>
      )}
      {groupError && <p className="text-xs text-red-400 italic px-2">{groupError}</p>}

      {bundles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Package className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-bold text-purple-300 uppercase tracking-widest">Paczki od jednego sprzedawcy</h4>
            <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 text-[10px] font-bold border border-purple-500/20">{bundles.length}</span>
            {groupSkipped > 0 && (
              <span className="text-[10px] text-amber-400/80 font-bold" title="Limit 150 zapytań — pominięto nadmiar ofert, by nie prowokować blokady IP">
                (pominięto {groupSkipped} ofert — limit 150)
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {bundles.map((b) => (
              <div key={b.seller.id} className="p-4 rounded-3xl border border-purple-500/20 bg-purple-500/5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={b.seller.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-bold text-purple-200 hover:text-purple-100 transition-colors min-w-0"
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="truncate">{b.seller.login}</span>
                    <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                  </a>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/25 text-[11px] font-bold text-purple-200 whitespace-nowrap">
                      {b.entries.length} {b.entries.length < 5 ? "książki" : "książek"} · {formatVintedPrice(b.totalValue)}
                    </span>
                    {b.totalPremium > 0 && (
                      <span className="text-[9px] font-bold text-amber-400/80 uppercase tracking-wider whitespace-nowrap" title="Dopłata vs kupno każdej książki u najtańszego sprzedawcy — cena za konsolidację przesyłki">
                        dopłata +{formatVintedPrice(b.totalPremium)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {b.entries.map((e, i) => (
                    <a
                      key={i}
                      href={e.item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-purple-500/10 bg-slate-900/40 hover:bg-purple-500/10 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-slate-200 font-semibold truncate">{e.bookTitle}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold truncate">{e.bookAuthor}</div>
                      </div>
                      <div className="shrink-0 text-right tabular-nums font-bold text-purple-200 text-sm">
                        {e.item.priceValue != null ? formatVintedPrice(e.item.priceValue, e.item.currency) : "—"}
                        {e.premium > 0 ? (
                          <div className="text-[8px] text-amber-400/80 uppercase tracking-widest font-bold mt-0.5">+{formatVintedPrice(e.premium)}</div>
                        ) : e.item.priceValue != null ? (
                          <div className="text-[8px] text-emerald-400/80 uppercase tracking-widest font-bold mt-0.5">najtańsza</div>
                        ) : null}
                      </div>
                      <ShoppingCart className="w-3.5 h-3.5 shrink-0 text-purple-400 opacity-50" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isGrouping && Object.keys(sellersByUrl).length > 0 && bundles.length === 0 && (
        <p className="text-xs text-slate-500 italic px-2">Żaden sprzedawca nie ma ≥2 książek z listy — brak paczek do złożenia.</p>
      )}

      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden"
        >
          {sortResultsByCheapest(results).map((result) => {
            const offers = sortOffersByPrice(result.vintedItems);
            const { min, count } = offersPriceSummary(offers);
            // Indeks pierwszej (najtańszej) oferty ze znaną ceną — do wyróżnienia.
            const cheapestIdx = offers.findIndex((o) => o.priceValue !== null && o.priceValue !== undefined);
            return (
            <motion.div layout key={result.id} transition={{ type: "spring", stiffness: 400, damping: 40 }} className="flex flex-col gap-3 p-5 rounded-3xl border border-rose-500/10 bg-slate-900/40 group/book hover:border-rose-500/30 transition-all hover:shadow-lg hover:shadow-rose-500/5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-slate-100 leading-tight mb-1 truncate group-hover/book:text-rose-400 transition-colors">
                    {result.title}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">{result.author}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] font-bold text-rose-300 whitespace-nowrap">
                    {min !== null ? `od ${formatVintedPrice(min)}` : `${count} ${count === 1 ? "oferta" : "ofert"}`}
                    {min !== null && <span className="text-rose-400/50"> · {count}</span>}
                  </span>
                  <a
                    href={result.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-800/50 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    title="Otwórz wyszukiwanie Vinted"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-1">
                {offers.map((item, i) => {
                  const isCheapest = i === cheapestIdx;
                  const hasPrice = item.priceValue !== null && item.priceValue !== undefined;
                  const offerTitle = cleanOfferTitle(item.title);
                  return (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all group/item ${
                      isCheapest
                        ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15"
                        : "bg-rose-500/5 border-rose-500/10 hover:bg-rose-500/15 hover:border-rose-500/30"
                    }`}
                  >
                    {item.photo ? (
                      <img
                        src={item.photo}
                        alt=""
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        className="w-9 h-9 rounded-lg object-cover border border-slate-700/50 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-slate-800/50 border border-slate-700/40 flex items-center justify-center shrink-0">
                        <BookImage className="w-4 h-4 text-slate-600" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-slate-400 truncate">{offerTitle || item.title}</div>
                    </div>

                    {/* Cena — najmocniej eksponowana, stała szerokość, nie zawija się */}
                    <div className={`shrink-0 text-right tabular-nums font-bold leading-none ${
                      hasPrice ? (isCheapest ? "text-emerald-300 text-lg" : "text-rose-300 text-base") : "text-slate-500 text-[11px] font-medium italic"
                    }`}>
                      {hasPrice ? formatVintedPrice(item.priceValue, item.currency) : "cena w ofercie"}
                      {isCheapest && hasPrice && (
                        <div className="text-[8px] text-emerald-400/80 uppercase tracking-widest font-bold mt-0.5">najtańsza</div>
                      )}
                    </div>
                    <ShoppingCart className={`w-3.5 h-3.5 shrink-0 opacity-40 group-hover/item:opacity-100 ${isCheapest ? "text-emerald-400" : "text-rose-400"}`} />
                  </a>
                )})}
              </div>
            </motion.div>
          )})}
        </motion.div>
      )}
      
      {results.length === 0 && !isChecking && (
        <p className="text-xs text-slate-500 italic text-center py-4">Brak wyników z Vinted. Uruchom skanowanie.</p>
      )}
    </div>
  );
};
