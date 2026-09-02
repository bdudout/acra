import { describe, it, expect } from 'vitest'
import { PROGRAMMES_AUDIT, getProgrammeAudit } from '@/lib/audit-programmes-catalogue'
import { cleanChecklist } from '@/lib/controle'

describe('audit-programmes-catalogue', () => {
  it('expose les programmes cyber et non-cyber (P1 + P2)', () => {
    expect(PROGRAMMES_AUDIT.map(p => p.id).sort()).toEqual([
      'CONTROLE_INTERNE', 'CREDIT_OCTROI', 'DORA', 'GAFI', 'IDD', 'ISO27001', 'LCB_FT',
      'MAR', 'MIF2', 'RGPD', 'SANCTIONS_GEL', 'SOLVA2',
    ])
  })
  it('getProgrammeAudit retrouve / renvoie undefined', () => {
    expect(getProgrammeAudit('DORA')?.points.length).toBeGreaterThan(5)
    expect(getProgrammeAudit('BOGUS')).toBeUndefined()
  })
  it('points non vides, uniques, compatibles avec cleanChecklist', () => {
    for (const p of PROGRAMMES_AUDIT) {
      expect(p.points.every(x => x.trim() !== '')).toBe(true)
      expect(new Set(p.points).size).toBe(p.points.length)
      expect(cleanChecklist(p.points)).toEqual(p.points)
    }
  })
})
