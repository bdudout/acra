'use client'

// ─── Réorganisation d'une entité (consolidation, lot E4) ──────────────────────
// Renommer, fusionner, scinder ou clore une entité à une date d'effet ; les objets rattachés et sous-entités suivent
// (cf. lib/entites-reorganisation). API : POST /api/referentiel-entites/reorganisations.
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { TYPES_ENTITE, type TypeEntite } from '@/lib/entites'
import { TYPES_REORGANISATION, type TypeReorganisation } from '@/lib/entites-reorganisation'

const NOUVELLE = '__nouvelle__'
type Ref = { id: string; nom: string }

export default function ReorganisationEntitePanel({ entite, entites, onTermine, onAnnuler }: {
  entite: Ref; entites: Ref[]; onTermine: () => void; onAnnuler: () => void
}) {
  const { t } = useTranslation()
  const r = t.entites.referentiel.reorganisation
  const types = t.entites.referentiel.types
  const [type, setType] = useState<TypeReorganisation>('RENOMMAGE')
  const [dateEffet, setDateEffet] = useState(new Date().toISOString().slice(0, 10))
  const [nouveauNom, setNouveauNom] = useState(entite.nom)
  const [avec, setAvec] = useState<string[]>([])
  const [cible, setCible] = useState<string>(entite.id)
  const [nouvelle, setNouvelle] = useState<{ nom: string; type: TypeEntite }>({ nom: '', type: 'DIRECTION' })
  const [nouvelles, setNouvelles] = useState<{ nom: string; type: TypeEntite }[]>([{ nom: '', type: 'DIRECTION' }])
  const [repreneur, setRepreneur] = useState('')
  const [successeur, setSuccesseur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const autres = entites.filter(e => e.id !== entite.id)

  function corps() {
    const base = { type, dateEffet, sources: type === 'FUSION' ? [entite.id, ...avec] : [entite.id] }
    switch (type) {
      case 'RENOMMAGE': return { ...base, nouveauNom }
      case 'FUSION': return { ...base, cible: cible === NOUVELLE ? nouvelle : { id: cible } }
      case 'SCISSION': return { ...base, nouvelles, repreneur: repreneur === '' ? null : Number(repreneur) }
      case 'CLOTURE': return { ...base, successeur: successeur || null }
    }
  }
  async function valider() {
    setOccupe(true); setErreur(null)
    const res = await fetch('/api/referentiel-entites/reorganisations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps()) }).catch(() => null)
    const j = res ? await res.json().catch(() => ({})) : {}
    setOccupe(false)
    if (!res?.ok) { setErreur((r.erreurs as Record<string, string>)[j.error] ?? r.erreurs.defaut); return }
    onTermine()
  }

  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'
  const label = 'text-xs text-gray-600 dark:text-gray-300'
  const typeSelect = (valeur: TypeEntite, onChange: (v: TypeEntite) => void, aria: string) => (
    <select aria-label={aria} value={valeur} onChange={ev => onChange(ev.target.value as TypeEntite)} className={champ}>
      {TYPES_ENTITE.map(ty => <option key={ty} value={ty}>{types[ty]}</option>)}
    </select>
  )

  return (
    <div className="rounded-sm border border-ebios-200 dark:border-ebios-700 bg-ebios-50/40 dark:bg-ebios-500/5 p-3 space-y-3" role="region" aria-label={r.titre.replace('{n}', entite.nom)}>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{r.titre.replace('{n}', entite.nom)}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className={label}>{r.type}
          <select aria-label={r.type} value={type} onChange={ev => { setType(ev.target.value as TypeReorganisation); setErreur(null) }} className={champ}>
            {TYPES_REORGANISATION.map(ty => <option key={ty} value={ty}>{r.types[ty]}</option>)}
          </select>
        </label>
        <label className={label}>{r.dateEffet}
          <input aria-label={r.dateEffet} type="date" value={dateEffet} onChange={ev => setDateEffet(ev.target.value)} className={champ} />
        </label>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{r.aides[type]}</p>

      {type === 'RENOMMAGE' && (
        <label className={`${label} block`}>{r.nouveauNom}
          <input aria-label={r.nouveauNom} value={nouveauNom} onChange={ev => setNouveauNom(ev.target.value)} className={champ} />
        </label>
      )}

      {type === 'FUSION' && (
        <div className="space-y-2">
          <fieldset>
            <legend className={label}>{r.fusionnerAvec}</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {autres.map(e => (
                <label key={e.id} className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <input type="checkbox" checked={avec.includes(e.id)} onChange={() => setAvec(avec.includes(e.id) ? avec.filter(x => x !== e.id) : [...avec, e.id])} />{e.nom}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className={label}>{r.resultat}
              <select aria-label={r.resultat} value={cible} onChange={ev => setCible(ev.target.value)} className={champ}>
                {[entite, ...autres.filter(e => avec.includes(e.id))].map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                <option value={NOUVELLE}>{r.nouvelleEntite}</option>
              </select>
            </label>
            {cible === NOUVELLE && (
              <label className={label}>{r.nomNouvelle}
                <input aria-label={r.nomNouvelle} value={nouvelle.nom} onChange={ev => setNouvelle({ ...nouvelle, nom: ev.target.value })} className={champ} />
              </label>
            )}
          </div>
          {cible === NOUVELLE && <div className="sm:w-1/2">{typeSelect(nouvelle.type, v => setNouvelle({ ...nouvelle, type: v }), `${t.entites.referentiel.type} — ${r.nouvelleEntite}`)}</div>}
        </div>
      )}

      {type === 'SCISSION' && (
        <div className="space-y-2">
          <p className={label}>{r.nouvelles}</p>
          {nouvelles.map((n, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input aria-label={`${r.nouvelles} ${i + 1}`} value={n.nom} onChange={ev => setNouvelles(nouvelles.map((x, j) => (j === i ? { ...x, nom: ev.target.value } : x)))} className={champ} />
              {typeSelect(n.type, v => setNouvelles(nouvelles.map((x, j) => (j === i ? { ...x, type: v } : x))), `${t.entites.referentiel.type} ${i + 1}`)}
            </div>
          ))}
          <button type="button" onClick={() => setNouvelles([...nouvelles, { nom: '', type: 'DIRECTION' }])} className="text-xs text-ebios-700 dark:text-ebios-300 inline-flex items-center gap-1"><Plus size={12} aria-hidden="true" />{r.ajouterNouvelle}</button>
          <label className={`${label} block`}>{r.repreneur}
            <select aria-label={r.repreneur} value={repreneur} onChange={ev => setRepreneur(ev.target.value)} className={champ}>
              <option value="">{r.conserverSource}</option>
              {nouvelles.map((n, i) => <option key={i} value={String(i)}>{n.nom || `${r.nouvelles} ${i + 1}`}</option>)}
            </select>
          </label>
        </div>
      )}

      {type === 'CLOTURE' && (
        <label className={`${label} block`}>{r.successeur}
          <select aria-label={r.successeur} value={successeur} onChange={ev => setSuccesseur(ev.target.value)} className={champ}>
            <option value="">{r.aucunSuccesseur}</option>
            {autres.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        </label>
      )}

      {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={occupe} onClick={valider} className="btn-primary text-sm">{r.valider}</button>
        <button type="button" onClick={onAnnuler} className="btn-secondary text-sm">{r.annuler}</button>
      </div>
    </div>
  )
}
