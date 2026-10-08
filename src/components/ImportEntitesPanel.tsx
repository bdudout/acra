'use client'

// ─── Import vers le référentiel des entités (consolidation, lot E2) ───────────
// Fichier CSV / XLSX ou connecteur → aperçu des écarts (nouvelles, renommées, déjà présentes, doublons probables,
// rejetées, disparues) → application des choix de l'administrateur. API : /api/referentiel-entites/import.
import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { toBase64 } from '@/lib/fichier-base64'
import { TYPES_ENTITE, type TypeEntite } from '@/lib/entites'
import type { LignePlanifiee, StatutImport } from '@/lib/entites-import'

interface Apercu { lignes: LignePlanifiee[]; compte: Record<StatutImport, number>; disparues: { id: string; nom: string }[] }
const ORDRE: StatutImport[] = ['NOUVELLE', 'RENOMMEE', 'DOUBLON_PROBABLE', 'REJETEE', 'INCHANGEE']

export default function ImportEntitesPanel({ connecteur, existantes, onTermine, onFermer }: {
  connecteur: boolean; existantes: { id: string; nom: string }[]; onTermine: () => void; onFermer: () => void
}) {
  const { t } = useTranslation()
  const r = t.entites.referentiel.import
  const [fichier, setFichier] = useState<{ name: string; data: string } | null>(null)
  const [origine, setOrigine] = useState<'FICHIER' | 'CONNECTEUR'>('FICHIER')
  const [typeParDefaut, setTypeParDefaut] = useState<TypeEntite>('DIRECTION')
  const [listeComplete, setListeComplete] = useState(false)
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [quandMeme, setQuandMeme] = useState<number[]>([])
  const [renommer, setRenommer] = useState<string[]>([])
  const [clore, setClore] = useState<string[]>([])
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [resultat, setResultat] = useState<string | null>(null)
  const nomDe = new Map(existantes.map(e => [e.id, e.nom]))
  const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter(x => x !== v) : [...liste, v])

  async function appeler(o: 'FICHIER' | 'CONNECTEUR', dryRun: boolean) {
    setOccupe(true); setErreur(null)
    const corps = { origine: o, typeParDefaut, listeComplete, ...(o === 'FICHIER' && fichier ? { filename: fichier.name, data: fichier.data } : {}),
      ...(dryRun ? { dryRun: true } : { creerQuandMeme: quandMeme, renommer, clore }) }
    const res = await fetch('/api/referentiel-entites/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }).catch(() => null)
    const j = res ? await res.json().catch(() => ({})) : {}
    setOccupe(false)
    if (!res?.ok) { setErreur((r.erreurs as Record<string, string>)[j.error] ?? r.erreurs.defaut); return }
    if (dryRun) {
      const a = j as Apercu
      setOrigine(o); setApercu(a); setResultat(null); setQuandMeme([]); setClore([])
      setRenommer(a.lignes.filter(l => l.statut === 'RENOMMEE').map(l => l.entiteId!)) // renommages retenus par défaut
      return
    }
    setApercu(null)
    setResultat(r.resultat.replace('{c}', String(j.crees ?? 0)).replace('{r}', String(j.renommees ?? 0)).replace('{f}', String(j.closes ?? 0)))
    onTermine()
  }

  const detail = (l: LignePlanifiee) => {
    if (l.statut === 'REJETEE' && l.raison) return r.raisons[l.raison]
    if (l.statut === 'RENOMMEE' && l.ancienNom) return r.ancienNom.replace('{n}', l.ancienNom)
    if (l.statut === 'DOUBLON_PROBABLE') return r.procheDe.replace('{n}', l.entiteId ? nomDe.get(l.entiteId) ?? '' : apercu?.lignes.find(x => x.line === l.doublonDeLigne)?.nom ?? '')
    return null
  }
  const aAppliquer = apercu ? apercu.compte.NOUVELLE + quandMeme.length + renommer.length + clore.length : 0
  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

  return (
    <div className="rounded-sm border border-gray-200 dark:border-gray-700 p-3 space-y-3" aria-label={r.titre} role="region">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{r.titre}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.aide}</p>
        </div>
        <button type="button" onClick={onFermer} aria-label={r.fermer} className="p-1 text-gray-500"><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-gray-600 dark:text-gray-300">{r.fichier}
          <input aria-label={r.fichier} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className={champ}
            onChange={async ev => { const f = ev.target.files?.[0]; setApercu(null); setFichier(f ? { name: f.name, data: await toBase64(f) } : null) }} />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">{r.typeParDefaut}
          <select aria-label={r.typeParDefaut} value={typeParDefaut} onChange={ev => setTypeParDefaut(ev.target.value as TypeEntite)} className={champ}>
            {TYPES_ENTITE.map(ty => <option key={ty} value={ty}>{t.entites.referentiel.types[ty]}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={listeComplete} onChange={ev => setListeComplete(ev.target.checked)} />{r.listeComplete}
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={occupe || !fichier} onClick={() => appeler('FICHIER', true)} className="btn-secondary text-sm inline-flex items-center gap-1.5"><Upload size={14} aria-hidden="true" />{r.apercu}</button>
        {connecteur && <button type="button" disabled={occupe} onClick={() => appeler('CONNECTEUR', true)} className="btn-secondary text-sm">{r.depuisConnecteur}</button>}
      </div>
      {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
      {resultat && <p role="status" className="text-sm text-green-700 dark:text-green-300">{resultat}</p>}

      {apercu && (
        <div className="space-y-3">
          {ORDRE.filter(s => apercu.compte[s] > 0).map(s => (
            <section key={s}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{r.statuts[s]} ({apercu.compte[s]})</h4>
              <ul className="mt-1 space-y-0.5">
                {apercu.lignes.filter(l => l.statut === s).map(l => (
                  <li key={l.line} className="text-sm text-gray-700 dark:text-gray-200 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-gray-400">{r.ligne.replace('{n}', String(l.line))}</span>
                    <span>{l.nom || '—'}</span>
                    {detail(l) && <span className="text-xs text-gray-500">({detail(l)})</span>}
                    {s === 'DOUBLON_PROBABLE' && (
                      <label className="text-xs text-ebios-700 dark:text-ebios-300 flex items-center gap-1">
                        <input type="checkbox" aria-label={`${r.creerQuandMeme} — ${l.nom}`} checked={quandMeme.includes(l.line)} onChange={() => setQuandMeme(basculer(quandMeme, l.line))} />{r.creerQuandMeme}
                      </label>
                    )}
                    {s === 'RENOMMEE' && (
                      <label className="text-xs text-ebios-700 dark:text-ebios-300 flex items-center gap-1">
                        <input type="checkbox" aria-label={`${r.appliquerRenommage} — ${l.nom}`} checked={renommer.includes(l.entiteId!)} onChange={() => setRenommer(basculer(renommer, l.entiteId!))} />{r.appliquerRenommage}
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {apercu.disparues.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{r.disparues} ({apercu.disparues.length})</h4>
              <ul className="mt-1 space-y-0.5">
                {apercu.disparues.map(d => (
                  <li key={d.id} className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <span>{d.nom}</span>
                    <label className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <input type="checkbox" aria-label={`${r.clore} — ${d.nom}`} checked={clore.includes(d.id)} onChange={() => setClore(basculer(clore, d.id))} />{r.clore}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {aAppliquer === 0
            ? <p className="text-sm italic text-gray-400">{r.aucunChangement}</p>
            : <button type="button" disabled={occupe} onClick={() => appeler(origine, false)} className="btn-primary text-sm">{r.appliquer}</button>}
        </div>
      )}
    </div>
  )
}
