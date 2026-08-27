import React, { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Save, RotateCcw, Wrench, ShoppingCart, Globe, LibraryBig, Trophy, ChevronDown, ChevronUp, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { AppConfig, DEFAULT_CONFIG, LibraryBranch, AwardPage } from "../configSchema";
import { useAppConfig } from "../hooks/useAppConfig";

/**
 * „Kalibracja" tab (entry: click the logo) — app configuration knobs.
 * Draft edited locally; „Zapisz" sends PUT /api/app-config (backend clamps
 * and stores the diff from defaults in Notion). The „Zaawansowane" section is collapsible.
 */

const inputCls = "w-full px-3 py-2 text-sm bg-slate-950/60 border border-white/10 text-slate-200 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10 transition-all font-medium";
const labelCls = "text-[11px] font-bold text-slate-400 uppercase tracking-widest";
const hintCls = "text-[10px] text-slate-500 leading-snug";

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <label className={labelCls}>{label}</label>
    {children}
    {hint && <p className={hintCls}>{hint}</p>}
  </div>
);

const NumberField: React.FC<{ label: string; hint?: string; value: number; step?: number; onChange: (v: number) => void }> = ({ label, hint, value, step, onChange }) => (
  <Field label={label} hint={hint}>
    <input type="number" step={step ?? 1} value={value} className={inputCls}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
  </Field>
);

const TextField: React.FC<{ label: string; hint?: string; value: string; onChange: (v: string) => void }> = ({ label, hint, value, onChange }) => (
  <Field label={label} hint={hint}>
    <input type="text" value={value} className={inputCls} onChange={(e) => onChange(e.target.value)} />
  </Field>
);

