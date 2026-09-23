'use client'

// ─── Mesures de sécurité rattachées à un risque (saisie directe) ─────────────
// Panneau compact (déplié sous un risque) : liste les mesures existantes (contrôles
// en place qui expliquent la réduction brut → actuel), permet d'en ajouter/retirer.
// Consomme /api/analyses/[id]/risques/[riskId]/mesures. Le plus simple possible :
// un intitulé + une efficacité, « Ajouter ».

import { useEffect, useState } from 'react'
import { Plus, Trash2, ShieldCheck } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

interface MesureRow { id: string; nom: string; type: string; statut: string; efficacite?: number | null; echeance?: string | null }
const MESURE_STATUTS = ['REALISE', 'EN_COURS', 'A_FAIRE', 'REPORTE'] as const

export default function RiskMesures({ analyseId, riskId, editable }: { analyseId: string; riskId: string; editable: boolean }) {
  const { t } = useTranslation()
  const m = t.risquesDirects
  const statutLabel = (s: string) => (m.mesuresStatuts as Record<string, string>)[s] ?? s
  const [rows, setRows] = useState<MesureRow[]>([])
  const [loading, setLoading] = useState(true)
  const [nom, setNom] = useState('')
  const [efficacite, setEfficacite] = useState(3)
  const [statut, setStatut] = useState<string>('REALISE')
  const [echeance, setEcheance] = useState('')
  const [busy, setBusy] = useState(false)
  const base = `/api/analyses/${analyseId}/risques/${riskId}/mesures`

  async function reload() {
    const d = await fetch(base).then(r => r.ok ? r.json() : { mesures: [] }).catch(() => ({ mesures: [] }))
    setRows(d.mesures ?? []); setLoading(false)
  }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function ajouter() {
    if (!nom.trim() || busy) return
    setBusy(true)
    const res = await fetch(base, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, efficacite, statut, ...(echeance ? { echeance } : {}) }),
    }).catch(() => null)
    setBusy(false)
    if (res && res.ok) { setNom(''); setEfficacite(3); setStatut('REALISE'); setEcheance(''); reload() }
  }

  async function supprimer(mesureId: string) {
    const res = await fetch(`${base}/${mesureId}`, { method: 'DELETE' }).catch(() => null)
    if (res && res.ok) setRows(prev => prev.filter(r => r.id !== mesureId))
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
        <ShieldCheck size={14} aria-hidden="true" />{m.mesuresTitrePlan}
      </p>
      {loading ? <p className="text-xs text-gray-400">…</p>
        : rows.length === 0 ? <p className="text-xs text-gray-400 italic mb-2">{m.mesuresEmpty}</p>
        : (
          <ul className="mb-2 space-y-1">
            {rows.map(r => (
              <li key={r.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                <span className="text-ebios-500">›</span>
                <span className="flex-1">{r.nom}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${r.statut === 'REALISE' ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200'}`}>{statutLabel(r.statut)}</span>
                {r.efficacite != null && <span className="text-gray-400 tabular-nums">{m.mesuresEfficacite} {r.efficacite}</span>}
                {editable && <button onClick={() => supprimer(r.id)} className="text-gray-400 hover:text-red-600 p-0.5" aria-label={m.delete}><Trash2 size={13} aria-hidden="true" /></button>}
              </li>
            ))}
          </ul>
        )}
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder={m.mesuresNomPlaceholder}
            className="flex-1 min-w-[10rem] px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs" />
          <label className="text-[10px] text-gray-500 dark:text-gray-400">{m.mesuresStatut}
            <select value={statut} onChange={e => setStatut(e.target.value)} className="block mt-0.5 px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs">
              {MESURE_STATUTS.map(s => <option key={s} value={s}>{statutLabel(s)}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-gray-500 dark:text-gray-400">{m.mesuresEfficacite}
            <select value={efficacite} onChange={e => setEfficacite(Number(e.target.value))} className="block mt-0.5 px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs">
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-gray-500 dark:text-gray-400">{m.mesuresEcheance}
            <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)} className="block mt-0.5 px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs" />
          </label>
          <button onClick={ajouter} disabled={busy || !nom.trim()} className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50">
            <Plus size={13} aria-hidden="true" />{m.add}
          </button>
        </div>
      )}
    </div>
  )
}
