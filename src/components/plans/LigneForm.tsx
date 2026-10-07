'use client'

// ─── Saisie d'une ligne de plan : prisme, cibles multiples, échantillonnage, période ─
// Cibles proposées par /api/plans/options (organisations du sous-arbre, tiers, risques, processus, référentiels ;
// exigences chargées à la demande). Validation finale côté serveur (lib/planification.cleanLigneInput).
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { METHODES_ECHANTILLON, PRISMES, STATUTS_MANUELS, type Prisme } from '@/lib/planification'

export interface Options {
  organisations: { id: string; nom: string }[]; tiers: { id: string; nom: string }[]; risques: { id: string; intitule: string }[]
  processus: { id: string; nom: string; criticite: number | null; criticiteDora: string | null }[]; referentiels: { code: string; nom: string }[]
}
export interface LigneSaisie {
  intitule: string; prisme: Prisme; debut: string; fin: string; charge: string; priorite: string; responsable: string; statutManuel: string
  cibles: { organisations: string[]; tiers: string[]; risques: string[]; processus: string[]; referentiel: { code: string; exigences: string[] } | null }
  echantillon: { methode: string; population: string; taille: string }
}

export const ligneVide = (prisme: Prisme): LigneSaisie => ({
  intitule: '', prisme, debut: '', fin: '', charge: '', priorite: '', responsable: '', statutManuel: '',
  cibles: { organisations: [], tiers: [], risques: [], processus: [], referentiel: null }, echantillon: { methode: '', population: '', taille: '' },
})

/** Liste à cocher filtrable (cibles multiples). */
function Multi({ label, items, valeur, onChange }: { label: string; items: { id: string; nom: string }[]; valeur: string[]; onChange: (v: string[]) => void }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const vus = items.filter(i => !q || i.nom.toLowerCase().includes(q.toLowerCase())).slice(0, 200)
  return (
    <details className="rounded border border-gray-200 dark:border-gray-700 p-2">
      <summary className="cursor-pointer text-xs text-gray-700 dark:text-gray-200">{label} — {t.plans.selectionnes.replace('{n}', String(valeur.length))}</summary>
      <input aria-label={`${label} : ${t.plans.rechercher}`} value={q} onChange={e => setQ(e.target.value)} placeholder={t.plans.rechercher} className="mt-2 w-full rounded-sm border border-gray-300 px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-600" />
      <div className="max-h-40 overflow-y-auto mt-1 space-y-0.5">
        {vus.map(i => (
          <label key={i.id} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={valeur.includes(i.id)} onChange={() => onChange(valeur.includes(i.id) ? valeur.filter(v => v !== i.id) : [...valeur, i.id])} />{i.nom}
          </label>
        ))}
      </div>
    </details>
  )
}

