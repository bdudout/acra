import { describe, expect, it } from 'vitest'
import { listSectorSuggestions } from '@/lib/sector-suggestions'
import { planSuggestionSelection } from '@/lib/sector-suggestion-plan'
import { PERIODICITES } from '@/lib/controle'

const LOCALES = ['fr', 'en', 'de', 'es', 'it'] as const

describe('contrôles-types du catalogue', () => {
  it('propose des contrôles transversaux, rattachés à un processus connu, avec périodicité et type valides et libellés ×5', () => {
    for (const locale of LOCALES) {
      const items = listSectorSuggestions(null, locale)
      const processes = new Set(items.filter(i => i.kind === 'PROCESS').map(i => i.key))
      const controls = items.filter(i => i.kind === 'CONTROL')
      expect(controls.length).toBeGreaterThanOrEqual(8)
      for (const c of controls) {
        expect(c.title.trim(), c.key).not.toBe('')
        expect(c.key).toMatch(/^core\.control\./)
        expect(processes.has(c.processKey!), `${c.key} → ${c.processKey}`).toBe(true)
        expect((PERIODICITES as readonly string[]).includes(c.periodicite!), c.key).toBe(true)
        expect(['PREVENTIF', 'DETECTIF', 'CORRECTIF']).toContain(c.controlType)
      }
    }
  })
  it('un contrôle sélectionné sans son processus est signalé (jamais de lien inventé), et est créé après les processus', () => {
    const plan = planSuggestionSelection({ sector: null, locale: 'fr', selectedKeys: ['core.control.access-review', 'core.process.digital.iam', 'core.process.digital'], existingKeys: [] })
    expect(plan.toCreate.map(i => i.key).at(-1)).toBe('core.control.access-review')
    expect(plan.unlinked).toEqual([])
    const alone = planSuggestionSelection({ sector: null, locale: 'fr', selectedKeys: ['core.control.access-review'], existingKeys: [] })
    expect(alone.unlinked).toEqual([{ key: 'core.control.access-review', dependencyKey: 'core.process.digital.iam' }])
  })
})
