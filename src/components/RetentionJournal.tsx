'use client'
// Rétention du journal d'audit (super-administrateur) : durée en mois (vide = illimitée) et dernières purges archivées.
// i18n ×5 (t.auditRetention). cf. lib/audit-retention, lib/audit-purge.server.
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type Purge = { id: string; nb: number; jusquaSeq: string; avant: string; archiveCle: string; archiveSha256: string; createdAt: string }
type Etat = { retentionMois: number | null; min: number; max: number; purges: Purge[] }

export default function RetentionJournal() {
  const { t, locale } = useTranslation()
  const l = t.auditRetention
  const [etat, setEtat] = useState<Etat | null>(null)
  const [saisie, setSaisie] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  const charger = useCallback(async () => {
    const r = await fetch('/api/admin/audit-log/retention').catch(() => null)
    if (!r?.ok) return
    const d: Etat = await r.json()
    setEtat(d); setSaisie(d.retentionMois == null ? '' : String(d.retentionMois))
  }, [])
  useEffect(() => { void charger() }, [charger])

  async function enregistrer() {
    setMessage(null)
    const valeur = saisie.trim() === '' ? null : Number(saisie)
    const r = await fetch('/api/admin/audit-log/retention', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retentionMois: valeur }) }).catch(() => null)
    setMessage(r?.ok ? { ok: true, texte: l.enregistre } : { ok: false, texte: l.horsBornes.replace('{min}', String(etat?.min ?? 12)).replace('{max}', String(etat?.max ?? 240)) })
    if (r?.ok) void charger()
  }
  if (!etat) return null
  return (
    <section aria-label={l.titre} className="card mb-6 p-4 text-sm">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100">{l.titre}</h2>
      <p className="text-gray-600 dark:text-gray-300">{l.aide}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-700 dark:text-gray-200">{l.duree.replace('{min}', String(etat.min)).replace('{max}', String(etat.max))}
          <input aria-label={l.champ} type="number" min={etat.min} max={etat.max} className="input mt-1 block w-32 text-sm" placeholder={l.illimitee} value={saisie} onChange={e => setSaisie(e.target.value)} />
        </label>
        <button type="button" className="btn-secondary text-sm" onClick={() => void enregistrer()}>{l.enregistrer}</button>
      </div>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-1 ${message.ok ? 'text-green-800 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{message.texte}</p>}
      <p className="mt-2 text-gray-600 dark:text-gray-300">{etat.retentionMois == null ? l.actuelleIllimitee : l.actuelle.replace('{n}', String(etat.retentionMois))}</p>
      {etat.purges.length > 0 && (
        <ul aria-label={l.purges} className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-200">
          {etat.purges.map(p => (
            <li key={p.id}>{l.purge.replace('{date}', new Date(p.createdAt).toLocaleString(locale)).replace('{n}', p.nb.toLocaleString(locale)).replace('{seq}', p.jusquaSeq)} — <code className="break-all">{p.archiveCle}</code> <span className="text-gray-500">(SHA-256 {p.archiveSha256.slice(0, 16)}…)</span></li>
          ))}
        </ul>
      )}
    </section>
  )
}