/** Text list (one entry per line) — excluded sources, UA pool. */
const ListField: React.FC<{ label: string; hint?: string; rows?: number; value: string[]; onChange: (v: string[]) => void }> = ({ label, hint, rows = 4, value, onChange }) => (
  <Field label={label} hint={hint}>
    <textarea
      rows={rows}
      className={`${inputCls} font-mono text-xs leading-relaxed resize-y custom-scrollbar`}
      value={value.join("\n")}
      onChange={(e) => onChange(e.target.value.split("\n"))}
      onBlur={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
    />
  </Field>
);

const SectionCard: React.FC<{ icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }> = ({ icon, title, accent, children }) => (
  <div className="glass-card rounded-3xl p-6 space-y-5">
    <h3 className={`flex items-center gap-2.5 text-sm font-display font-bold uppercase tracking-[0.2em] ${accent}`}>
      {icon}{title}
    </h3>
    {children}
  </div>
);

export const ConfigSection: React.FC = () => {
  const { draft, setDraft, loading, saving, error, savedAt, save } = useAppConfig();
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (loading || !draft) {
    return (
      <div className="glass-card rounded-3xl p-16 flex items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        <span className="text-sm uppercase tracking-widest font-bold">Wczytywanie ustawień...</span>
      </div>
    );
  }

  // Single setters per section — draft is always a full AppConfig.
  const upd = <S extends keyof AppConfig>(section: S, patch: Partial<AppConfig[S]>) =>
    setDraft({ ...draft, [section]: { ...draft[section], ...patch } });

  const setBranch = (i: number, patch: Partial<LibraryBranch>) => {
    const branches = draft.library.branches.map((b, j) => (j === i ? { ...b, ...patch } : b));
    upd("library", { branches });
  };
  const setAward = (i: number, patch: Partial<AwardPage>) => {
    const awards = draft.sync.awards.map((a, j) => (j === i ? { ...a, ...patch } : a));
    upd("sync", { awards });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header + actions */}
      <div className="glass-card rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold font-display uppercase tracking-widest text-cyan-400 flex items-center gap-3">
            <Wrench className="w-5 h-5" />
            Ustawienia
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ustawienia aplikacji. Wartości poza zakresem są przycinane; zapis trafia do Notion (opis kolumny <span className="font-mono text-cyan-300/80">AppConfig</span>) i przeżywa redeploy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !saving && !error && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Zapisano
            </span>
          )}
          <button
            onClick={() => setDraft(JSON.parse(JSON.stringify(DEFAULT_CONFIG)))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-300 transition-all text-xs font-bold uppercase tracking-widest"
            title="Przywróć wszystkie knoby do wartości domyślnych (zapisz, by utrwalić)"
          >
            <RotateCcw className="w-4 h-4" /> Domyślne
          </button>
          <button
            onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50 transition-all text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(34,211,238,0.15)]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Zapisz
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-2xl p-4 border-red-500/30 bg-red-500/5 text-sm text-red-400 font-medium">{error}</div>
      )}

      {/* Vinted */}
      <SectionCard icon={<ShoppingCart className="w-4 h-4" />} title="Rynek (Vinted)" accent="text-rose-400">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumberField label={'Okno „Kontynuuj” (h)'} hint={'Pomiń książki skanowane w ostatnich N godzinach.'} value={draft.vinted.resumeHours} onChange={(v) => upd("vinted", { resumeHours: v })} />
          <NumberField label="Odstęp min. (ms)" hint="Minimalna przerwa między żądaniami." value={draft.vinted.throttleMinMs} onChange={(v) => upd("vinted", { throttleMinMs: v })} />
          <NumberField label="Jitter odstępu (ms)" hint="Losowy dodatek do przerwy (min + 0…jitter)." value={draft.vinted.throttleJitterMs} onChange={(v) => upd("vinted", { throttleJitterMs: v })} />
          <NumberField label="Cena od" hint="Dolny próg ceny w katalogu (odcina śmieci)." value={draft.vinted.priceFrom} step={0.5} onChange={(v) => upd("vinted", { priceFrom: v })} />
          <NumberField label="Kategoria katalogu" hint="2319 = beletrystyka." value={draft.vinted.catalogId} onChange={(v) => upd("vinted", { catalogId: v })} />
          <NumberField label="ID języka" hint="6440 = polski." value={draft.vinted.languageId} onChange={(v) => upd("vinted", { languageId: v })} />
          <TextField label="Waluta" value={draft.vinted.currency} onChange={(v) => upd("vinted", { currency: v.toUpperCase() })} />
          <Field label="Sortowanie">
            <select className={inputCls} value={draft.vinted.order} onChange={(e) => upd("vinted", { order: e.target.value })}>
              <option value="price_low_to_high">Cena rosnąco</option>
              <option value="price_high_to_low">Cena malejąco</option>
              <option value="newest_first">Najnowsze</option>
              <option value="relevance">Trafność</option>
            </select>
          </Field>
          <NumberField label="Limit sprzedawców / przebieg" hint={'0 = bez limitu (operacja „Ustal sprzedawców”).'} value={draft.vinted.sellerResolveCap} onChange={(v) => upd("vinted", { sellerResolveCap: v })} />
        </div>
        <ListField label="Źródła wykluczające ze skanu" hint={'Tag „Źródło” = książka pomijana. Jeden tag na linię.'}
          value={draft.vinted.excludedSources} onChange={(v) => upd("vinted", { excludedSources: v })} />
        <Field label="Rozgrzewanie sesji (ciasteczko Cloudflare)" hint="Przed skanem pobiera stronę główną Vinted, przejmuje ciasteczka (m.in. cf_clearance) i niesie je + stały User-Agent w kolejnych żądaniach. Zwykle zmniejsza blokady 403. Wyłącz, jeśli sprawia problemy.">
          <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={draft.vinted.primeSession} onChange={(e) => upd("vinted", { primeSession: e.target.checked })} className="accent-rose-500 w-4 h-4" />
            Włączone
          </label>
        </Field>
        <Field label="Rozgrzewanie przez przeglądarkę (Playwright)" hint={'Cięższy wariant: headless Chromium rozwiązuje wyzwanie JS Cloudflare po prawdziwe cf_clearance. Wymaga Chromium po stronie serwera (działa lokalnie; na hostingu bez przeglądarki → automatyczny fallback do lekkiego primingu). Działa tylko przy włączonym rozgrzewaniu sesji.'}>
          <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={draft.vinted.primeWithBrowser} onChange={(e) => upd("vinted", { primeWithBrowser: e.target.checked })} className="accent-rose-500 w-4 h-4" />
            Włączone
          </label>
        </Field>
      </SectionCard>

      {/* UA pool */}
      <SectionCard icon={<Globe className="w-4 h-4" />} title="Przeglądarka (User-Agent)" accent="text-cyan-400">
        <ListField label="Pula User-Agentów" rows={7}
          hint={'Rotacja per żądanie (Vinted + biblioteka). Odświeżaj co ~kwartał do bieżących wersji przeglądarek — przestarzałe UA ściągają wykrycie bota. Jeden wpis na linię.'}
          value={draft.scraping.userAgents} onChange={(v) => upd("scraping", { userAgents: v })} />
      </SectionCard>

      {/* Library branches */}
      <SectionCard icon={<LibraryBig className="w-4 h-4" />} title="Filie biblioteczne (OPAC)" accent="text-indigo-400">
        <div className="space-y-3">
          {draft.library.branches.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_0.6fr_1fr_auto] gap-2 items-end">
              <TextField label={i === 0 ? "ID" : ""} value={b.id} onChange={(v) => setBranch(i, { id: v })} />
              <TextField label={i === 0 ? "Nazwa" : ""} value={b.name} onChange={(v) => setBranch(i, { name: v })} />
              <TextField label={i === 0 ? "Kod f2" : ""} value={b.code} onChange={(v) => setBranch(i, { code: v })} />
              <TextField label={i === 0 ? "Tag Źródło" : ""} value={b.sourceTag} onChange={(v) => setBranch(i, { sourceTag: v })} />
              <button onClick={() => upd("library", { branches: draft.library.branches.filter((_, j) => j !== i) })}
                className="p-2.5 mb-0.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Usuń filię">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={() => upd("library", { branches: [...draft.library.branches, { id: "", name: "", code: "", sourceTag: "" }] })}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-indigo-300 hover:text-indigo-200 transition-colors">
            <Plus className="w-4 h-4" /> Dodaj filię
          </button>
          <p className={hintCls}>Kod f2 = wartość filtra filii w OPAC MBP Lublin. Tag „Źródło" jest dopisywany po oznaczeniu książki i wyklucza ją z kolejnych skanów.</p>
        </div>
      </SectionCard>

      {/* Awards */}
      <SectionCard icon={<Trophy className="w-4 h-4" />} title="Strony nagród (Encyklopedia Fantastyki)" accent="text-amber-400">
        <div className="space-y-3">
          {draft.sync.awards.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.6fr_auto] gap-2 items-end">
              <TextField label={i === 0 ? "Nazwa nagrody" : ""} value={a.name} onChange={(v) => setAward(i, { name: v })} />
              <TextField label={i === 0 ? "Tytuł strony wiki" : ""} value={a.title} onChange={(v) => setAward(i, { title: v })} />
              <button onClick={() => upd("sync", { awards: draft.sync.awards.filter((_, j) => j !== i) })}
                className="p-2.5 mb-0.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Usuń nagrodę">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={() => upd("sync", { awards: [...draft.sync.awards, { name: "", title: "" }] })}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-300 hover:text-amber-200 transition-colors">
            <Plus className="w-4 h-4" /> Dodaj nagrodę
          </button>
          <p className={hintCls}>Lista zasila dropdown „Synchronizacja", pełną synchronizację („Wszystkie Nagrody") i diagnostykę.</p>
        </div>
      </SectionCard>

      {/* Advanced */}
      <div className="glass-card rounded-3xl p-6 space-y-5">
        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-sm font-display font-bold uppercase tracking-[0.2em] text-purple-400">
          <span className="flex items-center gap-2.5"><Wrench className="w-4 h-4" />Zaawansowane</span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showAdvanced && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <NumberField label="Vinted: timeout (ms)" hint="NIE skracaj pochopnie — ucinanie wolnych odpowiedzi Cloudflare = zero trafień." value={draft.vinted.requestTimeoutMs} onChange={(v) => upd("vinted", { requestTimeoutMs: v })} />
              <NumberField label="Vinted: liczba prób" value={draft.vinted.retryAttempts} onChange={(v) => upd("vinted", { retryAttempts: v })} />
              <NumberField label="Vinted: backoff (ms)" value={draft.vinted.retryBackoffMs} onChange={(v) => upd("vinted", { retryBackoffMs: v })} />
              <NumberField label="Biblioteka: równoległość" hint="Jednoczesne zapytania OPAC." value={draft.library.concurrency} onChange={(v) => upd("library", { concurrency: v })} />
              <NumberField label="Sync: równoległość zapisów" hint="pLimit zapisów do Notion (nagrody/cykle)." value={draft.sync.writeConcurrency} onChange={(v) => upd("sync", { writeConcurrency: v })} />
              <NumberField label="Regał: rzędy na stronę" value={draft.ui.shelfRowsPerPage} onChange={(v) => upd("ui", { shelfRowsPerPage: v })} />
              <Field label="Regał: precyzyjny drop" hint="Wstawianie woluminu w konkretną szczelinę (w obrębie dekady). Wyłączony = tylko globalny drag&drop między półkami.">
                <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" checked={draft.ui.preciseShelfDrop} onChange={(e) => upd("ui", { preciseShelfDrop: e.target.checked })} className="accent-cyan-500 w-4 h-4" />
                  Włączony
                </label>
              </Field>
              <NumberField label="Duplikaty: próg autora" hint="0.5–1; wyżej = mniej czułe." value={draft.sync.dupAuthorThreshold} step={0.01} onChange={(v) => upd("sync", { dupAuthorThreshold: v })} />
              <NumberField label="Duplikaty: próg tytułu" hint="0.5–1; dotyczy tytułu PL i oryginalnego." value={draft.sync.dupTitleThreshold} step={0.01} onChange={(v) => upd("sync", { dupTitleThreshold: v })} />
            </div>
            <ListField label="Biblioteka: źródła wykluczające" hint={'Osobna lista od Vinted (celowo bez „Audioteka” — audiobook nie wyklucza wypożyczenia papieru).'}
              value={draft.library.excludedSources} onChange={(v) => upd("library", { excludedSources: v })} />
          </div>
        )}
      </div>
    </motion.div>
  );
};
