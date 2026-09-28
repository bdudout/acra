import { describe, expect, it } from 'vitest'
import {
  OPERATIONAL_PROFILE_CATALOGS,
  operationalProfileStats,
  sanitizeOperationalProfileEntries,
} from '@/lib/operational-profiles'

describe('catalogues de profils opérationnels', () => {
  it('couvre les six fonctions NIST CSF 2.0, dont Govern', () => {
    const nist = OPERATIONAL_PROFILE_CATALOGS.NIST_CSF_2_0
    expect(nist.items.map(item => item.ref)).toEqual(['GV', 'ID', 'PR', 'DE', 'RS', 'RC'])
  })

  it('couvre les objectifs CAF v4 sans les présenter comme des contrôles exhaustifs', () => {
    const caf = OPERATIONAL_PROFILE_CATALOGS.NCSC_CAF_V4
    expect(caf.items.map(item => item.ref)).toEqual(['A', 'B', 'C', 'D'])
    expect(caf.granularity).toBe('OBJECTIVE')
  })
})

describe('sanitizeOperationalProfileEntries', () => {
  it('ne garde que les références et états attendus, avec texte borné', () => {
    const result = sanitizeOperationalProfileEntries('NIST_CSF_2_0', [
      { ref: 'GV', statut: 'PARTIEL', cible: 'COUVERT', commentaire: 'x'.repeat(2100), responsable: 'A'.repeat(130) },
      { ref: 'inconnu', statut: 'COUVERT' },
    ])
    expect(result).toEqual([{
      ref: 'GV', statut: 'PARTIEL', cible: 'COUVERT', commentaire: 'x'.repeat(2000), responsable: 'A'.repeat(120),
    }])
  })

  it('calcule des écarts à partir de l’état courant et cible', () => {
    const stats = operationalProfileStats([
      { ref: 'GV', statut: 'COUVERT', cible: 'COUVERT' },
      { ref: 'ID', statut: 'PARTIEL', cible: 'COUVERT' },
      { ref: 'PR', statut: 'NON_COUVERT', cible: 'NON_APPLICABLE' },
    ])
    expect(stats).toEqual({ total: 3, covered: 1, partial: 1, gaps: 1, notApplicable: 1, targetGaps: 1 })
  })
})
