'use client'

// ─── File de validation des propositions MCP ─────────────────────────────────
// Liste les propositions EN_ATTENTE de l'organisation active et permet à un
// utilisateur habilité (édition de l'analyse cible, vérifiée côté serveur) de les
// ACCEPTER (crée l'objet réel) ou REJETER. Aucune écriture directe par la machine :
// c'est ici que se joue le « human-in-the-loop » du cadrage MCP.

import { useEffect, useState } from 'react'
import { Check, X, Bot } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

interface Payload {
  nom?: string
  // risque
  gravite?: number; vraisemblance?: number; niveauRisque?: number; strategie?: string; niveauResiduel?: number
  // mesure
  type?: string; priorite?: number | string; statut?: string; responsable?: string
  // plan d'action
  titre?: string; porteur?: string
  // conformité
  ref?: string; commentaire?: string
  description?: string
}
interface Proposal {
  id: string; type: string; targetType: string; targetId: string; ancreNom: string | null
  payload: Payload; createdAt: string
}

export default function McpProposalsQueue() {
  const { t, locale } = useTranslation()
  const m = t.mcpProposals
  const [items, setItems] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function reload() {
    const d = await fetch('/api/mcp-proposals').then(x => x.ok ? x.json() : { proposals: [] }).catch(() => ({ proposals: [] }))
    setItems(d.proposals ?? []); setLoading(false)
  }
  useEffect(() => { reload() }, [])

  async function decide(id: string, action: 'accept' | 'reject') {
    setBusy(id)
    const res = await fetch(`/api/mcp-proposals/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    }).catch(() => null)
    setBusy(null)
    if (res && res.ok) setItems(prev => prev.filter(p => p.id !== id))
  }

  const jour = (d: string) => new Date(d).toLocaleString(locale)

  if (loading) return <p className="text-sm text-gray-400">…</p>
  if (items.length === 0) return <p className="text-sm text-gray-400 italic">{m.empty}</p>

  return (
    <ul className="space-y-3">
      {items.map(p => {
        const kind = p.type === 'measure' ? m.typeMesure : p.type === 'plan_action' ? m.typePlanAction : p.type === 'conformite' ? m.typeConformite : m.typeRisk
        const label = p.payload.titre || p.payload.nom || p.payload.ref || '—'
        const detail = p.type === 'measure'
          ? `${m.type} ${p.payload.type ?? '—'} · ${m.priorite} ${p.payload.priorite ?? '—'} · ${m.statut} ${p.payload.statut ?? '—'}${p.payload.responsable ? ` · ${m.responsable} ${p.payload.responsable}` : ''}`
          : p.type === 'plan_action'
          ? `${m.priorite} ${p.payload.priorite ?? '—'} · ${m.statut} ${p.payload.statut ?? '—'}${p.payload.porteur ? ` · ${m.responsable} ${p.payload.porteur}` : ''}`
          : p.type === 'conformite'
          ? `${m.statut} ${(m.conformiteStatuts as Record<string, string>)?.[String(p.payload.statut)] ?? p.payload.statut ?? '—'}${p.payload.commentaire ? ` · ${p.payload.commentaire}` : ''}`
          : `${m.gravite} ${p.payload.gravite ?? '—'} · ${m.vraisemblance} ${p.payload.vraisemblance ?? '—'} · ${m.niveau} ${p.payload.niveauRisque ?? '—'} · ${m.strategie} ${p.payload.strategie ?? '—'}`
        return (
          <li key={p.id} className="card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5 mb-1">
                  <Bot size={14} aria-hidden="true" /> {kind} · {p.ancreNom ?? `${p.targetType} ${p.targetId.slice(0, 8)}`} · {jour(p.createdAt)}
                </p>
                <p className="font-medium text-gray-800 dark:text-gray-100 break-words">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{detail}</p>
                {p.payload.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 break-words">{p.payload.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => decide(p.id, 'accept')} disabled={busy === p.id}
                  className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50">
                  <Check size={14} aria-hidden="true" /> {m.accept}
                </button>
                <button onClick={() => decide(p.id, 'reject')} disabled={busy === p.id}
                  className="btn-secondary text-xs inline-flex items-center gap-1 disabled:opacity-50">
                  <X size={14} aria-hidden="true" /> {m.reject}
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
