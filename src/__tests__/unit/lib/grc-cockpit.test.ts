import { describe, it, expect } from 'vitest'
import {
  rollupIncidents, incidentsByOrg,
  rollupControles, controlesByOrg,
  rollupAudit, auditByOrg,
  type CockpitIncident, type CockpitExecution, type CockpitConstat,
} from '@/lib/grc-cockpit'

const NOW = new Date('2026-08-12T00:00:00Z')

describe('grc-cockpit — incidents (LDC)', () => {
  const rows: CockpitIncident[] = [
    { organizationId: 'a', statut: 'DECLARE', montantBrut: 1000, recuperations: 200 }, // net 800, ouvert
    { organizationId: 'a', statut: 'CLOTURE', montantBrut: 500, recuperations: null }, // net 500, terminé
    { organizationId: 'b', statut: 'QUALIFIE', montantBrut: null, recuperations: null }, // net 0, ouvert
    { organizationId: 'b', statut: 'REJETE', montantBrut: 9999, recuperations: 0 }, // exclu
  ]

  it('consolide total/ouverts/perteNette en excluant les REJETE', () => {
    const t = rollupIncidents(rows)
    expect(t.total).toBe(3)
    expect(t.ouverts).toBe(2)
    expect(t.perteNette).toBe(1300)
  })

  it('ventile par organisation', () => {
    const m = incidentsByOrg(rows)
    expect(m.get('a')).toEqual({ total: 2, ouverts: 1, perteNette: 1300 })
    expect(m.get('b')).toEqual({ total: 1, ouverts: 1, perteNette: 0 })
  })

  it('liste vide → tout à zéro', () => {
    expect(rollupIncidents([])).toEqual({ total: 0, ouverts: 0, perteNette: 0 })
  })
})

describe('grc-cockpit — contrôles', () => {
  const controles = [{ organizationId: 'a' }, { organizationId: 'a' }, { organizationId: 'b' }]
  const execs: CockpitExecution[] = [
    { organizationId: 'a', resultat: 'CONFORME', dateRealisation: NOW },
    { organizationId: 'a', resultat: 'ANOMALIE', dateRealisation: NOW },
    { organizationId: 'a', resultat: 'NON_APPLICABLE', dateRealisation: NOW }, // exclu du taux
    { organizationId: 'b', resultat: 'CONFORME', dateRealisation: NOW },
  ]

  it('taux de conformité hors NON_APPLICABLE', () => {
    const t = rollupControles(controles, execs)
    expect(t.controles).toBe(3)
    expect(t.evaluees).toBe(3)
    expect(t.conformes).toBe(2)
    expect(t.anomalies).toBe(1)
    expect(t.tauxConformite).toBe(67) // 2/3
  })

  it('ventile par organisation', () => {
    const m = controlesByOrg(controles, execs)
    expect(m.get('a')).toMatchObject({ controles: 2, anomalies: 1, tauxConformite: 50 })
    expect(m.get('b')).toMatchObject({ controles: 1, conformes: 1, tauxConformite: 100 })
  })

  it('aucune exécution évaluable → taux null', () => {
    expect(rollupControles(controles, []).tauxConformite).toBeNull()
  })
})

describe('grc-cockpit — audit', () => {
  const missions = [{ organizationId: 'a' }, { organizationId: 'b' }]
  const constats: CockpitConstat[] = [
    { organizationId: 'a', criticite: 4, statut: 'OUVERT', echeance: '2020-01-01' }, // critique + en retard
    { organizationId: 'a', criticite: 2, statut: 'RESOLU', echeance: null }, // terminé
    { organizationId: 'b', criticite: 4, statut: 'ACCEPTE', echeance: '2020-01-01' }, // terminé → pas critique
  ]

  it('consolide missions/constats/critiques/en retard/taux', () => {
    const t = rollupAudit(missions, constats, NOW)
    expect(t.missions).toBe(2)
    expect(t.constats).toBe(3)
    expect(t.critiques).toBe(1)
    expect(t.recosEnRetard).toBe(1) // seul le OUVERT en retard compte
    expect(t.tauxResolution).toBe(67) // 2/3 terminés
  })

  it('ventile par organisation', () => {
    const m = auditByOrg(missions, constats, NOW)
    expect(m.get('a')).toMatchObject({ missions: 1, constats: 2, critiques: 1 })
    expect(m.get('b')).toMatchObject({ missions: 1, constats: 1, critiques: 0 })
  })
})
