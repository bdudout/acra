import { describe, it, expect } from 'vitest'
import { buildPolitiqueDefaut, POLITIQUE_DEFAUT_CODE, MISSIONS_DEFAUT, EXIGENCES_DEFAUT } from '../../../lib/politique-defaut'
import { cleanReferentielInput, validateReferentielInput } from '../../../lib/referentiel'

describe('politique de sécurité par défaut', () => {
  it('produit un référentiel PSSI valide (code, type, missions, exigences)', () => {
    const input = buildPolitiqueDefaut()
    expect(validateReferentielInput(input)).toBeNull()
    const clean = cleanReferentielInput(input)
    expect(clean.code).toBe(POLITIQUE_DEFAUT_CODE)
    expect(clean.type).toBe('PSSI')
    expect(clean.exigences.length).toBe(EXIGENCES_DEFAUT.length)
    expect(clean.missions.length).toBe(MISSIONS_DEFAUT.length)
  })

  it('porte la mission phare : protéger le DIC des données et services clients', () => {
    const mission = MISSIONS_DEFAUT[0]
    expect(mission.intitule).toMatch(/DIC/)
    expect(mission.intitule.toLowerCase()).toMatch(/client/)
  })

  it('couvre les 5 piliers DORA et des exigences transverses ISO', () => {
    const cats = new Set(EXIGENCES_DEFAUT.map(e => e.categorie))
    expect([...cats].some(c => c.includes('DORA 1'))).toBe(true)
    expect([...cats].some(c => c.includes('DORA 2'))).toBe(true)
    expect([...cats].some(c => c.includes('DORA 3'))).toBe(true)
    expect([...cats].some(c => c.includes('DORA 4'))).toBe(true)
    expect([...cats].some(c => c.includes('DORA 5'))).toBe(true)
    // Références uniques et non vides.
    const refs = EXIGENCES_DEFAUT.map(e => e.ref)
    expect(new Set(refs).size).toBe(refs.length)
    expect(refs.every(r => r.length > 0)).toBe(true)
  })

  it('couvre les 4 types de contrôle ISO 27002 (org / humain / physique / techno)', () => {
    const types = new Set(EXIGENCES_DEFAUT.map(e => e.type))
    expect(types.has('ORGANISATIONNELLE')).toBe(true)
    expect(types.has('HUMAINE')).toBe(true)
    expect(types.has('PHYSIQUE')).toBe(true)
    expect(types.has('TECHNOLOGIQUE')).toBe(true)
  })
})
