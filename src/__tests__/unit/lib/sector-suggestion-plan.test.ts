import { describe, expect, it } from 'vitest'
import { planSuggestionSelection } from '@/lib/sector-suggestion-plan'

describe('planSuggestionSelection', () => {
  it('n’instancie que les clés choisies, dans l’ordre parents puis enfants puis risques', () => {
    const plan = planSuggestionSelection({ sector: 'FINANCE', locale: 'fr', selectedKeys: [
      'finance.risk.payment-routing', 'finance.process.payments', 'core.process.deliver',
    ], existingKeys: [] })
    expect(plan.invalidKeys).toEqual([])
    expect(plan.toCreate.map(item => item.key)).toEqual([
      'core.process.deliver', 'finance.process.payments', 'finance.risk.payment-routing',
    ])
    expect(plan.unlinked).toEqual([])
  })

  it('permet trois risques seuls mais avertit de leurs processus non retenus', () => {
    const plan = planSuggestionSelection({ sector: null, locale: 'fr', selectedKeys: [
      'core.risk.payment-fraud', 'core.risk.ransomware', 'core.risk.data-leak',
    ], existingKeys: [] })
    expect(plan.toCreate).toHaveLength(3)
    expect(plan.unlinked.map(item => item.key)).toEqual([
      'core.risk.payment-fraud', 'core.risk.ransomware', 'core.risk.data-leak',
    ])
  })

  it('n’importe pas deux fois un élément édité localement et rejette une clé hors secteur', () => {
    const plan = planSuggestionSelection({ sector: 'SANTE', locale: 'fr', selectedKeys: [
      'sante.risk.patient-data', 'finance.risk.payment-routing', 'core.process.digital',
    ], existingKeys: ['sante.risk.patient-data', 'core.process.digital'] })
    expect(plan.toCreate).toEqual([])
    expect(plan.alreadyImported).toEqual(['sante.risk.patient-data', 'core.process.digital'])
    expect(plan.invalidKeys).toEqual(['finance.risk.payment-routing'])
  })

  it('déduplique les clés demandées et borne leur nombre', () => {
    const plan = planSuggestionSelection({ sector: null, locale: 'fr', selectedKeys: Array(100).fill('core.process.govern'), existingKeys: [] })
    expect(plan.toCreate.map(item => item.key)).toEqual(['core.process.govern'])
  })
})
