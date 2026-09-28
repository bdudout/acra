import { describe, expect, it } from 'vitest'
import { parseMarkdownBlocks } from '@/lib/markdown-docx'
import {
  TEST_RESILIENCE_TYPES, sanitizeTestResilience, programmeStats, buildRapportReexamen, type TestResilienceLite,
} from '@/lib/tests-resilience'

describe('types de tests (DORA art. 25 § 1 + TLPT art. 26)', () => {
  it('douze types de l’article 25 + TLPT', () => {
    expect(TEST_RESILIENCE_TYPES).toHaveLength(13)
    expect(TEST_RESILIENCE_TYPES).toContain('PENETRATION')
    expect(TEST_RESILIENCE_TYPES[TEST_RESILIENCE_TYPES.length - 1]).toBe('TLPT')
  })
})

describe('sanitizeTestResilience', () => {
  it('valide et borne la saisie', () => {
    const r = sanitizeTestResilience({
      annee: 2026, intitule: '  Pentest portail client ', type: 'PENETRATION', fonctionCritique: true,
      testeur: 'EXTERNE', independant: true, statut: 'REALISE', dateRealisation: '2026-05-10',
      riskItemIds: ['r1', 'r1', 42, 'r2'],
      constats: [{ description: 'Injection SQL', severite: 4, corrige: false }, { description: '', severite: 2 }, { description: 'Entêtes', severite: 9 }],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toMatchObject({ annee: 2026, intitule: 'Pentest portail client', type: 'PENETRATION', fonctionCritique: true, testeur: 'EXTERNE', statut: 'REALISE', riskItemIds: ['r1', 'r2'] })
    expect(r.value.dateRealisation?.toISOString().slice(0, 10)).toBe('2026-05-10')
    expect(r.value.constats).toEqual([{ description: 'Injection SQL', severite: 4, corrige: false }, { description: 'Entêtes', severite: 4, corrige: false }])
  })

  it('refuse un intitulé vide, un type ou une année invalide', () => {
    expect(sanitizeTestResilience({ annee: 2026, intitule: '', type: 'PENETRATION' })).toEqual({ ok: false, error: 'intitule_requis' })
    expect(sanitizeTestResilience({ annee: 2026, intitule: 'x', type: 'AUTRE' })).toEqual({ ok: false, error: 'type_invalide' })
    expect(sanitizeTestResilience({ annee: 1990, intitule: 'x', type: 'PENETRATION' })).toEqual({ ok: false, error: 'annee_invalide' })
  })
})

const t = (o: Partial<TestResilienceLite>): TestResilienceLite => ({
  id: 'x', annee: 2026, intitule: 'T', type: 'VULNERABILITY', statut: 'PLANIFIE', fonctionCritique: false, independant: true,
  testeur: 'INTERNE', dateRealisation: null, constats: [], riskItemIds: [], ...o,
})

describe('programmeStats', () => {
  const now = new Date('2026-09-29T00:00:00Z')
  it('réalisation, fonctions critiques, constats, indépendance, échéance TLPT', () => {
    const s = programmeStats([
      t({ id: 'a', statut: 'REALISE', fonctionCritique: true, constats: [{ description: 'c1', severite: 4, corrige: false }, { description: 'c2', severite: 2, corrige: true }] }),
      t({ id: 'b', statut: 'PLANIFIE', type: 'PENETRATION' }),
      t({ id: 'c', statut: 'ANNULE' }),
      t({ id: 'd', statut: 'REALISE', independant: false }),
      t({ id: 'e', annee: 2023, statut: 'REALISE', type: 'TLPT', dateRealisation: new Date('2023-11-15') }),
    ], 2026, now)
    expect(s).toMatchObject({ planifies: 3, realises: 2, tauxRealisation: 67, fonctionsCritiquesTestees: 1, nonIndependants: 1 })
    expect(s.parType.VULNERABILITY).toEqual({ planifies: 2, realises: 2 })
    expect(s.constats).toEqual({ total: 2, ouverts: 1, corriges: 1, ouvertsCritiques: 1 })
    expect(s.tlpt).toEqual({ dernier: '2023-11-15', echeance: '2026-11-15', enRetard: false })
  })

  it('sans TLPT : pas d’échéance connue', () => {
    expect(programmeStats([], 2026, now).tlpt).toEqual({ dernier: null, echeance: null, enRetard: false })
  })
})

describe('buildRapportReexamen', () => {
  it('assemble le rapport en Markdown (titres, tableau, constats ouverts, incidents majeurs)', () => {
    const L = {
      titre: 'Rapport sur le réexamen du cadre de gestion du risque lié aux TIC', organisation: 'Organisation', annee: 'Année',
      programme: 'Programme', realisation: '{realises}/{planifies} tests réalisés ({taux} %)', parType: 'Tests par type', colType: 'Type', colPlanifies: 'Planifiés', colRealises: 'Réalisés',
      fonctionsCritiques: '{n} test(s) réalisé(s) sur des fonctions critiques ou importantes', constats: 'Constats', constatsDetail: '{ouverts} ouvert(s), {corriges} corrigé(s)',
      constatsOuverts: 'Constats ouverts', incidents: 'Incidents majeurs liés aux TIC', aucunIncident: 'Aucun incident majeur.', risques: 'Risques du registre liés',
      aucunRisque: 'Aucun risque lié.', tlpt: 'TLPT', tlptDetail: 'dernier {dernier}, échéance {echeance}', tlptNone: 'aucun TLPT enregistré', conclusions: 'Conclusions',
      conclusionsHint: 'À compléter.', types: { VULNERABILITY: 'Évaluations et analyses de vulnérabilité', PENETRATION: 'Tests de pénétration' } as Record<string, string>,
      severite: 'sévérité {n}',
    }
    const md = buildRapportReexamen({
      organisation: 'Acme', annee: 2026, now: new Date('2026-09-29T00:00:00Z'),
      tests: [t({ statut: 'REALISE', intitule: 'Scan', constats: [{ description: 'Port ouvert', severite: 3, corrige: false }] }), t({ type: 'PENETRATION' })],
      incidents: [{ intitule: 'Panne paiement', date: '2026-03-02' }],
      risques: [{ intitule: 'Indisponibilité SI paiement', niveauResiduel: 9 }],
      labels: L,
    })
    expect(md).toContain('# Rapport sur le réexamen du cadre de gestion du risque lié aux TIC')
    expect(md).toContain('1/2 tests réalisés (50 %)')
    expect(md).toContain('| Évaluations et analyses de vulnérabilité | 1 | 1 |')
    expect(md).toContain('- Port ouvert (sévérité 3)')
    expect(md).toContain('- Panne paiement (2026-03-02)')
    expect(md).toContain('- Indisponibilité SI paiement (9)')
    // Le tableau est reconnu comme tel par le convertisseur Word.
    const blocks = parseMarkdownBlocks(md)
    expect(blocks.some(b => b.type === 'table' && b.rows.length === 3)).toBe(true)
  })
})
