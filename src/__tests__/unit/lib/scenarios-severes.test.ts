import { describe, expect, it } from 'vitest'
import { lireScenario } from '@/lib/scenarios-severes'

describe('lireScenario', () => {
  it('scénario complet', () => {
    const r = lireScenario({ intitule: ' Rançongiciel sur le cœur bancaire ', dureeInterruptionMinutes: 2880, mesures: 'Restauration depuis sauvegardes immuables', dateEvaluation: '2026-10-15' })
    expect(r).toMatchObject({ ok: true, data: { intitule: 'Rançongiciel sur le cœur bancaire', dureeInterruptionMinutes: 2880, description: null } })
  })
  it('refus explicites (jamais de correction silencieuse)', () => {
    expect(lireScenario({ dureeInterruptionMinutes: 60 })).toEqual({ ok: false, error: 'intitule_requis' })
    expect(lireScenario({ intitule: 'x', dureeInterruptionMinutes: -1 })).toEqual({ ok: false, error: 'duree_invalide' })
    expect(lireScenario({ intitule: 'x', dureeInterruptionMinutes: '' })).toEqual({ ok: false, error: 'duree_invalide' })
    expect(lireScenario({ intitule: 'x', dureeInterruptionMinutes: 60, dateEvaluation: '15/10/2026' })).toEqual({ ok: false, error: 'date_invalide' })
  })
})
