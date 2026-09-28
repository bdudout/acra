'use client'

// ─── EBIOS RM — risques proposés par la qualification, en atelier 5 ──────────
// En EBIOS RM, les risques naissent des scénarios : les propositions issues de la
// qualification sont donc présentées ICI, au moment de traiter les risques. Les
// risques retenus sont ajoutés à l'ÉTAT LOCAL de l'atelier (via `onAdd`) et
// persistés par son auto-save — jamais créés côté serveur en parallèle (l'auto-save
// « tout supprimer / recréer » les effacerait). Les risques imposés ne peuvent pas
// être décochés, et le bloc ne peut pas être masqué tant qu'il en reste.

import { useEffect, useMemo, useState } from 'react'
import QualificationRiskProposal, { type ProposedRisk } from '@/components/QualificationRiskProposal'
import { useProposalLabels, useQualificationProposals } from '@/components/QualificationRisksFlow'

export default function QualificationRisksAtelier5({ analyseId, existingRuleIds, onAdd }: {
  analyseId: string
  /** Règles déjà présentes dans l'état local de l'atelier (source de vérité en A5). */
  existingRuleIds: string[]
  onAdd: (risks: ProposedRisk[]) => void
}) {
  const { proposals, reload } = useQualificationProposals(analyseId)
  const { labels, strategies, rp } = useProposalLabels()
  const [hidden, setHidden] = useState(false)
  useEffect(() => { void reload() }, [reload])

  const existing = useMemo(() => new Set(existingRuleIds), [existingRuleIds])
  const pending = proposals.filter(p => !existing.has(p.id))
  if (pending.length === 0) return null
  const hasMandatory = pending.some(p => p.mandatory)
  if (hidden && !hasMandatory) return null

  return (
    <QualificationRiskProposal
      // Remonte la sélection quand la liste change (ajout / nouvelles propositions).
      key={pending.map(p => p.id).join('|')}
      inline risks={pending} strategies={strategies}
      labels={{ ...labels, title: rp.atelier5Title, explanation: rp.atelier5Intro, confirm: rp.atelier5Confirm }}
      onCancel={hasMandatory ? undefined : () => setHidden(true)}
      onConfirm={ids => onAdd(pending.filter(p => ids.includes(p.id)))}
    />
  )
}
