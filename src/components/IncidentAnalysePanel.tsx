'use client'

// ─── Analyse d'un incident (lot L1, suite) ───────────────────────────────────
// Cause racine, leçons apprises, chronologie horodatée, impacts non financiers et allocation de la
// perte entre entités / lignes de métier. Émet la valeur complète à chaque modification.

import { useTranslation } from '@/lib/i18n/context'
import { CAUSES_RACINE, TYPES_CHRONOLOGIE, UNITES_IMPACT, type Allocation, type EvenementChronologie, type ImpactNonFinancier } from '@/lib/incident-l1b'

export interface AnalyseValue {
  causeRacine: string; causeDetail: string; leconsApprises: string
  chronologie: EvenementChronologie[]; impactsNonFinanciers: ImpactNonFinancier[]; allocations: Allocation[]
}
const inp = 'px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs'
const maintenant = () => new Date().toISOString().slice(0, 16)

export default function IncidentAnalysePanel({ value, onChange, readOnly = false }: { value: AnalyseValue; onChange: (v: AnalyseValue) => void; readOnly?: boolean }) {
  const { t } = useTranslation()
  const l = t.incidents.l1b
  const causes = l.causes as Record<string, string>
  const chronoTypes = l.chronoTypes as Record<string, string>
  const unites = l.unites as Record<string, string>
  const set = (patch: Partial<AnalyseValue>) => onChange({ ...value, ...patch })
  const somme = value.allocations.reduce((s, a) => s + (Number.isFinite(a.pct) ? a.pct : 0), 0)
  const reste = Math.max(0, Math.round((100 - somme) * 100) / 100)

  return (
    <fieldset className="space-y-3 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600" disabled={readOnly}>
      <legend className="px-1 text-xs font-semibold text-gray-500">{l.analyseTitle}</legend>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-gray-500">{l.causeRacine}
          <select aria-label={l.causeRacine} value={value.causeRacine} onChange={e => set({ causeRacine: e.target.value })} className={`${inp} block mt-1 w-full`}>
            <option value="">—</option>{CAUSES_RACINE.map(c => <option key={c} value={c}>{causes[c]}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">{l.causeDetail}<input aria-label={l.causeDetail} value={value.causeDetail} maxLength={2000} onChange={e => set({ causeDetail: e.target.value })} className={`${inp} block mt-1 w-full`} /></label>
      </div>
      <label className="block text-xs text-gray-500">{l.lecons}<textarea aria-label={l.lecons} rows={2} value={value.leconsApprises} maxLength={4000} onChange={e => set({ leconsApprises: e.target.value })} className={`${inp} block mt-1 w-full`} /></label>

      <div>
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{l.chronoTitle}</p>
        <ul className="mt-1 space-y-1.5">
          {value.chronologie.map((e, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <select aria-label={`${l.chronoTitle} — événement ${i + 1}`} value={e.type} onChange={ev => set({ chronologie: value.chronologie.map((x, k) => (k === i ? { ...x, type: ev.target.value as EvenementChronologie['type'] } : x)) })} className={inp}>
                {TYPES_CHRONOLOGIE.map(x => <option key={x} value={x}>{chronoTypes[x]}</option>)}
              </select>
              <input type="datetime-local" aria-label={`${l.chronoDate} — événement ${i + 1}`} value={e.date.slice(0, 16)} onChange={ev => set({ chronologie: value.chronologie.map((x, k) => (k === i ? { ...x, date: ev.target.value } : x)) })} className={inp} />
              <input aria-label={`${l.chronoTexte} — événement ${i + 1}`} value={e.texte} maxLength={500} onChange={ev => set({ chronologie: value.chronologie.map((x, k) => (k === i ? { ...x, texte: ev.target.value } : x)) })} className={`${inp} flex-1 min-w-[10rem]`} />
              {!readOnly && <button type="button" aria-label={`${l.retirer} — événement ${i + 1}`} onClick={() => set({ chronologie: value.chronologie.filter((_, k) => k !== i) })} className="text-xs text-red-500 hover:underline">{l.retirer}</button>}
            </li>
          ))}
        </ul>
        {!readOnly && <button type="button" onClick={() => set({ chronologie: [...value.chronologie, { type: 'DETECTION', date: maintenant(), texte: '' }] })} className="mt-1 text-xs text-ebios-700 hover:underline">{l.chronoAdd}</button>}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{l.impactsTitle}</p>
        <ul className="mt-1 space-y-1.5">
          {value.impactsNonFinanciers.map((im, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <select aria-label={`${l.impactsTitle} — impact ${i + 1}`} value={im.unite} onChange={e => set({ impactsNonFinanciers: value.impactsNonFinanciers.map((x, k) => (k === i ? { ...x, unite: e.target.value } : x)) })} className={inp}>
                {UNITES_IMPACT.map(u => <option key={u} value={u}>{unites[u]}</option>)}
              </select>
              <input type="number" min="0" aria-label={`${l.impactValeur} — impact ${i + 1}`} value={im.valeur} onChange={e => set({ impactsNonFinanciers: value.impactsNonFinanciers.map((x, k) => (k === i ? { ...x, valeur: Number(e.target.value) } : x)) })} className={`${inp} w-28`} />
              {!readOnly && <button type="button" aria-label={`${l.retirer} — impact ${i + 1}`} onClick={() => set({ impactsNonFinanciers: value.impactsNonFinanciers.filter((_, k) => k !== i) })} className="text-xs text-red-500 hover:underline">{l.retirer}</button>}
            </li>
          ))}
        </ul>
        {!readOnly && <button type="button" onClick={() => { const dispo = UNITES_IMPACT.find(u => !value.impactsNonFinanciers.some(x => x.unite === u)) ?? 'AUTRE'; set({ impactsNonFinanciers: [...value.impactsNonFinanciers, { unite: dispo, valeur: 0 }] }) }} className="mt-1 text-xs text-ebios-700 hover:underline">{l.impactAdd}</button>}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{l.allocTitle}</p>
        <ul className="mt-1 space-y-1.5">
          {value.allocations.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input aria-label={`${l.allocEntite} — allocation ${i + 1}`} placeholder={l.allocEntite} value={a.entite} maxLength={120} onChange={e => set({ allocations: value.allocations.map((x, k) => (k === i ? { ...x, entite: e.target.value } : x)) })} className={`${inp} w-44`} />
              <input aria-label={`${l.allocLigne} — allocation ${i + 1}`} placeholder={l.allocLigne} value={a.ligneMetier ?? ''} maxLength={60} onChange={e => set({ allocations: value.allocations.map((x, k) => (k === i ? { ...x, ligneMetier: e.target.value || undefined } : x)) })} className={`${inp} w-44`} />
              <input type="number" min="0" max="100" step="0.01" aria-label={`${l.allocPct} — allocation ${i + 1}`} value={a.pct} onChange={e => set({ allocations: value.allocations.map((x, k) => (k === i ? { ...x, pct: Number(e.target.value) } : x)) })} className={`${inp} w-24`} />
              {!readOnly && <button type="button" aria-label={`${l.retirer} — allocation ${i + 1}`} onClick={() => set({ allocations: value.allocations.filter((_, k) => k !== i) })} className="text-xs text-red-500 hover:underline">{l.retirer}</button>}
            </li>
          ))}
        </ul>
        {value.allocations.length > 0 && <p role="status" className={`text-[11px] ${somme > 100 ? 'text-red-600' : 'text-gray-500'}`}>{somme > 100 ? l.errors.allocation_invalide : l.allocReste.replace('{pct}', String(reste))}</p>}
        {!readOnly && <button type="button" onClick={() => set({ allocations: [...value.allocations, { entite: '', pct: 0 }] })} className="mt-1 text-xs text-ebios-700 hover:underline">{l.allocAdd}</button>}
      </div>
    </fieldset>
  )
}
