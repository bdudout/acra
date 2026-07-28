import { describe, it, expect } from 'vitest'
import {
  validateProcessusInput, cleanProcessus, buildProcessusTree, wouldCreateCycle,
} from '@/lib/processus'

describe('validateProcessusInput', () => {
  it('nom requis', () => {
    expect(validateProcessusInput({ nom: '  ' })).toBe('nom_requis')
    expect(validateProcessusInput({ nom: 'Achats' })).toBeNull()
  })
  it('criticité 1-4 ou null', () => {
    expect(validateProcessusInput({ nom: 'X', criticite: 5 })).toBe('criticite_invalide')
    expect(validateProcessusInput({ nom: 'X', criticite: 0 })).toBe('criticite_invalide')
    expect(validateProcessusInput({ nom: 'X', criticite: 3 })).toBeNull()
    expect(validateProcessusInput({ nom: 'X', criticite: null })).toBeNull()
  })
})

describe('cleanProcessus', () => {
  it('normalise et clampe', () => {
    const c = cleanProcessus({ nom: '  Paie  ', criticite: 9, proprietaire: '  ', parentId: ' p1 ', actif: false })
    expect(c.nom).toBe('Paie')
    expect(c.criticite).toBe(4)          // clampé
    expect(c.proprietaire).toBeNull()     // vide après trim
    expect(c.parentId).toBe('p1')
    expect(c.actif).toBe(false)
    expect(c.ordre).toBe(0)
  })
})

describe('buildProcessusTree', () => {
  const list = [
    { id: 'a', parentId: null, ordre: 1 },
    { id: 'a1', parentId: 'a', ordre: 2 },
    { id: 'a2', parentId: 'a', ordre: 1 },
    { id: 'b', parentId: null, ordre: 0 },
    { id: 'orphan', parentId: 'ABSENT', ordre: 5 }, // parent inexistant → racine
  ]
  it('construit l\'arbre, trie par ordre, remonte les orphelins à la racine', () => {
    const t = buildProcessusTree(list)
    expect(t.map(n => n.id)).toEqual(['b', 'a', 'orphan']) // triés par ordre (0,1,5)
    const a = t.find(n => n.id === 'a')!
    expect(a.enfants.map(n => n.id)).toEqual(['a2', 'a1']) // enfants triés (1,2)
  })
})

describe('wouldCreateCycle', () => {
  const list = [
    { id: 'a', parentId: null },
    { id: 'a1', parentId: 'a' },
    { id: 'a1x', parentId: 'a1' },
    { id: 'b', parentId: null },
  ]
  it('re-parenter sous soi-même → cycle', () => {
    expect(wouldCreateCycle(list, 'a', 'a')).toBe(true)
  })
  it('re-parenter sous un descendant → cycle', () => {
    expect(wouldCreateCycle(list, 'a', 'a1x')).toBe(true)
    expect(wouldCreateCycle(list, 'a', 'a1')).toBe(true)
  })
  it('re-parenter sous un non-descendant → OK', () => {
    expect(wouldCreateCycle(list, 'a1', 'b')).toBe(false)
    expect(wouldCreateCycle(list, 'b', 'a1x')).toBe(false)
  })
  it('détacher (parent null) → jamais de cycle', () => {
    expect(wouldCreateCycle(list, 'a1', null)).toBe(false)
  })
})
