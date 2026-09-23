import { describe, it, expect } from 'vitest'
import {
  sanitizeLien, sanitizeLiens, lienHref, validatePlanActionInput, cleanPlanActionInput,
  riskItemIdFromLiens, toRiskActionShape,
} from '@/lib/plan-action'

describe('plan-action — liens polymorphes', () => {
  it('sanitize un lien valide et rejette les invalides', () => {
    expect(sanitizeLien({ type: 'CONFORMITE', targetId: 'ISO27001', ref: 'A.5.1', label: 'x' }))
      .toEqual({ type: 'CONFORMITE', targetId: 'ISO27001', ref: 'A.5.1', label: 'x' })
    expect(sanitizeLien({ type: 'BIDON', targetId: 'x' })).toBeNull()
    expect(sanitizeLien({ type: 'AUDIT', targetId: '  ' })).toBeNull()
    expect(sanitizeLien(null)).toBeNull()
  })

  it('dédoublonne les liens (type|targetId|ref)', () => {
    const liens = sanitizeLiens([
      { type: 'RISQUE', targetId: 'r1' },
      { type: 'RISQUE', targetId: 'r1' },            // doublon
      { type: 'CONFORMITE', targetId: 'ISO27001', ref: 'A.5.1' },
      { type: 'CONFORMITE', targetId: 'ISO27001', ref: 'A.8.2' }, // ref ≠ → gardé
      { type: 'x', targetId: 'y' },                  // invalide
    ])
    expect(liens).toHaveLength(3)
  })

  it('produit des liens profonds par type', () => {
    expect(lienHref({ type: 'ANALYSE', targetId: 'a1' })).toBe('/analyses/a1')
    expect(lienHref({ type: 'RISQUE', targetId: 'r1' })).toBe('/registre?item=r1')
    expect(lienHref({ type: 'CONFORMITE', targetId: 'ISO27001' })).toBe('/conformite/socle?ref=ISO27001')
    expect(lienHref({ type: 'AUDIT', targetId: 'm1' })).toBe('/audit?mission=m1')
    // Risque d'analyse : le href profond vise l'atelier (ref = analyseId), pas targetId.
    expect(lienHref({ type: 'RISQUE_ANALYSE', targetId: 'risk1', ref: 'an1' })).toBe('/analyses/an1/atelier/1')
    expect(lienHref({ type: 'RISQUE_ANALYSE', targetId: 'risk1' })).toBe('/analyses/risk1/atelier/1')
  })

  it('accepte le type de lien RISQUE_ANALYSE', () => {
    expect(sanitizeLien({ type: 'RISQUE_ANALYSE', targetId: 'r1', ref: 'a1' }))
      .toEqual({ type: 'RISQUE_ANALYSE', targetId: 'r1', ref: 'a1' })
  })
})

describe('plan-action — validation/nettoyage', () => {
  it('exige un titre et valide le statut', () => {
    expect(validatePlanActionInput({ titre: '' })).toBe('titre_requis')
    expect(validatePlanActionInput({ titre: 'x', statut: 'BIDON' })).toBe('statut_invalide')
    expect(validatePlanActionInput({ titre: 'x', statut: 'EN_COURS' })).toBeNull()
  })

  it('nettoie l\'entrée avec des défauts sûrs', () => {
    const c = cleanPlanActionInput({ titre: '  Corriger X  ', priorite: 'zzz', description: '  d  ' })
    expect(c.titre).toBe('Corriger X')
    expect(c.priorite).toBe('MAJEUR') // défaut
    expect(c.statut).toBe('A_FAIRE')
    expect(c.description).toBe('d')
  })
})

describe('plan-action — absorption RiskAction', () => {
  it('extrait le riskItemId du premier lien RISQUE', () => {
    expect(riskItemIdFromLiens([{ type: 'RISQUE', targetId: 'r1' }])).toBe('r1')
    expect(riskItemIdFromLiens([{ type: 'CONFORMITE', targetId: 'ISO' }, { type: 'RISQUE', targetId: 'r2' }])).toBe('r2')
    expect(riskItemIdFromLiens([{ type: 'AUDIT', targetId: 'm1' }])).toBeNull()
    expect(riskItemIdFromLiens([])).toBeNull()
    expect(riskItemIdFromLiens(undefined)).toBeNull()
  })

  it('projette un PlanAction vers la forme RiskAction (contrat du panneau registre)', () => {
    const shape = toRiskActionShape({
      id: 'p1', titre: 'Corriger', description: 'd', porteur: 'Alice',
      echeance: null, statut: 'EN_COURS', priorite: 'CRITIQUE',
    })
    expect(shape).toEqual({
      id: 'p1', intitule: 'Corriger', description: 'd', responsable: 'Alice',
      echeance: null, statut: 'EN_COURS', priorite: 'CRITIQUE',
    })
  })
})
