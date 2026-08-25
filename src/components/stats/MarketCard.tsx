import React from "react";
import { motion } from "motion/react";
import { Coins, Tag, TrendingDown, Users, ExternalLink } from "lucide-react";
import { MarketStats } from "../../hooks/useStats";

/**
 * „Rynek" — statystyki z blobu VintedData: koszt skompletowania kolekcji (suma
 * najtańszych ofert chcianych książek), najtańsze okazje, świeże spadki cen,
 * sprzedawcy z największą liczbą chcianych książek (naturalne paczki). Actionable —
 * linki wiodą wprost do ofert.
 */

const money = (n: number, cur: string) => `${n.toLocaleString("pl-PL", { maximumFractionDigits: 0 })} ${cur}`;

const OfferRow: React.FC<{ title: string; url: string; children: React.ReactNode }> = ({ title, url, children }) => (
  <a href={url} target="_blank" rel="noopener noreferrer"
    className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/40 border border-white/5 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all group">
    <span className="text-xs text-slate-300 flex-1 truncate group-hover:text-rose-200">{title}</span>
    {children}
    <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-rose-400 shrink-0" />
  </a>
);

export const MarketCard: React.FC<{ market: MarketStats }> = ({ market }) => {
  const { currency: cur } = market;
  const hasData = market.booksWithOffers > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="glass-card p-6 rounded-3xl border-rose-500/10 space-y-6"
    >
      <h3 className="text-sm font-bold font-display uppercase tracking-widest text-rose-400 flex items-center gap-2 mb-4">
        <Coins className="w-4 h-4" />
        Rynek Reliktów (Vinted)
      </h3>

      {!hasData ? (
        <p className="text-slate-400 text-sm italic text-center py-8">Brak składowanych ofert — uruchom Rytuał Skanowania Vinted.</p>
      ) : (
        <>
          {/* Koszt skompletowania */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 to-slate-950/40 border border-rose-500/20">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-display text-rose-200 tabular-nums">{money(market.completionCost, cur)}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              koszt skompletowania — najtańsza oferta dla każdej z <span className="text-rose-300 font-bold">{market.booksWithOffers}</span> chcianych książek ({market.totalOffers} ofert łącznie)
            </p>
          </div>

          {/* Najtańsze okazje */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Tag className="w-3 h-3" /> Najtańsze okazje</h4>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
              {market.cheapest.map((o, i) => (
                <OfferRow key={i} title={o.bookTitle} url={o.url}>
                  <span className="text-xs font-bold text-emerald-300 tabular-nums shrink-0">{money(o.price, o.currency)}</span>
                </OfferRow>
              ))}
            </div>
          </div>

          {/* Świeże spadki cen */}
          {market.priceDrops.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><TrendingDown className="w-3 h-3 text-emerald-400" /> Spadki cen</h4>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                {market.priceDrops.map((d, i) => (
                  <OfferRow key={i} title={d.bookTitle} url={d.url}>
                    <span className="text-[10px] text-slate-500 line-through tabular-nums shrink-0">{money(d.prevPrice, d.currency)}</span>
                    <span className="text-xs font-bold text-emerald-300 tabular-nums shrink-0">{money(d.price, d.currency)}</span>
                    <span className="text-[10px] font-bold text-emerald-400 tabular-nums shrink-0">−{Math.round(d.prevPrice - d.price)}</span>
                  </OfferRow>
                ))}
              </div>
            </div>
          )}

          {/* Sprzedawcy z paczką */}
          {market.topSellers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Users className="w-3 h-3" /> Sprzedawcy z paczką</h4>
              <div className="space-y-1.5">
                {market.topSellers.map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/40 border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group">
                    <span className="text-xs text-slate-300 flex-1 truncate group-hover:text-purple-200">{s.login}</span>
                    <span className="text-[10px] text-slate-500 tabular-nums shrink-0">~{money(s.total, cur)}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-[10px] font-bold tabular-nums shrink-0">{s.books} książki</span>
                    <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-purple-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};
