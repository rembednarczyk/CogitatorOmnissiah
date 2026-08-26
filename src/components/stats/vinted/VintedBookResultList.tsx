import React from "react";
import { motion } from "motion/react";
import { ExternalLink, Clock, Sparkles, BookImage, ShoppingCart, ArrowDown } from "lucide-react";
import { VintedResult } from "../../../hooks/useVintedCheck";
import { CycleTile } from "../../CycleTile";
import { sortOffersByPrice, offersPriceSummary, formatVintedPrice, cleanOfferTitle, sortResultsByCheapest } from "../../../utils/vintedOffers";
import { shortDate, isBookChanged, offerBadges } from "../../../utils/vintedFormat";

type Offer = VintedResult["vintedItems"][number];

const OfferRow: React.FC<{ item: Offer; result: VintedResult; isCheapest: boolean }> = ({ item, result, isCheapest }) => {
  const hasPrice = item.priceValue !== null && item.priceValue !== undefined;
  const offerTitle = cleanOfferTitle(item.title);
  const { isNew, drop } = offerBadges(item, result);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all group/item ${isCheapest ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15" : "bg-rose-500/5 border-rose-500/10 hover:bg-rose-500/15 hover:border-rose-500/30"}`}
    >
      {item.photo ? (
        <img src={item.photo} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} className="w-9 h-9 rounded-lg object-cover border border-slate-700/50 shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-slate-800/50 border border-slate-700/40 flex items-center justify-center shrink-0">
          <BookImage className="w-4 h-4 text-slate-600" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-slate-400 truncate">{offerTitle || item.title}</div>
        {(isNew || drop) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {isNew && (
              <span className="flex items-center gap-0.5 text-[8px] uppercase tracking-widest font-bold text-cyan-400"><Sparkles className="w-2.5 h-2.5" /> nowa</span>
            )}
            {drop && (
              <span className="flex items-center gap-0.5 text-[8px] uppercase tracking-widest font-bold text-amber-400" title={`Spadek z ${formatVintedPrice(item.prevPrice, item.currency)}`}>
                <ArrowDown className="w-2.5 h-2.5" /> −{formatVintedPrice(drop)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Price — most prominently displayed, fixed width, does not wrap */}
      <div className={`shrink-0 text-right tabular-nums font-bold leading-none ${hasPrice ? (isCheapest ? "text-emerald-300 text-lg" : "text-rose-300 text-base") : "text-slate-500 text-[11px] font-medium italic"}`}>
        {hasPrice ? formatVintedPrice(item.priceValue, item.currency) : "cena w ofercie"}
        {isCheapest && hasPrice && <div className="text-[8px] text-emerald-400/80 uppercase tracking-widest font-bold mt-0.5">najtańsza</div>}
      </div>
      <ShoppingCart className={`w-3.5 h-3.5 shrink-0 opacity-40 group-hover/item:opacity-100 ${isCheapest ? "text-emerald-400" : "text-rose-400"}`} />
    </a>
  );
};

/** Results grid per book (tile + offers sorted cheapest first). */
export const VintedBookResultList: React.FC<{ results: VintedResult[] }> = ({ results }) => (
  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
    {sortResultsByCheapest(results).map((result) => {
      const offers = sortOffersByPrice(result.vintedItems);
      const { min, count } = offersPriceSummary(offers);
      const cheapestIdx = offers.findIndex((o) => o.priceValue !== null && o.priceValue !== undefined);
      return (
        <motion.div layout key={result.id} transition={{ type: "spring", stiffness: 400, damping: 40 }} className="flex flex-col gap-3 p-5 rounded-3xl border border-rose-500/10 bg-slate-900/40 group/book hover:border-rose-500/30 transition-all hover:shadow-lg hover:shadow-rose-500/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="text-base font-bold text-slate-100 leading-tight truncate group-hover/book:text-rose-400 transition-colors">{result.title}</div>
                <CycleTile title={result.title} author={result.author} partOfCycle={result.partOfCycle} cykl={result.cykl} cyklNr={result.cyklNr} />
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">{result.author}{result.year ? ` · ${result.year}` : ""}</div>
              {result.scannedAt && (
                <div className="text-[9px] text-indigo-400/60 font-bold tracking-widest mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> skan {shortDate(result.scannedAt)}
                  {isBookChanged(result) && <span className="ml-1 flex items-center gap-0.5 text-amber-400"><Sparkles className="w-2.5 h-2.5" /> zmiana</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] font-bold text-rose-300 whitespace-nowrap">
                {min !== null ? `od ${formatVintedPrice(min)}` : `${count} ${count === 1 ? "oferta" : "ofert"}`}
                {min !== null && <span className="text-rose-400/50"> · {count}</span>}
              </span>
              <a href={result.searchUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-800/50 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Otwórz wyszukiwanie Vinted">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-1">
            {offers.map((item, i) => (
              <OfferRow key={item.url ?? i} item={item} result={result} isCheapest={i === cheapestIdx} />
            ))}
          </div>
        </motion.div>
      );
    })}
  </motion.div>
);
