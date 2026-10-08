'use client'

// ─── Rapprochement des textes libres « entité » (consolidation, lot E3) ───────
// Valeurs saisies à la main et pas encore liées au référentiel → entité choisie (identique présélectionnée, proche
// seulement suggérée) ou créée → application par lot. API : /api/referentiel-entites/rapprochement.
import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { TYPES_ENTITE, type TypeEntite } from '@/lib/entites'
import { SOURCES_TEXTE, type Proposition } from '@/lib/entites-rapprochement'

const CREER = '__creer__'
type Choix = Record<string, { cible: string; type: TypeEntite }>
// Correspondances identiques présélectionnées ; les proches restent seulement suggérées.
const exactes = (ps: Proposition[]): Choix => Object.fromEntries(ps.filter(p => p.niveau === 'EXACTE' && p.suggestion).map(p => [p.valeur, { cible: p.suggestion!.id, type: 'DIRECTION' as TypeEntite }]))

export default function RapprochementEntitesPanel({ entites, onTermine, onFermer }: {
  entites: { id: string; nom: string }[]; onTermine: () => void; onFermer: () => void
}) {
  const { t } = useTranslation()
  const r = t.entites.referentiel.rapprochement
  const [propositions, setPropositions] = useState<Proposition[] | null>(null)
  const [choix, setChoix] = useState<Choix>({})
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [resultat, setResultat] = useState<string | null>(null)

  const charger = useCallback(() => fetch('/api/referentiel-entites/rapprochement').then(x => (x.ok ? x.json() : { propositions: [] }))
    .then((j: { propositions: Proposition[] }) => { setPropositions(j.propositions); setChoix(exactes(j.propositions)) }).catch(() => setPropositions([])), [])
  useEffect(() => { charger() }, [charger])

  const decisions = Object.entries(choix).filter(([, c]) => c.cible)
    .map(([valeur, c]) => (c.cible === CREER ? { valeur, creer: c.type } : { valeur, entiteId: c.cible }))

  async function appliquer() {
    setOccupe(true); setErreur(null)
    const res = await fetch('/api/referentiel-entites/rapprochement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decisions }) }).catch(() => null)
    const j = res ? await res.json().catch(() => ({})) : {}
    setOccupe(false)
    if (!res?.ok) { setErreur((r.erreurs as Record<string, string>)[j.error] ?? r.erreurs.defaut); return }
    setResultat(r.resultat.replace('{l}', String(j.liens ?? 0)).replace('{c}', String(j.creees ?? 0)).replace('{o}', String(j.objets ?? 0)))
    onTermine()
    charger()
  }

  const champ = 'block w-full rounded-sm border border-gray-300 bg-white px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600'
  const badge = { EXACTE: 'text-green-700 dark:text-green-300', PROCHE: 'text-amber-700 dark:text-amber-300', AUCUNE: 'text-gray-400' } as const

  return (
    <div className="rounded-sm border border-gray-200 dark:border-gray-700 p-3 space-y-3" role="region" aria-label={r.titre}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{r.titre}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.aide}</p>
        </div>
        <button type="button" onClick={onFermer} aria-label={r.fermer} className="p-1 text-gray-500"><X size={16} aria-hidden="true" /></button>
      </div>
      {resultat && <p role="status" className="text-sm text-green-700 dark:text-green-300">{resultat}</p>}
      {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
      {!propositions ? <p className="text-sm text-gray-400">…</p> : propositions.length === 0 ? <p className="text-sm italic text-gray-400">{r.rien}</p> : (
        <>
          <button type="button" onClick={() => setChoix({ ...choix, ...exactes(propositions) })} className="text-xs text-ebios-700 dark:text-ebios-300 underline">{r.toutesExactes}</button>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="py-1 pr-2 font-medium">{r.valeur}</th><th className="py-1 pr-2 font-medium">{r.occurrences}</th><th className="py-1 font-medium">{r.correspondance}</th>
                </tr>
              </thead>
              <tbody>
                {propositions.map(p => {
                  const c = choix[p.valeur] ?? { cible: '', type: 'DIRECTION' as TypeEntite }
                  const maj = (x: Partial<typeof c>) => setChoix({ ...choix, [p.valeur]: { ...c, ...x } })
                  const suggerees = [p.suggestion, ...p.autres].filter((s): s is NonNullable<typeof s> => !!s)
                  const autres = entites.filter(e => !suggerees.some(s => s.id === e.id))
                  return (
                    <tr key={p.valeur} className="border-t border-gray-100 dark:border-gray-700 align-top">
                      <td className="py-1.5 pr-2 text-gray-900 dark:text-gray-100">{p.valeur}<span className={`block text-[11px] ${badge[p.niveau]}`}>{r.niveaux[p.niveau]}</span></td>
                      <td className="py-1.5 pr-2 text-xs text-gray-500 dark:text-gray-400">{SOURCES_TEXTE.filter(s => p.occurrences[s]).map(s => `${p.occurrences[s]} ${r.sources[s]}`).join(' · ')}</td>
                      <td className="py-1.5 space-y-1">
                        <select aria-label={`${r.correspondance} — ${p.valeur}`} value={c.cible} onChange={ev => maj({ cible: ev.target.value })} className={champ}>
                          <option value="">{r.ignorer}</option>
                          {suggerees.map(s => <option key={s.id} value={s.id}>{s.nom} ({Math.round(s.score * 100)} %)</option>)}
                          {autres.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                          <option value={CREER}>{r.creer.replace('{v}', p.valeur)}</option>
                        </select>
                        {c.cible === CREER && (
                          <select aria-label={`${r.typeCreation} — ${p.valeur}`} value={c.type} onChange={ev => maj({ type: ev.target.value as TypeEntite })} className={champ}>
                            {TYPES_ENTITE.map(ty => <option key={ty} value={ty}>{t.entites.referentiel.types[ty]}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={occupe || decisions.length === 0} onClick={appliquer} className="btn-primary text-sm">{r.appliquer.replace('{n}', String(decisions.length))}</button>
        </>
      )}
    </div>
  )
}
