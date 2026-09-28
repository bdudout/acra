import { describe, expect, it } from 'vitest'
import {
  OPERATIONAL_PROFILE_CATALOGS,
  sanitizeOperationalProfileEntries,
  operationalProfileStats,
  applyOperationalProfileUpdate,
  isOperationalProfileTarget,
  isActionableGap,
  operationalProfileCsvRows,
  summarizeOperationalProfileActions,
} from '@/lib/operational-profiles'
import { lienHref, isLienType } from '@/lib/plan-action'
import { peutEvaluerProfilOperationnel } from '@/lib/permissions'

describe('catalogues officiels', () => {
  it('NIST CSF 2.0 : 22 catégories réparties dans les 6 fonctions', () => {
    const c = OPERATIONAL_PROFILE_CATALOGS.NIST_CSF_2_0
    expect(c.version).toBe('NIST CSF 2.0')
    expect(c.groups.map(g => g.ref)).toEqual(['GV', 'ID', 'PR', 'DE', 'RS', 'RC'])
    expect(c.items).toHaveLength(22)
    expect(c.items.map(i => i.ref)).toContain('GV.SC')
    expect(c.items.find(i => i.ref === 'PR.AA')?.label).toBe('Identity Management, Authentication, and Access Control')
    // Chaque catégorie appartient à la fonction de son préfixe.
    for (const i of c.items) expect(i.ref.startsWith(`${i.group}.`)).toBe(true)
    expect(c.targetLevels.map(t => t.value)).toEqual(['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'])
    expect(c.targetLevels[3].label).toBe('Tier 4: Adaptive')
  })

  it('NCSC CAF v4.0 : 14 principes, 4 objectifs, profils Basic/Enhanced', () => {
    const c = OPERATIONAL_PROFILE_CATALOGS.NCSC_CAF_V4
    expect(c.version).toBe('NCSC CAF v4.0')
    expect(c.groups.map(g => g.ref)).toEqual(['A', 'B', 'C', 'D'])
    expect(c.groups[1].label).toBe('Protecting against cyber attacks')
    expect(c.items.map(i => i.ref)).toEqual(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'C1', 'C2', 'D1', 'D2'])
    expect(c.items.find(i => i.ref === 'C2')?.label).toBe('Threat Hunting')
    expect(c.targetLevels.map(t => t.label)).toEqual(['Basic Profile', 'Enhanced Profile'])
  })

  it('aucune description vide ni en français (textes officiels en anglais)', () => {
    for (const c of Object.values(OPERATIONAL_PROFILE_CATALOGS)) {
      for (const i of c.items) {
        expect(i.description.length).toBeGreaterThan(20)
        expect(i.description).not.toMatch(/[éèà]/)
      }
    }
  })

  it('valide le niveau cible selon le cadre', () => {
    expect(isOperationalProfileTarget('NIST_CSF_2_0', 'TIER_3')).toBe(true)
    expect(isOperationalProfileTarget('NIST_CSF_2_0', 'BASIC')).toBe(false)
    expect(isOperationalProfileTarget('NCSC_CAF_V4', 'ENHANCED')).toBe(true)
    expect(isOperationalProfileTarget('NCSC_CAF_V4', 'TIER_1')).toBe(false)
  })
})

describe('sanitizeOperationalProfileEntries', () => {
  it('écarte les références inconnues, borne les champs et dédoublonne', () => {
    const entries = sanitizeOperationalProfileEntries('NIST_CSF_2_0', [
      { ref: 'GV.OC', statut: 'PARTIEL', cible: 'COUVERT', commentaire: 'x'.repeat(2500), responsable: 'r'.repeat(200) },
      { ref: 'GV', statut: 'COUVERT' },
      { ref: 'ZZ.ZZ', statut: 'COUVERT' },
      { ref: 'ID.AM', statut: 'INCONNU' },
      { ref: 'GV.OC', statut: 'COUVERT' },
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ ref: 'GV.OC', statut: 'COUVERT' })
    const long = sanitizeOperationalProfileEntries('NIST_CSF_2_0', [{ ref: 'GV.OC', statut: 'PARTIEL', commentaire: 'x'.repeat(2500), responsable: 'r'.repeat(200) }])[0]
    expect(long.commentaire).toHaveLength(2000)
    expect(long.responsable).toHaveLength(120)
  })

  it('renvoie un tableau vide pour une entrée non tableau', () => {
    expect(sanitizeOperationalProfileEntries('NCSC_CAF_V4', null)).toEqual([])
  })
})

