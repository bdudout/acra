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

describe('KRI candidats du catalogue', () => {
  it('propose des indicateurs transversaux sans aucun seuil ni valeur, rattachés à un processus, avec unité localisée et fréquence valide', () => {
    for (const locale of LOCALES) {
      const items = listSectorSuggestions(null, locale)
      const processes = new Set(items.filter(i => i.kind === 'PROCESS').map(i => i.key))
      const kris = items.filter(i => i.kind === 'KRI')
      expect(kris.length).toBeGreaterThanOrEqual(8)
      for (const x of kris) {
        expect(x.title.trim(), x.key).not.toBe(''); expect(x.unite?.trim(), x.key).toBeTruthy()
        expect(x.key).toMatch(/^core\.kri\./); expect(processes.has(x.processKey!)).toBe(true)
        expect(['HAUSSE', 'BAISSE']).toContain(x.sens)
        expect(['MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL']).toContain(x.periodicite)
        expect(x).not.toHaveProperty('seuilAlerte'); expect(x).not.toHaveProperty('valeur')
      }
    }
  })
})

describe('missions d’audit types du catalogue', () => {
  it('propose des missions rattachées à un processus connu, avec des points de revue localisés et sans date ni notation', () => {
    for (const locale of LOCALES) {
      const items = listSectorSuggestions(null, locale)
      const processes = new Set(items.filter(i => i.kind === 'PROCESS').map(i => i.key))
      const audits = items.filter(i => i.kind === 'AUDIT')
      expect(audits.length).toBeGreaterThanOrEqual(4)
      for (const x of audits) {
        expect(x.key).toMatch(/^core\.audit\./); expect(processes.has(x.processKey!)).toBe(true)
        expect(x.points!.length).toBeGreaterThanOrEqual(4); expect(x.points!.every(pt => pt.trim() !== '')).toBe(true)
        expect(x).not.toHaveProperty('notation'); expect(x).not.toHaveProperty('dateDebut')
      }
    }
  })
})

import { adaptPeriodicite } from '@/lib/sector-suggestions'
describe('périodicités « petite structure »', () => {
  it('allège d’un cran les contrôles fréquents ; les périodicités semestrielle et annuelle sont conservées ; structure standard inchangée', () => {
    expect(adaptPeriodicite('HEBDOMADAIRE', true)).toBe('MENSUEL')
    expect(adaptPeriodicite('MENSUEL', true)).toBe('TRIMESTRIEL')
    expect(adaptPeriodicite('TRIMESTRIEL', true)).toBe('SEMESTRIEL')
    expect(adaptPeriodicite('SEMESTRIEL', true)).toBe('SEMESTRIEL')
    expect(adaptPeriodicite('ANNUEL', true)).toBe('ANNUEL')
    for (const p of ['HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL'] as const) expect(adaptPeriodicite(p, false)).toBe(p)
    expect(adaptPeriodicite(undefined, true)).toBeUndefined()
  })
})
