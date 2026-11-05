'use client'
// Points d'accès (URL / hôte) d'un usage de service TIC : liste, ajout, suppression (gestionnaires du registre TIC).
// Cartographie déclarative : ACRA ne contacte jamais ces adresses (cf. lib/tier-endpoints). i18n ×5 (t.pointsAcces).
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { AUTHENTIFICATIONS, ENVIRONNEMENTS, TYPES_POINT_ACCES } from '@/lib/tier-endpoints'

export type PointAcces = { id: string; adresse: string; hote: string; type: string; environnement: string | null; authentification: string | null; commentaire: string | null }
const VIDE = { adresse: '', type: 'WEB', environnement: '', authentification: '' }

export default function PointsAccesUsage({ usageId, usageNom, points, canManage, hotesPartages, onChange }: {
  usageId: string; usageNom: string; points: PointAcces[]; canManage: boolean
  /** Nombre d'AUTRES usages qui déclarent le même hôte (repérage des concentrations). */
  hotesPartages?: Record<string, number>
  onChange: () => void
}) {
  const { t } = useTranslation()
  const l = t.pointsAcces
  const [form, setForm] = useState(VIDE)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const libelle = (m: Record<string, string>, k: string | null) => (k ? m[k] ?? k : '')

  async function appeler(url: string, method: string, body?: object) {
    setBusy(true); setErreur(null)
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setBusy(false)
    if (!r?.ok) { setErreur((l.erreurs as Record<string, string>)[d.error] ?? l.erreurs.echec); return false }
    onChange(); return true
  }

  return (
    <details className="basis-full text-xs">
      <summary className="cursor-pointer text-gray-700 dark:text-gray-200">{l.resume.replace('{n}', String(points.length))}</summary>
      <div className="mt-1 space-y-1 rounded-sm border border-gray-100 p-2 dark:border-gray-800">
        <p className="text-gray-500 dark:text-gray-400">{l.aide}</p>
        {points.length === 0 && <p className="text-gray-600 dark:text-gray-300">{l.aucun}</p>}
        <ul className="space-y-1" aria-label={`${l.titre} — ${usageNom}`}>
          {points.map(p => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded-sm bg-gray-100 px-1 dark:bg-gray-800">{p.adresse}</code>
              <span>{libelle(l.types, p.type)}</span>
              {p.environnement && <span className="rounded-full bg-gray-100 px-2 dark:bg-gray-800">{libelle(l.environnements, p.environnement)}</span>}
              {p.authentification && <span className="rounded-full bg-gray-100 px-2 dark:bg-gray-800">{libelle(l.authentifications, p.authentification)}</span>}
              {(hotesPartages?.[p.hote] ?? 0) > 0 && <span className="rounded-full bg-amber-100 px-2 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{l.memeHote.replace('{n}', String(hotesPartages![p.hote]))}</span>}
              {p.commentaire && <span className="text-gray-500">— {p.commentaire}</span>}
              {canManage && <button type="button" className="btn-secondary px-2 py-0.5" disabled={busy} aria-label={l.supprimer.replace('{adresse}', p.adresse)} onClick={() => void appeler(`/api/tier-registry/usages/${usageId}/points-acces/${p.id}`, 'DELETE')}>✕</button>}
            </li>
          ))}
        </ul>
        {canManage && (
          <form className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end" onSubmit={e => { e.preventDefault(); void appeler(`/api/tier-registry/usages/${usageId}/points-acces`, 'POST', form).then(ok => { if (ok) setForm(VIDE) }) }}>
            <label>{l.adresse}<input aria-label={l.adresse} className="input mt-1 block w-full text-xs" value={form.adresse} maxLength={2048} placeholder="https://… / sftp.exemple.fr" onChange={e => setForm({ ...form, adresse: e.target.value })} /></label>
            <label>{l.type}<select aria-label={l.type} className="input mt-1 block w-full text-xs" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{TYPES_POINT_ACCES.map(k => <option key={k} value={k}>{libelle(l.types, k)}</option>)}</select></label>
            <label>{l.environnement}<select aria-label={l.environnement} className="input mt-1 block w-full text-xs" value={form.environnement} onChange={e => setForm({ ...form, environnement: e.target.value })}><option value="">{l.nonRenseigne}</option>{ENVIRONNEMENTS.map(k => <option key={k} value={k}>{libelle(l.environnements, k)}</option>)}</select></label>
            <label>{l.authentification}<select aria-label={l.authentification} className="input mt-1 block w-full text-xs" value={form.authentification} onChange={e => setForm({ ...form, authentification: e.target.value })}><option value="">{l.nonRenseigne}</option>{AUTHENTIFICATIONS.map(k => <option key={k} value={k}>{libelle(l.authentifications, k)}</option>)}</select></label>
            <button type="submit" className="btn-secondary text-xs" disabled={busy || !form.adresse.trim()}>{l.ajouter}</button>
          </form>
        )}
        {erreur && <p role="alert" className="text-red-700 dark:text-red-300">{erreur}</p>}
      </div>
    </details>
  )
}
