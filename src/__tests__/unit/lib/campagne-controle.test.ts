/**
 * campagne-controle.test.ts — campagnes de contrôle de 1er niveau (N1).
 *
 * Une campagne = une VAGUE de contrôles à exécuter sur une période (dérivée du plan
 * de contrôle / de la cartographie). L'avancement se calcule à partir des exécutions
 * (ControleExecution) tombant dans la fenêtre de la campagne — réutilise le module M3.
 */
import { describe, it, expect } from 'vitest'
import {
  validateCampagneControleInput,
  cleanCampagneControleInput,
  avancementCampagne,
  campagneEnRetard,
} from '@/lib/campagne-controle'

describe('validate/clean campagne de contrôle', () => {
  it('exige un intitulé', () => {
    expect(validateCampagneControleInput({ dateDebut: '2026-01-01' })).toBe('intitule_requis')
  })
  it('rejette une fin antérieure au début', () => {
    expect(validateCampagneControleInput({ intitule: 'T1', dateDebut: '2026-03-01', dateFin: '2026-01-01' })).toBe('dates_incoherentes')
  })
  it('normalise les identifiants de contrôle et le niveau', () => {
    const c = cleanCampagneControleInput({ intitule: '  Campagne T1 ', controleIds: ['a', 'a', '', 'b'], niveau: 'BOGUS' })
    expect(c.intitule).toBe('Campagne T1')
    expect(c.controleIds).toEqual(['a', 'b']) // dédupliqué, vides retirés
    expect(c.niveau).toBe('N1')               // défaut
  })
})

describe('avancementCampagne', () => {
  const campagne = { controleIds: ['c1', 'c2', 'c3'], dateDebut: '2026-03-01', dateFin: '2026-03-31' }
  const executions = [
    { controleId: 'c1', dateRealisation: '2026-03-10', resultat: 'CONFORME' },
    { controleId: 'c2', dateRealisation: '2026-03-20', resultat: 'ANOMALIE' },
    { controleId: 'c1', dateRealisation: '2026-02-01', resultat: 'CONFORME' }, // hors fenêtre → ignorée
    { controleId: 'zz', dateRealisation: '2026-03-15', resultat: 'CONFORME' }, // hors périmètre → ignorée
  ]

  it('compte les contrôles faits (exécution DANS la fenêtre) et les anomalies', () => {
    const a = avancementCampagne(campagne, executions)
    expect(a.total).toBe(3)
    expect(a.faits).toBe(2)        // c1 + c2 dans la fenêtre (c3 non exécuté)
    expect(a.aFaire).toBe(1)       // c3
    expect(a.anomalies).toBe(1)    // c2
    expect(a.tauxAvancement).toBeCloseTo(2 / 3, 5)
  })

  it('une exécution HORS fenêtre ne compte pas dans la campagne', () => {
    // seule l'exécution de c1 le 01/02 existe → hors fenêtre → 0 fait
    const a = avancementCampagne(campagne, [{ controleId: 'c1', dateRealisation: '2026-02-01', resultat: 'CONFORME' }])
    expect(a.faits).toBe(0)
  })

  it('périmètre vide → total 0, avancement 1 (rien à faire)', () => {
    const a = avancementCampagne({ controleIds: [], dateDebut: '2026-03-01', dateFin: '2026-03-31' }, [])
    expect(a.total).toBe(0)
    expect(a.tauxAvancement).toBe(1)
  })
})

describe('campagneEnRetard', () => {
  const campagne = { controleIds: ['c1', 'c2'], dateDebut: '2026-03-01', dateFin: '2026-03-31' }
  it('en retard si la fin est passée et l’avancement incomplet', () => {
    const a = avancementCampagne(campagne, [{ controleId: 'c1', dateRealisation: '2026-03-05', resultat: 'CONFORME' }])
    expect(campagneEnRetard(campagne, a, new Date('2026-04-05'))).toBe(true)  // après la fin, 1/2 fait
  })
  it('pas en retard si complète, même après la fin', () => {
    const a = avancementCampagne(campagne, [
      { controleId: 'c1', dateRealisation: '2026-03-05', resultat: 'CONFORME' },
      { controleId: 'c2', dateRealisation: '2026-03-06', resultat: 'CONFORME' },
    ])
    expect(campagneEnRetard(campagne, a, new Date('2026-04-05'))).toBe(false)
  })
  it('pas en retard avant la date de fin', () => {
    const a = avancementCampagne(campagne, [])
    expect(campagneEnRetard(campagne, a, new Date('2026-03-15'))).toBe(false)
  })
})
