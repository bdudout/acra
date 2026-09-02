import { describe, it, expect } from 'vitest'
import {
  GRC_BUILTINS,
  GRC_BUILTIN_CODES,
  isGrcBuiltin,
  grcBuiltinByCode,
  grcCodeFromNom,
} from '../../../lib/referentiels-builtins-grc'
import { DOMAINES } from '../../../lib/referentiel-domaines'

describe('GRC_BUILTINS — catalogue non-cyber livré', () => {
  it('couvre les filières P1 attendues (LCB-FT, gel des avoirs, RGPD, DSP2, Sapin II, compta, crédit, externalisation, contrôle interne)', () => {
    expect(GRC_BUILTIN_CODES.sort()).toEqual([
      'COMPTA_CI', 'CONTROLE_INTERNE', 'CREDIT_OCTROI', 'DSP2', 'EXTERNALISATION',
      'LCB_FT', 'RGPD', 'SANCTIONS_GEL', 'SAPIN2',
    ])
  })

  it('a des codes uniques', () => {
    expect(new Set(GRC_BUILTIN_CODES).size).toBe(GRC_BUILTIN_CODES.length)
  })

  it('chaque référentiel a un domaine valide et des exigences bien formées', () => {
    for (const r of GRC_BUILTINS) {
      expect(DOMAINES).toContain(r.domaine)
      expect(r.nom.length).toBeGreaterThan(0)
      expect(r.version.length).toBeGreaterThan(0)
      expect(r.exigences.length).toBeGreaterThan(0)
      const refs = r.exigences.map(e => e.ref)
      expect(new Set(refs).size, `refs dupliquées dans ${r.code}`).toBe(refs.length)
      for (const e of r.exigences) {
        expect(e.ref.length).toBeGreaterThan(0)
        expect(e.nom.length).toBeGreaterThan(0)
      }
    }
  })

  it('couvre bien des domaines hors cyber', () => {
    const domaines = new Set(GRC_BUILTINS.map(r => r.domaine))
    expect(domaines.has('LCB_FT')).toBe(true)
    expect(domaines.has('SANCTIONS_GEL')).toBe(true)
    expect(domaines.has('CREDIT_CONTREPARTIE')).toBe(true)
    expect(domaines.has('SECURITE_SI')).toBe(false) // le non-cyber ne recouvre pas le cyber
  })
})

describe('helpers GRC', () => {
  it('isGrcBuiltin / grcBuiltinByCode', () => {
    expect(isGrcBuiltin('LCB_FT')).toBe(true)
    expect(isGrcBuiltin('ISO27001')).toBe(false)
    expect(grcBuiltinByCode('RGPD')?.domaine).toBe('PROTECTION_DONNEES')
    expect(grcBuiltinByCode('inconnu')).toBeUndefined()
  })

  it('grcCodeFromNom résout noms et alias', () => {
    expect(grcCodeFromNom('RGPD')).toBe('RGPD')
    expect(grcCodeFromNom('gel des avoirs')).toBe('SANCTIONS_GEL')
    expect(grcCodeFromNom('LCB-FT')).toBe('LCB_FT')
    expect(grcCodeFromNom('Sapin II')).toBe('SAPIN2')
    expect(grcCodeFromNom('DSP2')).toBe('DSP2')
    expect(grcCodeFromNom('n’importe quoi')).toBeNull()
    expect(grcCodeFromNom('')).toBeNull()
  })
})
