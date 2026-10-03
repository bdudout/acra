import { describe, it, expect } from 'vitest'
import { buildControlPlan, CONTROL_PLAN_PROFILES } from '@/lib/control-plan-template'
import { listSectorSuggestions } from '@/lib/sector-suggestions'

describe('plan de contrôle type — mutuelle santé', () => {
  it('compose 12 contrôles couvrant 12 domaines distincts, sans sur-représenter le TIC', () => {
    const plan = buildControlPlan('MUTUELLE_SANTE', { count: 12, locale: 'fr' })
    expect(plan.controls).toHaveLength(12)
    expect(new Set(plan.controls.map(c => c.domain)).size).toBe(12)
    expect(new Set(plan.controls.map(c => c.key)).size).toBe(12)
    expect(plan.controls.filter(c => c.domain === 'ict' || c.domain === 'continuity').length).toBeLessThanOrEqual(3)
  })

  it('couvre les domaines clés du métier', () => {
    const domains = buildControlPlan('MUTUELLE_SANTE', { count: 12 }).controls.map(c => c.domain)
    for (const d of ['governance', 'fit-proper', 'aml', 'advice', 'complaints', 'health-data', 'benefits', 'contributions', 'delegates', 'ict', 'continuity', 'solvency']) {
      expect(domains).toContain(d)
    }
  })

  it('chaque contrôle existe au catalogue, avec périodicité, type et référence', () => {
    const cat = new Map(listSectorSuggestions(['ASSURANCE'] as never, 'fr').map(i => [i.key, i]))
    for (const c of buildControlPlan('MUTUELLE_SANTE', { count: 12 }).controls) {
      const item = cat.get(c.key)
      expect(item, c.key).toBeTruthy()
      expect(c.periodicite).toBeTruthy()
      expect(c.controlType).toBeTruthy()
      expect(c.references.length, c.key).toBeGreaterThan(0)
    }
  })

  it('moins de contrôles demandés : les domaines prioritaires d’abord ; plus : compléments sans doublon', () => {
    const six = buildControlPlan('MUTUELLE_SANTE', { count: 6 }).controls.map(c => c.domain)
    expect(six).toHaveLength(6)
    expect(six).toContain('governance')
    const fifteen = buildControlPlan('MUTUELLE_SANTE', { count: 15 }).controls
    expect(fifteen).toHaveLength(15)
    expect(new Set(fifteen.map(c => c.key)).size).toBe(15)
  })

  it('profil inconnu : liste vide et profils disponibles', () => {
    const plan = buildControlPlan('INCONNU', {})
    expect(plan.controls).toEqual([])
    expect(plan.profiles).toEqual(Object.keys(CONTROL_PLAN_PROFILES))
  })

  it('libellés localisés', () => {
    const en = buildControlPlan('MUTUELLE_SANTE', { count: 12, locale: 'en' })
    expect(en.controls[0].title).not.toBe(buildControlPlan('MUTUELLE_SANTE', { count: 12, locale: 'fr' }).controls[0].title)
  })
})

describe('plan type — équilibre des types', () => {
  it('expose la répartition des types et le contrôle correctif disponible en complément', () => {
    const p12 = buildControlPlan('MUTUELLE_SANTE', { count: 12 })
    expect(Object.values(p12.typeBalance).reduce((a, b) => a + b, 0)).toBe(12)
    const p13 = buildControlPlan('MUTUELLE_SANTE', { count: 13 })
    expect(p13.typeBalance.CORRECTIF).toBeGreaterThanOrEqual(1)
  })
})
