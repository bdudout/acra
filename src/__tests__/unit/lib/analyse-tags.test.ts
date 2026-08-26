import { describe, it, expect } from 'vitest'
import { cleanTags, parseTagsInput, filtrerParTag, tagsUniques } from '@/lib/analyse-tags'

describe('cleanTags', () => {
  it('trim, non vides, dédupliqués (casse-insensible)', () => {
    expect(cleanTags([' Programme SI ', 'programme si', '', '  ', 'BU Paie'])).toEqual(['Programme SI', 'BU Paie'])
  })
  it('ignore les non-chaînes et plafonne la longueur', () => {
    expect(cleanTags(['ok', 3, null])).toEqual(['ok'])
    expect(cleanTags(['x'.repeat(60)])[0].length).toBe(40)
  })
  it('plafonne le nombre de tags à 20', () => {
    expect(cleanTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20)
  })
  it('entrée non-tableau → []', () => { expect(cleanTags('x')).toEqual([]) })
})

describe('parseTagsInput', () => {
  it('découpe sur virgules / points-virgules / retours ligne', () => {
    expect(parseTagsInput('Programme A, BU RH; Projet X\nProgramme A')).toEqual(['Programme A', 'BU RH', 'Projet X'])
  })
})

describe('filtrerParTag / tagsUniques', () => {
  const list = [
    { id: '1', tags: ['Programme SI', 'BU RH'] },
    { id: '2', tags: ['BU Paie'] },
    { id: '3', tags: null },
  ]
  it('filtre par tag exact, casse-insensible', () => {
    expect(filtrerParTag(list, 'bu rh').map(a => a.id)).toEqual(['1'])
    expect(filtrerParTag(list, '').map(a => a.id)).toEqual(['1', '2', '3']) // pas de filtre
  })
  it('tagsUniques : distincts, triés', () => {
    expect(tagsUniques(list)).toEqual(['BU Paie', 'BU RH', 'Programme SI'])
  })
})
