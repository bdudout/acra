import { describe, expect, it } from 'vitest'
import { normalizeSecteursMasques, secteursVisibles } from '@/lib/secteurs-masques'
import { SECTEURS_ACTIVITE } from '@/lib/ebios-data'
import { getEbiosData } from '@/lib/ebios-data-i18n'

describe('normalizeSecteursMasques', () => {
  it('ne garde que des secteurs connus (libellé français canonique), sans doublon', () => {
    expect(normalizeSecteursMasques(['Banque / Finance', 'Inconnu', 'Banque / Finance', 3, 'Santé / Médico-social'])).toEqual(['Banque / Finance', 'Santé / Médico-social'])
    expect(normalizeSecteursMasques('x')).toEqual([])
  })
  it('refuse de tout masquer (la liste ne doit jamais être vide)', () => {
    expect(normalizeSecteursMasques([...SECTEURS_ACTIVITE])).toEqual([])
  })
})

describe('secteursVisibles', () => {
  it('masque par position dans la langue affichée', () => {
    const en = getEbiosData('en').SECTEURS_ACTIVITE as string[]
    const i = SECTEURS_ACTIVITE.indexOf('Banque / Finance')
    const visibles = secteursVisibles(en, ['Banque / Finance'])
    expect(visibles).not.toContain(en[i])
    expect(visibles).toHaveLength(en.length - 1)
  })
  it('conserve la valeur déjà choisie même si elle est masquée', () => {
    const fr = [...SECTEURS_ACTIVITE]
    expect(secteursVisibles(fr, ['Banque / Finance'], 'Banque / Finance')).toContain('Banque / Finance')
  })
  it('aucun masque : liste inchangée', () => {
    const fr = [...SECTEURS_ACTIVITE]
    expect(secteursVisibles(fr, [])).toEqual(fr)
  })
})
