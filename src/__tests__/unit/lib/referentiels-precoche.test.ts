import { describe, it, expect } from 'vitest'
import { precheckReferentiels } from '@/lib/referentiels-precoche'

describe('precheckReferentiels', () => {
  const org = [
    { nom: 'ISO/IEC 27001:2022' },
    { nom: 'CIS Controls v8' },
    { nom: 'Politique interne' },
    { nom: 'DORA' },
  ]
  it('pré-coche les référentiels org correspondant aux cadres recommandés', () => {
    const r = precheckReferentiels(['ISO/IEC 27001', 'DORA'], org)
    expect(r.map(x => x.nom)).toEqual(['ISO/IEC 27001:2022', 'DORA'])
    expect(r[0]).toEqual({ nom: 'ISO/IEC 27001:2022', applicable: true, ecarts: '', etatApplication: 'APPLIQUE' })
  })
  it('tolère les suffixes de version (préfixe normalisé)', () => {
    expect(precheckReferentiels(['CIS Controls'], org).map(x => x.nom)).toEqual(['CIS Controls v8'])
  })
  it('insensible à la casse / espaces', () => {
    expect(precheckReferentiels(['  dora '], org).map(x => x.nom)).toEqual(['DORA'])
  })
  it('ignore les recommandations sans référentiel org correspondant', () => {
    expect(precheckReferentiels(['NIST SP 800-53'], org)).toEqual([])
  })
  it('aucune recommandation → []', () => {
    expect(precheckReferentiels([], org)).toEqual([])
    expect(precheckReferentiels(['ISO 27001'], [])).toEqual([])
  })
})
