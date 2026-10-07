'use client'

// ─── Flux client des risques proposés par la qualification ───────────────────
// Source unique des propositions : GET /api/analyses/[id]/qualification-risks
// (traduites et filtrées côté serveur selon la config de l'organisation).
//  - `useQualificationProposals` : chargement + propositions encore en attente ;
//  - `QualificationRisksDialog` : fenêtre de sélection + création (méthodes à
//    saisie directe) + bilan « créés / non retenus ».
// EBIOS RM : pas de création ici — les propositions sont faites en atelier 5.

import { useCallback, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import QualificationRiskProposal, { type ProposedRisk } from '@/components/QualificationRiskProposal'

export type QualificationProposal = ProposedRisk & { alreadyCreated: boolean }
export type QualificationChannel = 'ATELIER5' | 'DIRECT'

/** Charge les propositions d'une analyse ; `pending` = règles pas encore créées. */
export function useQualificationProposals(analyseId: string | null) {
  const [channel, setChannel] = useState<QualificationChannel | null>(null)
  const [proposals, setProposals] = useState<QualificationProposal[]>([])
  const reload = useCallback(async (): Promise<{ channel: QualificationChannel | null; pending: QualificationProposal[] }> => {
    if (!analyseId) return { channel: null, pending: [] }
    const data = await fetch(`/api/analyses/${analyseId}/qualification-risks`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
    const list: QualificationProposal[] = Array.isArray(data?.proposals) ? data.proposals : []
    const ch: QualificationChannel | null = data?.channel === 'ATELIER5' || data?.channel === 'DIRECT' ? data.channel : null
    setChannel(ch); setProposals(list)
    return { channel: ch, pending: list.filter(p => !p.alreadyCreated) }
  }, [analyseId])
  return { channel, proposals, pending: proposals.filter(p => !p.alreadyCreated), reload }
}

/** Libellés traduits de la proposition (t.qualification.riskProposal + stratégies). */
export function useProposalLabels() {
  const { t } = useTranslation()
  const rp = t.qualification.riskProposal
  return {
    labels: {
      title: rp.title, explanation: rp.explanation, confirm: rp.confirm, cancel: rp.cancel,
      gravity: rp.gravity, likelihood: rp.likelihood, strategy: rp.strategy,
      mandatory: rp.mandatory, mandatoryHint: rp.mandatoryHint, categories: rp.categories as Record<string, string>,
    },
    strategies: t.risquesDirects.strategies as Record<string, string>,
    rp,
  }
}

/**
 * Fenêtre de proposition + création (saisie directe). `onDone(summary)` reçoit
 * le bilan traduit ; `onClose` ferme sans créer (sauf imposés : rien n'est créé
 * tant que l'utilisateur ne confirme pas — ils restent proposés).
 */
export function QualificationRisksDialog({ analyseId, risks, onClose, onDone }: {
  analyseId: string; risks: ProposedRisk[]; onClose: () => void; onDone: (summary: string) => void
}) {
  const { labels, strategies, rp } = useProposalLabels()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function confirm(ruleIds: string[]) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/analyses/${analyseId}/qualification-risks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruleIds }),
    }).catch(() => null)
    setBusy(false)
    if (!res || !res.ok) { setError(rp.error); return }
    const d = await res.json().catch(() => ({}))
    onDone(rp.summary.replace('{created}', String(d.created ?? 0)).replace('{skipped}', String((d.skipped ?? []).filter((s: { reason?: string }) => s.reason === 'NOT_SELECTED').length)))
  }
  return <QualificationRiskProposal risks={risks} labels={labels} strategies={strategies} busy={busy} error={error} onCancel={onClose} onConfirm={confirm} />
}
