'use client'

// ─── Papiers de travail d'une mission d'audit ────────────────────────────────
// Documents internes de l'audit : préparés par un auditeur, revus par un AUTRE (supervision).

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { TYPES_PAPIER, type Papier } from '@/lib/papiers-travail'

const inp = 'px-2 py-1 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs w-full'
const VIDE = { type: 'TEST', titre: '', objectif: '', travaux: '', conclusion: '', reference: '' }
const BADGE: Record<string, string> = {
  BROUILLON: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  SOUMIS: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  REVU: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
}

export default function PapiersTravailPanel({ missionId, readOnly = false }: { missionId: string; readOnly?: boolean }) {
  const { t } = useTranslation()
  const l = t.auditInterne.l4
  const [papiers, setPapiers] = useState<Papier[] | null>(null)
  const [noms, setNoms] = useState<Record<string, string>>({})
  const [moi, setMoi] = useState('')
  const [form, setForm] = useState<typeof VIDE | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [commentaire, setCommentaire] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const err = (c: string) => (l.papierErrors as Record<string, string>)[c] ?? c

  const load = useCallback(() => {
    fetch(`/api/audit/missions/${missionId}/papiers`).then(r => (r.ok ? r.json() : null)).then(d => { if (d) { setPapiers(d.papiers); setNoms(d.utilisateurs ?? {}); setMoi(d.moi ?? '') } }).catch(() => setPapiers(null))
  }, [missionId])
  useEffect(() => { load() }, [load])

  async function agir(body: Record<string, unknown>) {
    setError(null)
    const res = await fetch(`/api/audit/missions/${missionId}/papiers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError(err(d.error ?? 'erreur')); return false }
    setForm(null); setEditId(null); load(); return true
  }
  if (papiers === null) return null
  const typeLabel = (x: string) => (l.papierTypes as Record<string, string>)[x] ?? x
  const btn = 'text-xs text-ebios-700 hover:underline'

  return (
    <section aria-label={l.papiersTitle} className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-600 dark:text-gray-300">{l.papiersTitle} ({papiers.length})</p>
        {!readOnly && !form && <button type="button" onClick={() => { setForm(VIDE); setEditId(null) }} className="btn-secondary text-xs">{l.papierAdd}</button>}
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {form && (
        <div className="space-y-1.5 rounded-sm border border-gray-200 p-2 dark:border-gray-700">
          <select aria-label={l.papierType} className={inp} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {TYPES_PAPIER.map(x => <option key={x} value={x}>{typeLabel(x)}</option>)}
          </select>
          <input aria-label={l.papierTitre} placeholder={l.papierTitre} className={inp} maxLength={200} value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} />
          <input aria-label={l.papierObjectif} placeholder={l.papierObjectif} className={inp} maxLength={1000} value={form.objectif} onChange={e => setForm({ ...form, objectif: e.target.value })} />
          <textarea aria-label={l.papierTravaux} placeholder={l.papierTravaux} className={inp} rows={4} maxLength={10000} value={form.travaux} onChange={e => setForm({ ...form, travaux: e.target.value })} />
          <textarea aria-label={l.papierConclusion} placeholder={l.papierConclusion} className={inp} rows={2} maxLength={4000} value={form.conclusion} onChange={e => setForm({ ...form, conclusion: e.target.value })} />
          <input aria-label={l.papierReference} placeholder={l.papierReference} className={inp} maxLength={300} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
          <div className="flex gap-3">
            <button type="button" className="btn-primary text-xs" onClick={() => agir(editId ? { action: 'MODIFIER', id: editId, data: form } : { action: 'AJOUTER', data: form })}>{t.auditInterne.save}</button>
            <button type="button" className={btn} onClick={() => { setForm(null); setEditId(null) }}>{l.papierAnnuler}</button>
          </div>
        </div>
      )}
      {papiers.length === 0 && !form && <p className="text-gray-400">{l.papiersVide}</p>}
      <ul className="space-y-2">
        {papiers.map(p => {
          const mien = p.preparePar === moi
          return (
            <li key={p.id} className="rounded-sm border border-gray-200 p-2 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-800 dark:text-gray-100">{p.titre}</span>
                <span className="text-gray-400">{typeLabel(p.type)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[p.statut]}`}>{(l.papierStatuts as Record<string, string>)[p.statut]}</span>
                <span className="text-gray-400">{l.papierPrepare} {noms[p.preparePar] ?? '—'}{p.revuePar ? ` · ${l.papierRevu} ${noms[p.revuePar] ?? '—'}` : ''}</span>
              </div>
              {p.objectif && <p className="mt-1 text-gray-500">{p.objectif}</p>}
              {p.travaux && <p className="mt-1 whitespace-pre-line text-gray-700 dark:text-gray-200">{p.travaux}</p>}
              {p.conclusion && <p className="mt-1 font-medium text-gray-700 dark:text-gray-200">{p.conclusion}</p>}
              {p.reference && <p className="mt-1 text-gray-400">{l.papierReference} : {p.reference}</p>}
              {p.revueCommentaire && <p className="mt-1 italic text-amber-700 dark:text-amber-300">{p.revueCommentaire}</p>}
              {!readOnly && (
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  {p.statut === 'BROUILLON' && mien && <>
                    <button type="button" className={btn} onClick={() => { setEditId(p.id); setForm({ type: p.type, titre: p.titre, objectif: p.objectif ?? '', travaux: p.travaux, conclusion: p.conclusion ?? '', reference: p.reference ?? '' }) }}>{l.papierModifier}</button>
                    <button type="button" className={btn} onClick={() => agir({ action: 'SOUMETTRE', id: p.id })}>{l.papierSoumettre}</button>
                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => { if (confirm(`${l.papierSupprimer} ?`)) agir({ action: 'SUPPRIMER', id: p.id }) }}>{l.papierSupprimer}</button>
                  </>}
                  {p.statut === 'SOUMIS' && !mien && <>
                    <input aria-label={`${l.papierCommentaire} — ${p.titre}`} placeholder={l.papierCommentaire} className={`${inp} max-w-xs`} value={commentaire[p.id] ?? ''} onChange={e => setCommentaire(c => ({ ...c, [p.id]: e.target.value }))} />
                    <button type="button" className={btn} onClick={() => agir({ action: 'REVOIR', id: p.id, commentaire: commentaire[p.id] })}>{l.papierRevoir}</button>
                    <button type="button" className={btn} onClick={() => agir({ action: 'RENVOYER', id: p.id, commentaire: commentaire[p.id] })}>{l.papierRenvoyer}</button>
                  </>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