describe('applyOperationalProfileUpdate', () => {
  const now = new Date('2026-09-28T10:00:00.000Z')
  it('horodate uniquement les points modifiés et produit le diff', () => {
    const previous = sanitizeOperationalProfileEntries('NCSC_CAF_V4', [
      { ref: 'A1', statut: 'PARTIEL', updatedAt: '2026-01-01T00:00:00.000Z', updatedById: 'u0' },
      { ref: 'A2', statut: 'COUVERT', updatedAt: '2026-01-01T00:00:00.000Z', updatedById: 'u0' },
    ])
    const { entries, changes } = applyOperationalProfileUpdate(previous, [
      { ref: 'A1', statut: 'COUVERT' },
      { ref: 'A2', statut: 'COUVERT', updatedAt: '1999-01-01T00:00:00.000Z', updatedById: 'pirate' },
      { ref: 'B1', statut: 'NON_COUVERT', responsable: 'DSI' },
    ], { userId: 'u1', now })
    expect(entries.find(e => e.ref === 'A1')).toMatchObject({ statut: 'COUVERT', updatedAt: now.toISOString(), updatedById: 'u1' })
    // Point inchangé : l'horodatage d'origine est conservé (le client ne peut pas le forger).
    expect(entries.find(e => e.ref === 'A2')).toMatchObject({ updatedAt: '2026-01-01T00:00:00.000Z', updatedById: 'u0' })
    expect(entries.find(e => e.ref === 'B1')).toMatchObject({ updatedById: 'u1' })
    expect(changes).toEqual([
      { ref: 'A1', fields: { statut: ['PARTIEL', 'COUVERT'] } },
      { ref: 'B1', fields: { statut: [null, 'NON_COUVERT'], responsable: [null, 'DSI'] } },
    ])
  })

  it('conserve un point absent de la saisie (sauvegarde partielle sans perte)', () => {
    const previous = sanitizeOperationalProfileEntries('NCSC_CAF_V4', [{ ref: 'D2', statut: 'COUVERT' }])
    const { entries, changes } = applyOperationalProfileUpdate(previous, [], { userId: 'u1', now })
    expect(entries).toEqual(previous)
    expect(changes).toEqual([])
  })
})

describe('écarts et statistiques', () => {
  it('écart actionnable : partiel ou non couvert, sauf cible non applicable', () => {
    expect(isActionableGap({ statut: 'PARTIEL' })).toBe(true)
    expect(isActionableGap({ statut: 'NON_COUVERT', cible: 'NON_APPLICABLE' })).toBe(false)
    expect(isActionableGap({ statut: 'COUVERT' })).toBe(false)
  })

  it('calcule couverture, écarts, écarts à la cible et dernière revue', () => {
    const stats = operationalProfileStats([
      { ref: 'A1', statut: 'COUVERT', updatedAt: '2026-03-01T00:00:00.000Z' },
      { ref: 'A2', statut: 'PARTIEL', cible: 'COUVERT', updatedAt: '2026-05-01T00:00:00.000Z' },
      { ref: 'A3', statut: 'NON_COUVERT', cible: 'NON_APPLICABLE' },
      { ref: 'A4', statut: 'NON_COUVERT' },
      { ref: 'B1', statut: 'NON_EVALUE' },
    ], 14)
    expect(stats).toEqual({
      total: 14, assessed: 4, covered: 1, partial: 1, gaps: 2, notApplicable: 1, targetGaps: 1,
      // 1 couvert sur 3 évalués applicables.
      coverage: 33, lastReviewedAt: '2026-05-01T00:00:00.000Z',
    })
  })

  it('couverture nulle sans évaluation', () => {
    expect(operationalProfileStats([], 22)).toMatchObject({ total: 22, assessed: 0, coverage: 0, lastReviewedAt: null })
  })
})

describe('operationalProfileCsvRows', () => {
  it('produit une ligne par point du catalogue, y compris non évalué', () => {
    const rows = operationalProfileCsvRows('NCSC_CAF_V4', [{ ref: 'A1', statut: 'PARTIEL', cible: 'COUVERT', responsable: 'RSSI', commentaire: '=cmd' }], s => `L:${s}`)
    expect(rows).toHaveLength(14)
    expect(rows[0]).toEqual(['A', 'A1', 'Governance', 'L:PARTIEL', 'L:COUVERT', 'RSSI', '=cmd', ''])
    expect(rows[1][3]).toBe('L:NON_EVALUE')
  })
})

describe('intégration plan d’action et droits', () => {
  it('le type de lien OPERATIONAL_PROFILE est reconnu et mène au profil', () => {
    expect(isLienType('OPERATIONAL_PROFILE')).toBe(true)
    expect(lienHref({ type: 'OPERATIONAL_PROFILE', targetId: 'p1', ref: 'GV.OC' })).toBe('/profils-operationnels?ref=GV.OC')
  })

  it('évaluation réservée à l’admin et aux rôles de pilotage du risque', () => {
    for (const r of ['ADMIN', 'SUPER_ADMIN', 'RSSI', 'RISK_MANAGER', 'CONFORMITE'] as const) expect(peutEvaluerProfilOperationnel(r)).toBe(true)
    for (const r of ['LECTEUR', 'AUDITEUR', 'ANALYSTE'] as const) expect(peutEvaluerProfilOperationnel(r)).toBe(false)
  })
})

describe('summarizeOperationalProfileActions', () => {
  it('compte total, ouvertes et en retard par point', () => {
    const now = new Date('2026-09-28T00:00:00Z')
    const m = summarizeOperationalProfileActions([
      { statut: 'A_FAIRE', echeance: new Date('2026-09-01'), liens: [{ targetId: 'p1', ref: 'A1' }] },
      { statut: 'EN_COURS', echeance: null, liens: [{ targetId: 'p1', ref: 'A1' }] },
      { statut: 'FAIT', echeance: new Date('2026-01-01'), liens: [{ targetId: 'p1', ref: 'A1' }] },
      { statut: 'A_FAIRE', echeance: null, liens: [{ targetId: 'p1', ref: null }] },
    ], now)
    expect(m.get('p1|A1')).toEqual({ total: 3, open: 2, overdue: 1 })
    expect(m.size).toBe(1)
  })
})
