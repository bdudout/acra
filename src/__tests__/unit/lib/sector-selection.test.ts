import { describe, expect, it } from 'vitest'
import { moveSector, toggleSector, MAX_SECTORS, effectiveSectors, parseSectorChoice } from '@/lib/sector-selection'
import { listSectorSuggestions } from '@/lib/sector-suggestions'

describe('sélection des secteurs d’une organisation (le 1er = secteur principal)', () => {
  it('ajoute en fin, retire, et plafonne à trois secteurs', () => {
    expect(MAX_SECTORS).toBe(3)
    expect(toggleSector([], 'SANTE')).toEqual(['SANTE'])
    expect(toggleSector(['SANTE'], 'SAAS')).toEqual(['SANTE', 'SAAS'])
    expect(toggleSector(['SANTE', 'SAAS'], 'SANTE')).toEqual(['SAAS'])
    expect(toggleSector(['SANTE', 'SAAS', 'PUBLIC'], 'FINANCE')).toEqual(['SANTE', 'SAAS', 'PUBLIC']) // plafond : inchangé
    expect(toggleSector(['SANTE'], 'INCONNU')).toEqual(['SANTE']) // code inconnu ignoré
  })
  it('monte / descend un secteur, sans sortir des bornes', () => {
    expect(moveSector(['SANTE', 'SAAS', 'PUBLIC'], 'PUBLIC', 'up')).toEqual(['SANTE', 'PUBLIC', 'SAAS'])
    expect(moveSector(['SANTE', 'SAAS'], 'SANTE', 'up')).toEqual(['SANTE', 'SAAS'])
    expect(moveSector(['SANTE', 'SAAS'], 'SAAS', 'down')).toEqual(['SANTE', 'SAAS'])
    expect(moveSector(['SANTE', 'SAAS'], 'INCONNU', 'up')).toEqual(['SANTE', 'SAAS'])
  })
})


describe('organisation multisecteur', () => {
  it('une filiale sans secteur hérite de l’ancêtre le plus proche ; ses propres secteurs priment', () => {
    expect(effectiveSectors([[], null, ['FINANCE', 'ASSURANCE']])).toEqual({ own: [], effective: ['FINANCE', 'ASSURANCE'], inherited: true })
    expect(effectiveSectors([['SANTE'], ['FINANCE']])).toEqual({ own: ['SANTE'], effective: ['SANTE'], inherited: false })
    expect(effectiveSectors([[], ['INCONNU']])).toEqual({ own: [], effective: [], inherited: false })
  })
  it('choix : un secteur, tous les secteurs effectifs, le socle seul ; code inconnu refusé', () => {
    expect(parseSectorChoice('ALL', ['FINANCE', 'ASSURANCE'])).toEqual(['FINANCE', 'ASSURANCE'])
    expect(parseSectorChoice('SANTE', ['FINANCE'])).toEqual(['SANTE'])
    expect(parseSectorChoice('TRANSVERSAL', ['FINANCE'])).toEqual([])
    expect(parseSectorChoice(null, ['FINANCE'])).toEqual([])
    expect(parseSectorChoice('XX', ['FINANCE'])).toBeUndefined()
  })
  it('l’union de plusieurs secteurs propose chaque pack une fois, sans doublon', () => {
    const items = listSectorSuggestions(['FINANCE', 'ASSURANCE'], 'fr')
    expect(new Set(items.map(i => i.key)).size).toBe(items.length)
    expect(items.some(i => i.key.startsWith('finance.'))).toBe(true)
    expect(items.some(i => i.key.startsWith('assurance.'))).toBe(true)
    expect(items.some(i => i.key.startsWith('sante.'))).toBe(false)
  })
})
