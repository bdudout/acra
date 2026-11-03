'use client'
// File des demandes de double validation : approuver (exécute l'action), rejeter (motif obligatoire), annuler (demandeur).
// i18n ×5 (t.doubleValidation). Le serveur revérifie droits et conditions à chaque décision.
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type Demande = {
  id: string; type: string; libelle: string; statut: string; createdAt: string; decideLe: string | null; motifDecision: string | null
  commentaire: string | null; demandeur: string | null; valideur: string | null; peutDecider: boolean; peutAnnuler: boolean
}

export default function DemandesValidation() {
  const { t, locale } = useTranslation()
  const v = t.doubleValidation
  const [demandes, setDemandes] = useState<Demande[] | null>(null)
  const [historique, setHistorique] = useState(false)
  const [motifs, setMotifs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  const charger = useCallback(async () => {
    const r = await fetch(`/api/validations${historique ? '?statut=toutes' : ''}`).catch(() => null)
    setDemandes(r?.ok ? (await r.json()).demandes : [])
  }, [historique])
  useEffect(() => { void charger() }, [charger])

  async function trancher(id: string, decision: 'APPROUVER' | 'REJETER' | 'ANNULER') {
    setBusy(id); setMessage(null)
    const r = await fetch(`/api/validations/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, motif: motifs[id] || null }) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setBusy(null)
    setMessage(r?.ok ? { ok: true, texte: (v.faits as Record<string, string>)[decision] } : { ok: false, texte: (v.erreurs as Record<string, string>)[d.error] ?? v.erreurs.echec })
    void charger()
  }

  if (!demandes) return <p className="text-sm text-gray-500">…</p>
  const date = (s: string) => new Date(s).toLocaleString(locale)
  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input type="checkbox" checked={historique} onChange={e => setHistorique(e.target.checked)} />{v.historique}
      </label>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-green-800 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{message.texte}</p>}
      {demandes.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-300">{v.aucune}</p>}
      <ul className="space-y-3">
        {demandes.map(d => (
          <li key={d.id} className="card p-4 text-sm">
            <p className="font-medium text-gray-900 dark:text-gray-100">{(v.types as Record<string, string>)[d.type] ?? d.type} — {d.libelle}</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {v.demandePar.replace('{nom}', d.demandeur ?? '—').replace('{date}', date(d.createdAt))}
              {' · '}<span className="font-medium">{(v.statuts as Record<string, string>)[d.statut] ?? d.statut}</span>
              {d.valideur && d.decideLe && <> · {v.decidePar.replace('{nom}', d.valideur).replace('{date}', date(d.decideLe))}</>}
            </p>
            {d.commentaire && <p className="mt-1 text-xs text-gray-700 dark:text-gray-200">{v.commentaire} : {d.commentaire}</p>}
            {d.motifDecision && <p className="mt-1 text-xs text-gray-700 dark:text-gray-200">{v.motif} : {d.motifDecision}</p>}
            {d.peutDecider && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="grow text-xs text-gray-700 dark:text-gray-200">{v.motif}
                  <input aria-label={`${v.motif} — ${d.libelle}`} className="input mt-1 block w-full text-sm" maxLength={2000} value={motifs[d.id] ?? ''} onChange={e => setMotifs(m => ({ ...m, [d.id]: e.target.value }))} />
                </label>
                <button type="button" className="btn-primary text-sm" disabled={busy === d.id} onClick={() => void trancher(d.id, 'APPROUVER')}>{v.approuver}</button>
                <button type="button" className="btn-secondary text-sm" disabled={busy === d.id || !(motifs[d.id] ?? '').trim()} onClick={() => void trancher(d.id, 'REJETER')}>{v.rejeter}</button>
              </div>
            )}
            {d.peutAnnuler && <button type="button" className="btn-secondary mt-2 text-sm" disabled={busy === d.id} onClick={() => void trancher(d.id, 'ANNULER')}>{v.annuler}</button>}
            {d.statut === 'EN_ATTENTE' && !d.peutDecider && !d.peutAnnuler && <p className="mt-1 text-xs text-gray-500">{v.attenteAutre}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
