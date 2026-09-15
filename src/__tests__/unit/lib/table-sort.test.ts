import { describe, it, expect } from 'vitest'
import { nextSort, sortRows, sortIndicator, type SortState } from '@/lib/table-sort'

describe('table-sort', () => {
  it('nextSort cycle : aucun → asc → desc → aucun', () => {
    expect(nextSort(null, 'nom')).toEqual({ key: 'nom', dir: 'asc' })
    expect(nextSort({ key: 'nom', dir: 'asc' }, 'nom')).toEqual({ key: 'nom', dir: 'desc' })
    expect(nextSort({ key: 'nom', dir: 'desc' }, 'nom')).toBeNull()
    // changer de colonne repart en asc
    expect(nextSort({ key: 'nom', dir: 'desc' }, 'date')).toEqual({ key: 'date', dir: 'asc' })
  })

  const rows = [
    { id: 'a', n: 3, s: 'Banane', d: new Date('2026-03-01') },
    { id: 'b', n: 1, s: 'abricot', d: new Date('2026-01-01') },
    { id: 'c', n: 2, s: 'Cerise', d: null as Date | null },
  ]
  const acc = (r: typeof rows[number], k: string) => (r as unknown as Record<string, unknown>)[k]

  it('sortRows par nombre (asc/desc)', () => {
    expect(sortRows(rows, { key: 'n', dir: 'asc' }, acc).map(r => r.id)).toEqual(['b', 'c', 'a'])
    expect(sortRows(rows, { key: 'n', dir: 'desc' }, acc).map(r => r.id)).toEqual(['a', 'c', 'b'])
  })

  it('sortRows par chaîne, insensible casse/accents et numérique', () => {
    expect(sortRows(rows, { key: 's', dir: 'asc' }, acc).map(r => r.id)).toEqual(['b', 'a', 'c'])
  })

  it('sortRows : les valeurs vides restent en fin (asc ET desc)', () => {
    // 'c' a une date null → toujours en dernier
    expect(sortRows(rows, { key: 'd', dir: 'asc' }, acc).map(r => r.id)).toEqual(['b', 'a', 'c'])
    expect(sortRows(rows, { key: 'd', dir: 'desc' }, acc).map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('sortRows sans tri : copie inchangée', () => {
    const out = sortRows(rows, null as SortState | null, acc)
    expect(out.map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(rows)
  })

  it('sortIndicator : flèche seulement sur la colonne active', () => {
    expect(sortIndicator({ key: 'n', dir: 'asc' }, 'n')).toBe('▲')
    expect(sortIndicator({ key: 'n', dir: 'desc' }, 'n')).toBe('▼')
    expect(sortIndicator({ key: 'n', dir: 'asc' }, 's')).toBe('')
    expect(sortIndicator(null, 'n')).toBe('')
  })
})
