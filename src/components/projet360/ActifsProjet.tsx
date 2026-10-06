'use client'
// ─── Données et services d'un projet 360 et leur criticité (phase 2) ──────────
// Tableau éditable (intitulé, nature donnée / service, criticité 1 à 4) enregistré via /api/analyses/[id]/actifs-projet ;
// import des valeurs métier d'une analyse cyber trouvée par recherche (liste légère de /import-cyber), sans écraser
// une ligne saisie. Logique pure : lib/actifs-projet.

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { ACTIF_TYPES, CRITICITE_MAX, type ActifProjet } from '@/lib/actifs-projet'

const field = 'rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600'
let n = 0
const idLigne = () => `ap${Date.now().toString(36)}${(n++).toString(36)}`

export default function ActifsProjet({ analyseId, editable }: { analyseId: string; editable: boolean }) {
  const { t } = useTranslation()
  const a = t.projet360.actifs
  const p = t.projet360
  const types = a.types as Record<string, string>
  const niveaux = a.niveaux as readonly string[]
  const [actifs, setActifs] = useState<ActifProjet[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sources, setSources] = useState<{ id: string; nom: string }[] | null>(null)
  const [source, setSource] = useState('')
  const base = `/api/analyses/${analyseId}/actifs-projet`

  useEffect(() => {
    fetch(base, { cache: 'no-store' }).then(r => (r.ok ? r.json() : { actifs: [] })).then(d => setActifs(d.actifs ?? [])).catch(() => setActifs([]))
  }, [base])
  // Recherche des analyses cyber sources (même liste légère que l'import de risques), à la saisie.
  useEffect(() => {
    if (!editable || !q.trim()) return
    const h = setTimeout(() => {
      fetch(`/api/analyses/${analyseId}/import-cyber?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : { sources: [] })).then(d => setSources(d.sources ?? [])).catch(() => setSources([]))
    }, 250)
    return () => clearTimeout(h)
  }, [q, analyseId, editable])

  const maj = (id: string, patch: Partial<ActifProjet>) => { setActifs(l => (l ?? []).map(x => (x.id === id ? { ...x, ...patch } : x))); setMsg(null) }
  async function enregistrer() {
    const res = await fetch(base, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actifs: (actifs ?? []).filter(x => x.nom.trim()) }) }).catch(() => null)
    if (!res?.ok) { setMsg(a.erreur); return }
    setActifs((await res.json()).actifs); setMsg(a.enregistre)
  }
  async function importer() {
    const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceAnalyseId: source }) }).catch(() => null)
    if (!res?.ok) { setMsg(a.erreur); return }
    const d = await res.json()
    setActifs(d.actifs); setMsg(d.ajoutes ? a.importes.replace('{n}', String(d.ajoutes)) : a.aucunImport)
  }

  if (actifs == null) return null
  return (
    <section className="card mb-5 p-6">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{a.title}</h2>
      <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">{a.intro}</p>
      {actifs.length === 0 ? <p className="mb-3 text-sm italic text-gray-400">{a.vide}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-700">
              <th className="py-2 pr-2">{a.nom}</th><th className="py-2 pr-2">{a.nature}</th><th className="py-2 pr-2">{a.criticite}</th><th className="py-2 pr-2">{a.source}</th>{editable && <th className="py-2"><span className="sr-only">{a.retirer}</span></th>}
            </tr></thead>
            <tbody>
              {actifs.map(x => (
                <tr key={x.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 pr-2"><input aria-label={a.nom} value={x.nom} disabled={!editable} maxLength={200} onChange={e => maj(x.id, { nom: e.target.value })} className={`${field} w-full min-w-[12rem]`} /></td>
                  <td className="py-1.5 pr-2">
                    <select aria-label={a.nature} value={x.type} disabled={!editable} onChange={e => maj(x.id, { type: e.target.value as ActifProjet['type'] })} className={field}>
                      {ACTIF_TYPES.map(k => <option key={k} value={k}>{types[k]}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <select aria-label={a.criticite} value={x.criticite} disabled={!editable} onChange={e => maj(x.id, { criticite: Number(e.target.value) })} className={field}>
                      {Array.from({ length: CRITICITE_MAX }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c} · {niveaux[c - 1]}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2 text-xs text-gray-500">{x.source ?? ''}</td>
                  {editable && <td className="py-1.5"><button type="button" aria-label={`${a.retirer} — ${x.nom}`} onClick={() => setActifs(l => (l ?? []).filter(y => y.id !== x.id))} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} aria-hidden="true" /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editable && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setActifs(l => [...(l ?? []), { id: idLigne(), nom: '', type: 'SERVICE', criticite: 2 }])} className="btn-secondary inline-flex items-center gap-1 text-sm"><Plus size={14} aria-hidden="true" />{a.ajouter}</button>
            <button type="button" onClick={enregistrer} className="btn-primary text-sm">{a.enregistrer}</button>
            {msg && <span role="status" className="text-xs text-gray-600 dark:text-gray-300">{msg}</span>}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
            <h3 className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">{a.importTitre}</h3>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-gray-600 dark:text-gray-300">{p.importSearch}
                <input aria-label={p.importSearch} type="search" value={q} placeholder={p.importSearchPlaceholder} onChange={e => setQ(e.target.value)} className={`${field} mt-1 block w-60`} />
              </label>
              {sources && (sources.length === 0 ? <p className="text-xs italic text-gray-400">{p.importNoMatch}</p> : (
                <label className="text-xs text-gray-600 dark:text-gray-300">{a.source2}
                  <select aria-label={a.source2} value={source} onChange={e => setSource(e.target.value)} className={`${field} mt-1 block`}>
                    <option value="">—</option>
                    {sources.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </label>
              ))}
              <button type="button" disabled={!source} onClick={importer} className="btn-secondary text-sm disabled:opacity-50">{a.importer}</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
