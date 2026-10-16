import { describe, it, expect } from 'vitest'
import { lirePagination, paginer, trier, TAILLES_PAGE } from '@/lib/pagination'

const sp = (s: string) => new URLSearchParams(s)
const opts = { tris: ['intitule', 'echeance'] as const, triDefaut: 'intitule' as const }

describe('lirePagination', () => {
  it('sans « page » : null (réponse complète historique, consommateurs existants)', () => {
    expect(lirePagination(sp('q=x'), opts)).toBeNull()
  })
  it('valeurs par défaut et bornes', () => {
    expect(lirePagination(sp('page=1'), opts)).toEqual({ page: 1, taille: 50, tri: 'intitule', ordre: 'asc', q: '' })
    expect(lirePagination(sp('page=0&taille=9999&tri=inconnu&ordre=x'), opts)).toEqual({ page: 1, taille: 50, tri: 'intitule', ordre: 'asc', q: '' })
    expect(lirePagination(sp('page=3&taille=100&tri=echeance&ordre=desc&q=%20 Pare-feu '), opts)).toEqual({ page: 3, taille: 100, tri: 'echeance', ordre: 'desc', q: 'Pare-feu' })
    expect(TAILLES_PAGE).toEqual([25, 50, 100])
  })
})

describe('paginer', () => {
  const items = Array.from({ length: 120 }, (_, i) => i)
  it('découpe la page et calcule le total', () => {
    const r = paginer(items, { page: 2, taille: 50 })
    expect(r.items).toEqual(items.slice(50, 100))
    expect(r.pagination).toEqual({ page: 2, taille: 50, total: 120, pages: 3 })
  })
  it('page au-delà de la fin → dernière page', () => {
    expect(paginer(items, { page: 9, taille: 50 }).pagination.page).toBe(3)
    expect(paginer([], { page: 4, taille: 50 })).toEqual({ items: [], pagination: { page: 1, taille: 50, total: 0, pages: 1 } })
  })
})

describe('trier', () => {
  const rows = [{ n: 'b', d: null }, { n: 'A', d: '2026-01-02' }, { n: 'c', d: '2026-01-01' }]
  it('texte insensible à la casse et aux accents ; valeurs nulles en fin', () => {
    expect(trier(rows, r => r.n, 'asc').map(r => r.n)).toEqual(['A', 'b', 'c'])
    expect(trier(rows, r => r.d, 'asc').map(r => r.n)).toEqual(['c', 'A', 'b'])
    expect(trier(rows, r => r.d, 'desc').map(r => r.n)).toEqual(['A', 'c', 'b'])
  })
})
