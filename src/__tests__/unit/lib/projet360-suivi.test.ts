/** Suivi des projets 360 dans le cockpit GRC + rattachement d'une analyse cyber à un projet. */
import { describe, expect, it } from 'vitest'
import { synthetiserProjets360, resolveProjetSource, prefillFromProjet, isGrcActive } from '@/lib/projet360'

const now = new Date('2026-09-29T00:00:00Z')
const ap = (role: string, userId: string) => ({ role, userId, le: '2026-09-20T00:00:00Z' })

describe('synthetiserProjets360', () => {
  const rows = [
    { id: 'p1', nom: 'Refonte portail', statut: 'EN_COURS', dateEcheance: new Date('2026-09-01T00:00:00Z'), approbations: [ap('RSSI', 'u1')], risques: [{ niveauRisque: 16, niveauResiduel: null }, { niveauRisque: 4, niveauResiduel: 2 }] },
    { id: 'p2', nom: 'Migration cloud', statut: 'APPROUVE', dateEcheance: null, approbations: [ap('RSSI', 'u1'), ap('RISK_MANAGER', 'u2')], risques: [] },
    { id: 'p3', nom: 'Clos', statut: 'TERMINE', dateEcheance: new Date('2026-01-01T00:00:00Z'), approbations: [], risques: [{ niveauRisque: 9, niveauResiduel: null }] },
  ]
  const s = synthetiserProjets360(rows, now)

  it('compte les projets par état ; un projet terminé n’est jamais « en retard »', () => {
    expect(s.total).toBe(3)
    expect(s.termines).toBe(1)
    expect(s.enCours).toBe(2)
    expect(s.enRetard).toBe(1)
  })
  it('validation RSSI + RM : complète, partielle ou aucune', () => {
    const byId = Object.fromEntries(s.projets.map(p => [p.id, p]))
    expect(byId.p1.validation).toBe('PARTIELLE')
    expect(byId.p2.validation).toBe('COMPLETE')
    expect(byId.p3.validation).toBe('AUCUNE')
    expect(s.valides).toBe(1)
  })
  it('paliers de risque sur le résiduel s’il est coté, sinon le brut', () => {
    const p1 = s.projets.find(p => p.id === 'p1')!
    expect(p1.risques).toBe(2)
    expect(p1.eleves).toBe(1)
  })
  it('les projets à surveiller (retard, risques élevés) passent en tête', () => {
    expect(s.projets[0].id).toBe('p1')
  })
  it('un ADMIN complète seul la validation ; approbations invalides ignorées', () => {
    const r = synthetiserProjets360([{ id: 'x', nom: 'X', statut: 'EN_COURS', dateEcheance: null, approbations: [ap('ADMIN', 'a'), { foo: 1 }], risques: [] }], now)
    expect(r.projets[0].validation).toBe('COMPLETE')
  })
})

describe('resolveProjetSource', () => {
  const projet = { id: 'p1', methode: 'PROJET_360', organizationId: 'o1', nom: 'Refonte', description: 'Portail client' }
  it('ignore le lien quand le module Projets 360 est inactif', () => {
    expect(resolveProjetSource({ projet, orgId: 'o1', projets360Active: false })).toEqual({ status: 'IGNORE' })
  })
  it('refuse un projet introuvable, d’une autre organisation ou d’une autre méthode', () => {
    expect(resolveProjetSource({ projet: null, orgId: 'o1', projets360Active: true })).toEqual({ status: 'INTROUVABLE' })
    expect(resolveProjetSource({ projet: { ...projet, organizationId: 'o2' }, orgId: 'o1', projets360Active: true })).toEqual({ status: 'INTROUVABLE' })
    expect(resolveProjetSource({ projet: { ...projet, methode: 'EBIOS_RM' }, orgId: 'o1', projets360Active: true })).toEqual({ status: 'INTROUVABLE' })
  })
  it('accepte un projet 360 de la même organisation', () => {
    expect(resolveProjetSource({ projet, orgId: 'o1', projets360Active: true })).toEqual({ status: 'OK', projetId: 'p1' })
  })
})

describe('prefillFromProjet', () => {
  it('ne remplace jamais ce que l’utilisateur a déjà saisi', () => {
    expect(prefillFromProjet({ nom: 'Refonte', description: 'Portail' }, { nom: '', description: '' })).toEqual({ nom: 'Analyse cyber — Refonte', description: 'Portail' })
    expect(prefillFromProjet({ nom: 'Refonte', description: 'Portail' }, { nom: 'Mon nom', description: 'Ma desc' })).toEqual({ nom: 'Mon nom', description: 'Ma desc' })
  })
})

describe('isGrcActive', () => {
  it('vrai dès qu’un module GRC de 2ᵉ/3ᵉ ligne est actif, pas avec les seuls incidents ou projets', () => {
    expect(isGrcActive({ registreRisquesActive: false, controlePermanentActive: true })).toBe(true)
    expect(isGrcActive({ registreRisquesActive: false, reglementaireActive: true })).toBe(true)
    expect(isGrcActive({ registreRisquesActive: false, incidentsActive: true, projets360Active: true })).toBe(false)
  })
})
