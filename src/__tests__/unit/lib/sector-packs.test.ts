import { describe, expect, it } from 'vitest'
import { SECTOR_CODES, listSectorSuggestions, CATALOGUE_PACK_VERSION } from '@/lib/sector-suggestions'
import { CATALOGUE_CHANGELOG } from '@/lib/sector-suggestions-changelog'
import { planSuggestionSelection } from '@/lib/sector-suggestion-plan'

const LOCALES = ['fr', 'en', 'de', 'es', 'it'] as const

describe('packs sectoriels de contrôles, KRI et audit (catalogue 1.5)', () => {
  it('chaque secteur complète le socle par au moins 2 contrôles, 2 KRI et 1 mission, rattachés à SES processus', () => {
    for (const sector of SECTOR_CODES) {
      for (const locale of LOCALES) {
        const items = listSectorSuggestions(sector, locale)
        const own = items.filter(i => i.sector === sector)
        const sectorProcesses = new Set(own.filter(i => i.kind === 'PROCESS').map(i => i.key))
        for (const kind of ['CONTROL', 'KRI', 'AUDIT'] as const) {
          const list = own.filter(i => i.kind === kind)
          expect(list.length, `${sector} ${kind}`).toBeGreaterThanOrEqual(kind === 'AUDIT' ? 1 : 2)
          for (const x of list) {
            expect(x.key.startsWith(`${sector.toLowerCase()}.${kind === 'CONTROL' ? 'control' : kind.toLowerCase()}.`), x.key).toBe(true)
            expect(sectorProcesses.has(x.processKey!), `${x.key} → ${x.processKey}`).toBe(true)
            expect(x.title.trim()).not.toBe('')
          }
        }
        for (const x of own.filter(i => i.kind === 'KRI')) {
          expect(x.unite?.trim(), x.key).toBeTruthy()
          expect(x).not.toHaveProperty('seuilAlerte'); expect(x).not.toHaveProperty('valeur')
        }
        for (const x of own.filter(i => i.kind === 'AUDIT')) {
          expect(x.points!.length).toBeGreaterThanOrEqual(4)
          expect(x.points!.every(pt => pt.trim() !== '')).toBe(true)
        }
      }
    }
  })

  it('n’expose pas le pack d’un autre secteur ni de pack sans secteur', () => {
    expect(listSectorSuggestions(null, 'fr').some(i => i.key.startsWith('finance.'))).toBe(false)
    expect(listSectorSuggestions('SANTE', 'fr').some(i => i.key.startsWith('finance.'))).toBe(false)
  })

  it('les ajouts de la version figurent dans l’historique (nouveautés)', () => {
    const last = CATALOGUE_CHANGELOG.find(e => e.version === '1.5')!
    expect(last.added).toContain('finance.control.reconciliation')
    expect(last.added).toContain('services.audit.confidentiality')
    expect(CATALOGUE_PACK_VERSION >= '1.5').toBe(true)
  })

  it('un contrôle sectoriel sans son processus est signalé, jamais rattaché à un processus inventé', () => {
    const plan = planSuggestionSelection({ sector: 'FINANCE', locale: 'fr', selectedKeys: ['finance.control.reconciliation'], existingKeys: [] })
    expect(plan.unlinked).toEqual([{ key: 'finance.control.reconciliation', dependencyKey: 'finance.process.payments' }])
  })
})

describe('plans de test de résilience modèles (catalogue 1.6)', () => {
  it('types officiels de l’art. 25 § 1 uniquement (jamais de TLPT), rattachés à un processus connu, libellés ×5', async () => {
    const { TEST_RESILIENCE_TYPES } = await import('@/lib/tests-resilience')
    for (const sector of [null, ...SECTOR_CODES]) {
      for (const locale of LOCALES) {
        const items = listSectorSuggestions(sector, locale)
        const processes = new Set(items.filter(i => i.kind === 'PROCESS').map(i => i.key))
        const tests = items.filter(i => i.kind === 'RESILIENCE_TEST')
        expect(tests.length).toBeGreaterThanOrEqual(5)
        for (const x of tests) {
          expect(x.key).toMatch(/^[a-z]+\.resilience\./)
          expect((TEST_RESILIENCE_TYPES as readonly string[]).includes(x.testType!), x.key).toBe(true)
          expect(x.testType).not.toBe('TLPT')
          expect(processes.has(x.processKey!), `${x.key} → ${x.processKey}`).toBe(true)
          expect(x.title.trim()).not.toBe('')
          for (const f of ['datePrevue', 'resultat', 'constats', 'fonctionCritique', 'independant']) expect(x).not.toHaveProperty(f)
        }
      }
    }
    expect(CATALOGUE_CHANGELOG.find(e => e.version === '1.6')!.added).toContain('core.resilience.pentest')
  })
})
