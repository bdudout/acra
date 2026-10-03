import { describe, expect, it } from 'vitest'
import { planDeclinaison, donneesDeclinaison, consolider } from '@/lib/controle-reseau'

const now = new Date('2026-10-03T10:00:00Z')
const orgs = [
  { id: 'mere', path: '/mere/' },
  { id: 'f1', path: '/mere/f1/' },
  { id: 'f2', path: '/mere/f2/' },
  { id: 'pf1', path: '/mere/f1/pf1/' },
  { id: 'autre', path: '/autre/' },
]
const ref = {
  id: 'c-ref', organizationId: 'mere', intitule: 'Revue des comptes à privilèges', description: 'Trimestrielle', niveau: 'N1', periodicite: 'TRIMESTRIEL',
  tailleEchantillon: 25, referentielCode: 'ISO27001', exigenceRefs: ['A.5.18'], checklist: ['Liste extraite', 'Écarts traités'], typeControle: 'DETECTIF',
  modeControle: 'MANUEL', cle: true, methodeEchantillon: 'ALEATOIRE', responsable: 'RSSI groupe', riskItemId: 'ri-mere', processusId: 'p-mere',
}

describe('contrôles de référence — déclinaison', () => {
  it('cible les seules entités descendantes (jamais la mère, jamais hors sous-arbre), sans doublon', () => {
    expect(planDeclinaison('/mere/', orgs, ['f1', 'f2', 'pf1', 'autre', 'mere'], [])).toEqual(['f1', 'f2', 'pf1'])
  })
  it('idempotente : une entité déjà dotée de la déclinaison n’est pas reprise', () => {
    expect(planDeclinaison('/mere/', orgs, ['f1', 'f2', 'pf1'], ['f1'])).toEqual(['f2', 'pf1'])
    expect(planDeclinaison('/mere/', orgs, ['f1'], ['f1'])).toEqual([])
  })
  it('copie la définition, pas les rattachements propres à la mère (risque, processus, responsable)', () => {
    const d = donneesDeclinaison(ref, 'f1')
    expect(d).toMatchObject({ organizationId: 'f1', referenceId: 'c-ref', estReference: false, intitule: ref.intitule, periodicite: 'TRIMESTRIEL', checklist: ref.checklist, exigenceRefs: ['A.5.18'], cle: true })
    expect(d).not.toHaveProperty('riskItemId'); expect(d).not.toHaveProperty('processusId'); expect(d).not.toHaveProperty('responsable')
  })
})

describe('contrôles de référence — consolidation', () => {
  const decl = (organizationId: string, executions: { resultat: string; dateRealisation: Date }[], actif = true) =>
    ({ id: `c-${organizationId}`, organizationId, actif, periodicite: 'TRIMESTRIEL', createdAt: new Date('2026-01-01T00:00:00Z'), executions })
  it('une cellule par entité : dernier résultat, état d’échéance, taux de conformité', () => {
    const r = consolider([
      decl('f1', [{ resultat: 'CONFORME', dateRealisation: new Date('2026-09-15') }, { resultat: 'ANOMALIE', dateRealisation: new Date('2026-06-15') }]),
      decl('f2', [{ resultat: 'ANOMALIE', dateRealisation: new Date('2026-04-01') }]),
      decl('pf1', []),
    ], now)
    const f1 = r.cellules.find(c => c.organizationId === 'f1')!
    expect(f1).toMatchObject({ dernierResultat: 'CONFORME', etat: 'A_VENIR', taux: 50 })
    expect(r.cellules.find(c => c.organizationId === 'f2')).toMatchObject({ dernierResultat: 'ANOMALIE', etat: 'EN_RETARD', taux: 0 })
    expect(r.cellules.find(c => c.organizationId === 'pf1')).toMatchObject({ dernierResultat: null, etat: 'JAMAIS', taux: null })
    expect(r.synthese).toEqual({ entites: 3, conformes: 1, anomalies: 1, enRetard: 1, sansExecution: 1, taux: 33 })
  })
  it('les résultats « non applicable » ne comptent pas ; une déclinaison désactivée est signalée, hors synthèse', () => {
    const r = consolider([
      decl('f1', [{ resultat: 'NON_APPLICABLE', dateRealisation: new Date('2026-09-15') }, { resultat: 'CONFORME', dateRealisation: new Date('2026-08-01') }]),
      decl('f2', [{ resultat: 'ANOMALIE', dateRealisation: new Date('2026-09-01') }], false),
    ], now)
    expect(r.cellules.find(c => c.organizationId === 'f1')).toMatchObject({ dernierResultat: 'NON_APPLICABLE', taux: 100 })
    expect(r.cellules.find(c => c.organizationId === 'f2')).toMatchObject({ etat: 'INACTIF' })
    expect(r.synthese).toMatchObject({ entites: 1, conformes: 0, anomalies: 0, taux: 100 })
  })
})
