import { describe, expect, it } from 'vitest'
import {
  MATURITY_LEVELS,
  sanitizeMaturityScale,
  resolveMaturityScale,
  sanitizeMaturites,
  applyMaturityUpdate,
  effectiveTarget,
  isMaturityGap,
  maturityStats,
  maturityCsvRows,
  summarizeRefActions,
} from '@/lib/maturity'

const DEFAULT_LABELS = MATURITY_LEVELS.map(n => ({ niveau: n, libelle: `L${n}`, definition: `D${n}` }))

describe('échelle CMMI', () => {
  it('six niveaux fixes 0 à 5', () => {
    expect(MATURITY_LEVELS).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('personnalisation : libellés/définitions bornés, niveaux inconnus écartés', () => {
    const s = sanitizeMaturityScale([
      { niveau: 3, libelle: '  Défini (maison) ', definition: 'x'.repeat(900) },
      { niveau: 9, libelle: 'hors échelle' },
      { niveau: 1, libelle: '' },
      'bruit',
    ])
    expect(s).toEqual([{ niveau: 3, libelle: 'Défini (maison)', definition: 'x'.repeat(500) }])
  })

  it('résolution : la personnalisation de l’organisation surcharge le défaut niveau par niveau', () => {
    const r = resolveMaturityScale([{ niveau: 3, libelle: 'Maison', definition: '' }], DEFAULT_LABELS)
    expect(r).toHaveLength(6)
    expect(r[3]).toEqual({ niveau: 3, libelle: 'Maison', definition: 'D3' })
    expect(r[0]).toEqual({ niveau: 0, libelle: 'L0', definition: 'D0' })
  })
})

describe('sanitizeMaturites', () => {
  it('garde les points connus, borne les niveaux 0–5 et les textes', () => {
    const m = sanitizeMaturites({
      'GV.OC-01': { actuel: 2, cible: 4, responsable: 'r'.repeat(200), commentaire: 'ok' },
      'GV.OC-02': { actuel: 7 },
      'ZZ': { actuel: 1 },
      'ID.AM-01': { actuel: 1.5, cible: 3 },
    }, new Set(['GV.OC-01', 'GV.OC-02', 'ID.AM-01']))
    expect(m['GV.OC-01']).toMatchObject({ actuel: 2, cible: 4, commentaire: 'ok' })
    expect(m['GV.OC-01'].responsable).toHaveLength(120)
    expect(m['GV.OC-02']).toBeUndefined()
    expect(m.ZZ).toBeUndefined()
    expect(m['ID.AM-01']).toEqual({ cible: 3 })
  })

  it('objet vide pour une entrée invalide', () => {
    expect(sanitizeMaturites(null)).toEqual({})
    expect(sanitizeMaturites([])).toEqual({})
  })
})

describe('applyMaturityUpdate', () => {
  const now = new Date('2026-09-29T10:00:00.000Z')
  it('horodate seulement les points modifiés (non forgeable) et renvoie le diff', () => {
    const prev = { A1: { actuel: 1, updatedAt: '2026-01-01T00:00:00.000Z', updatedById: 'u0' }, A2: { actuel: 3, updatedAt: '2026-01-01T00:00:00.000Z', updatedById: 'u0' } }
    const { maturites, changes } = applyMaturityUpdate(prev, {
      A1: { actuel: 2 },
      A2: { actuel: 3, updatedAt: '1999-01-01T00:00:00.000Z', updatedById: 'pirate' },
      B1: { cible: 4 },
    }, { userId: 'u1', now })
    expect(maturites.A1).toMatchObject({ actuel: 2, updatedAt: now.toISOString(), updatedById: 'u1' })
    expect(maturites.A2).toMatchObject({ updatedAt: '2026-01-01T00:00:00.000Z', updatedById: 'u0' })
    expect(maturites.B1).toMatchObject({ cible: 4, updatedById: 'u1' })
    expect(changes).toEqual([
      { ref: 'A1', fields: { actuel: [1, 2] } },
      { ref: 'B1', fields: { cible: [null, 4] } },
    ])
  })

  it('un point vidé (aucune valeur) est retiré', () => {
    const { maturites, changes } = applyMaturityUpdate({ A1: { actuel: 2 } }, { A1: {} }, { userId: 'u1', now })
    expect(maturites.A1).toBeUndefined()
    expect(changes).toEqual([{ ref: 'A1', fields: { actuel: [2, null] } }])
  })
})

describe('cible effective et écarts', () => {
  it('la cible du point prime, sinon la cible globale du profil', () => {
    expect(effectiveTarget({ cible: 2 }, 4)).toBe(2)
    expect(effectiveTarget({}, 4)).toBe(4)
    expect(effectiveTarget(undefined, null)).toBeNull()
  })

  it('écart = maturité actuelle évaluée sous la cible effective', () => {
    expect(isMaturityGap({ actuel: 1 }, 3)).toBe(true)
    expect(isMaturityGap({ actuel: 3 }, 3)).toBe(false)
    expect(isMaturityGap({}, 3)).toBe(false)
    expect(isMaturityGap({ actuel: 1 }, null)).toBe(false)
  })
})

describe('maturityStats', () => {
  const items = [
    { ref: 'A1', categorie: 'A' }, { ref: 'A2', categorie: 'A' },
    { ref: 'B1', categorie: 'B' }, { ref: 'B2', categorie: 'B' },
  ]
  it('agrège par domaine et classe les plus grands écarts', () => {
    const s = maturityStats(items, {
      A1: { actuel: 1, cible: 4, updatedAt: '2026-03-01T00:00:00.000Z' },
      A2: { actuel: 3 },
      B1: { actuel: 2, updatedAt: '2026-05-01T00:00:00.000Z' },
    }, 3)
    expect(s.total).toBe(4)
    expect(s.assessed).toBe(3)
    expect(s.belowTarget).toBe(2) // A1 (1<4), B1 (2<3)
    expect(s.averageCurrent).toBe(2) // (1+3+2)/3
    expect(s.averageTarget).toBe(3.3) // (4+3+3)/3 sur les points évalués
    expect(s.lastReviewedAt).toBe('2026-05-01T00:00:00.000Z')
    expect(s.domains).toEqual([
      { categorie: 'A', total: 2, assessed: 2, averageCurrent: 2, averageTarget: 3.5, belowTarget: 1 },
      { categorie: 'B', total: 2, assessed: 1, averageCurrent: 2, averageTarget: 3, belowTarget: 1 },
    ])
    expect(s.topGaps.map(g => [g.ref, g.gap])).toEqual([['A1', 3], ['B1', 1]])
  })

  it('aucune évaluation : moyennes nulles', () => {
    expect(maturityStats(items, {}, null)).toMatchObject({ assessed: 0, averageCurrent: null, averageTarget: null, belowTarget: 0, topGaps: [] })
  })
})

describe('maturityCsvRows', () => {
  it('une ligne par point, cible héritée signalée', () => {
    const rows = maturityCsvRows(
      [{ ref: 'A1', categorie: 'A', nom: 'Governance' }, { ref: 'A2', categorie: 'A', nom: 'Risk Management' }],
      { A1: { actuel: 1, responsable: 'RSSI', commentaire: '=cmd' } },
      3,
      n => `N${n}`,
    )
    expect(rows[0]).toEqual(['A', 'A1', 'Governance', 'N1', 'N3', '2', 'RSSI', '=cmd', ''])
    expect(rows[1]).toEqual(['A', 'A2', 'Risk Management', '', 'N3', '', '', '', ''])
  })
})

describe('summarizeRefActions', () => {
  it('compte total, ouvertes et en retard par point', () => {
    const now = new Date('2026-09-29T00:00:00Z')
    expect(summarizeRefActions([
      { statut: 'A_FAIRE', echeance: new Date('2026-09-01'), liens: [{ ref: 'A1' }] },
      { statut: 'EN_COURS', echeance: null, liens: [{ ref: 'A1' }, { ref: 'A1' }] },
      { statut: 'FAIT', echeance: new Date('2026-01-01'), liens: [{ ref: 'A1' }] },
      { statut: 'A_FAIRE', echeance: null, liens: [{ ref: null }] },
    ], now)).toEqual({ A1: { total: 3, open: 2, overdue: 1 } })
  })
})
