import React, { useMemo, useState } from "react";
import { Package, Users, ExternalLink, ShoppingCart } from "lucide-react";
import { VintedResult } from "../../../hooks/useVintedCheck";
import { formatVintedPrice } from "../../../utils/vintedOffers";
import { groupBySeller, sortBundles, BundleSortMode, VintedSeller } from "../../../utils/vintedSellers";
import { CycleTile } from "../../CycleTile";

interface Props {
  results: VintedResult[];
  sellers: Record<string, VintedSeller | null>;
  usingStored: boolean;
}

const SORTS: { mode: BundleSortMode; label: string }[] = [
  { mode: "count", label: "Najwięcej książek" },
  { mode: "price", label: "Najtańsza paczka" },
];

/** Bundles from a single seller (from the database) + sort toggle. */
export const VintedBundleList: React.FC<Props> = ({ results, sellers, usingStored }) => {
  const [bundleSort, setBundleSort] = useState<BundleSortMode>("count");
  const rawBundles = useMemo(() => groupBySeller(results, sellers), [results, sellers]);
  const bundles = useMemo(() => sortBundles(rawBundles, bundleSort), [rawBundles, bundleSort]);

  if (bundles.length === 0) {
    return usingStored ? (
      <p className="text-xs text-slate-500 italic px-2">Żaden sprzedawca nie ma ≥2 książek z listy — brak paczek do złożenia. (Uzupełnij sprzedawców operacją „Identyfikacja sprzedawców".)</p>
    ) : null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Package className="w-4 h-4 text-purple-400" />
        <h4 className="text-sm font-bold text-purple-300 uppercase tracking-widest">Paczki od jednego sprzedawcy</h4>
        <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 text-[10px] font-bold border border-purple-500/20">{bundles.length}</span>
        <div className="ml-auto flex items-center gap-1 p-0.5 rounded-xl bg-slate-900/60 border border-purple-500/15">
          {SORTS.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setBundleSort(mode)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${bundleSort === mode ? "bg-purple-500/20 text-purple-200 border border-purple-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {bundles.map((b) => (
          <div key={b.seller.id} className="p-4 rounded-3xl border border-purple-500/20 bg-purple-500/5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <a href={b.seller.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-bold text-purple-200 hover:text-purple-100 transition-colors min-w-0">
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
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-purple-500/10 bg-slate-900/40 hover:bg-purple-500/10 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[12px] text-slate-200 font-semibold truncate">{e.bookTitle}</span>
                      <CycleTile title={e.bookTitle} author={e.bookAuthor} partOfCycle={e.bookPartOfCycle} cykl={e.bookCykl} cyklNr={e.bookCyklNr} size="xs" />
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold truncate">{e.bookAuthor}{e.bookYear ? ` · ${e.bookYear}` : ""}</div>
                  </div>
                  <a href={e.item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-3 group/offer" title="Otwórz ofertę na Vinted">
                    <div className="shrink-0 text-right tabular-nums font-bold text-purple-200 text-sm">
                      {e.item.priceValue != null ? formatVintedPrice(e.item.priceValue, e.item.currency) : "—"}
                      {e.premium > 0 ? (
                        <div className="text-[8px] text-amber-400/80 uppercase tracking-widest font-bold mt-0.5">+{formatVintedPrice(e.premium)}</div>
                      ) : e.item.priceValue != null ? (
                        <div className="text-[8px] text-emerald-400/80 uppercase tracking-widest font-bold mt-0.5">najtańsza</div>
                      ) : null}
                    </div>
                    <ShoppingCart className="w-3.5 h-3.5 shrink-0 text-purple-400 opacity-50 group-hover/offer:opacity-100 transition-opacity" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