export default function LigneForm({ initial, options, annee, onSave, onCancel }: {
  initial: LigneSaisie; options: Options; annee: number; onSave: (l: LigneSaisie) => Promise<string | null>; onCancel: () => void
}) {
  const { t } = useTranslation()
  const p = t.plans
  const [l, setL] = useState<LigneSaisie>(initial)
  const [exigences, setExigences] = useState<{ ref: string; nom: string }[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const code = l.cibles.referentiel?.code ?? ''

  useEffect(() => {
    if (!code) { setExigences([]); return }
    fetch(`/api/plans/options?referentiel=${encodeURIComponent(code)}`).then(r => (r.ok ? r.json() : { exigences: [] })).then(d => setExigences(d.exigences ?? [])).catch(() => setExigences([]))
  }, [code])

  const cible = (k: 'organisations' | 'tiers' | 'risques' | 'processus') => (v: string[]) => setL(x => ({ ...x, cibles: { ...x.cibles, [k]: v } }))
  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'
  const borne = { min: `${annee}-01-01`, max: `${annee}-12-31` }

  return (
    <div className="card p-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="sm:col-span-2 text-xs text-gray-600 dark:text-gray-300">{p.intitule}
          <input aria-label={p.intitule} value={l.intitule} onChange={e => setL({ ...l, intitule: e.target.value })} className={champ} />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.prisme}
          <select aria-label={p.prisme} value={l.prisme} onChange={e => setL({ ...l, prisme: e.target.value as Prisme })} className={champ}>
            {PRISMES.map(pr => <option key={pr} value={pr}>{p.prismes[pr]}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-gray-700 dark:text-gray-200">{p.cibles}</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          <Multi label={p.organisations} items={options.organisations} valeur={l.cibles.organisations} onChange={cible('organisations')} />
          <Multi label={p.tiers} items={options.tiers} valeur={l.cibles.tiers} onChange={cible('tiers')} />
          <Multi label={p.risques} items={options.risques.map(r => ({ id: r.id, nom: r.intitule }))} valeur={l.cibles.risques} onChange={cible('risques')} />
          <Multi label={p.processus} items={options.processus.map(pr => ({ id: pr.id, nom: pr.criticite ? `${pr.nom} (${pr.criticite}/4)` : pr.nom }))} valeur={l.cibles.processus} onChange={cible('processus')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-300">{p.referentiel}
            <select aria-label={p.referentiel} value={code} onChange={e => setL({ ...l, cibles: { ...l.cibles, referentiel: e.target.value ? { code: e.target.value, exigences: [] } : null } })} className={champ}>
              <option value="">—</option>
              {options.referentiels.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}
            </select>
          </label>
          {code && <Multi label={p.exigences} items={exigences.map(e => ({ id: e.ref, nom: `${e.ref} — ${e.nom}` }))} valeur={l.cibles.referentiel?.exigences ?? []}
            onChange={v => setL(x => ({ ...x, cibles: { ...x.cibles, referentiel: { code, exigences: v } } }))} />}
        </div>
      </fieldset>
      <fieldset className="grid sm:grid-cols-3 gap-3">
        <legend className="text-xs font-medium text-gray-700 dark:text-gray-200 sm:col-span-3">{p.echantillon}</legend>
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.methode}
          <select aria-label={p.methode} value={l.echantillon.methode} onChange={e => setL({ ...l, echantillon: { ...l.echantillon, methode: e.target.value } })} className={champ}>
            <option value="">—</option>
            {METHODES_ECHANTILLON.map(m => <option key={m} value={m}>{p.methodes[m]}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.population}
          <input aria-label={p.population} type="number" min={1} value={l.echantillon.population} onChange={e => setL({ ...l, echantillon: { ...l.echantillon, population: e.target.value } })} className={champ} />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.taille}
          <input aria-label={p.taille} type="number" min={1} value={l.echantillon.taille} onChange={e => setL({ ...l, echantillon: { ...l.echantillon, taille: e.target.value } })} className={champ} />
        </label>
      </fieldset>
      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.debut}<input aria-label={p.debut} type="date" {...borne} value={l.debut} onChange={e => setL({ ...l, debut: e.target.value })} className={champ} /></label>
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.fin}<input aria-label={p.fin} type="date" {...borne} value={l.fin} onChange={e => setL({ ...l, fin: e.target.value })} className={champ} /></label>
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.charge}<input aria-label={p.charge} type="number" min={0} step={0.5} value={l.charge} onChange={e => setL({ ...l, charge: e.target.value })} className={champ} /></label>
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.priorite}
          <select aria-label={p.priorite} value={l.priorite} onChange={e => setL({ ...l, priorite: e.target.value })} className={champ}>
            <option value="">—</option>{['1', '2', '3', '4'].map(n => <option key={n} value={n}>{p.priorites[n as '1']}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.responsable}<input aria-label={p.responsable} value={l.responsable} onChange={e => setL({ ...l, responsable: e.target.value })} className={champ} /></label>
        <label className="text-xs text-gray-600 dark:text-gray-300">{p.statutManuel}
          <select aria-label={p.statutManuel} value={l.statutManuel} onChange={e => setL({ ...l, statutManuel: e.target.value })} className={champ}>
            <option value="">—</option>{STATUTS_MANUELS.map(s => <option key={s} value={s}>{p.statutsManuels[s]}</option>)}
          </select>
        </label>
      </div>
      {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={async () => setErreur(await onSave(l))} className="btn-primary text-sm">{p.enregistrer}</button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">{p.annuler}</button>
      </div>
    </div>
  )
}
