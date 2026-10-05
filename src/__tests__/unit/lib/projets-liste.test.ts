import { describe, expect, it } from 'vitest'
import { filtrerTrierProjets } from '@/lib/projets-liste'

const P = [
  { id: '1', nom: 'Refonte portail', statut: 'EN_COURS', risques: 7, updatedAt: '2026-09-20T00:00:00.000Z' },
  { id: '2', nom: 'Migration cloud', statut: 'APPROUVE', risques: 12, updatedAt: '2026-10-01T00:00:00.000Z' },
  { id: '3', nom: 'Élection CSE en ligne', statut: 'EN_COURS', risques: 2, updatedAt: '2026-08-01T00:00:00.000Z' },
]

describe('liste des projets : recherche, filtre, tri', () => {
  it('par défaut : plus récemment modifié d’abord', () => {
    expect(filtrerTrierProjets(P, {}).map(p => p.id)).toEqual(['2', '1', '3'])
  })
  it('recherche dans le nom, sans tenir compte de la casse ni des accents', () => {
    expect(filtrerTrierProjets(P, { q: 'election' }).map(p => p.id)).toEqual(['3'])
    expect(filtrerTrierProjets(P, { q: 'PORTAIL' }).map(p => p.id)).toEqual(['1'])
  })
  it('filtre par statut', () => {
    expect(filtrerTrierProjets(P, { statut: 'EN_COURS' }).map(p => p.id)).toEqual(['1', '3'])
  })
  it('tri par colonne, dans les deux sens', () => {
    expect(filtrerTrierProjets(P, { tri: 'nom', sens: 'asc' }).map(p => p.id)).toEqual(['3', '2', '1'])
    expect(filtrerTrierProjets(P, { tri: 'risques', sens: 'desc' }).map(p => p.id)).toEqual(['2', '1', '3'])
    expect(filtrerTrierProjets(P, { tri: 'risques', sens: 'asc' }).map(p => p.id)).toEqual(['3', '1', '2'])
  })
})
