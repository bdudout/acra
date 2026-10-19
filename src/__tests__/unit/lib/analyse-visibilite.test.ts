/**
 * n° 63 (recette 2026-10-19) : la vue unitaire d'une analyse suit la MÊME règle de
 * visibilité que la liste (`analyseWhereClause`). Un rôle de lecture globale du dispositif
 * (DIRECTION_METIER, RSSI, RISK_MANAGER, 2ᵉ/3ᵉ ligne) voit les analyses publiées
 * (soumises, approuvées, rejetées, terminées), les siennes et celles partagées avec lui —
 * pas un brouillon EN_COURS d'un autre ; l'administrateur voit tout.
 */
import { describe, it, expect } from 'vitest'
import { analyseWhereClause, canViewAnalyse, STATUTS_ANALYSE_PUBLIES, type UserRole } from '@/lib/permissions'

const u = (role: UserRole, id = 'moi') => ({ id, role })
const a = (statut: string, over: Record<string, unknown> = {}) => ({ userId: 'autre', accesUtilisateurs: [], statut, ...over })

describe('canViewAnalyse — statut de l\'analyse (n° 63)', () => {
  it('lecture globale : brouillon EN_COURS d\'un autre refusé, analyses publiées visibles', () => {
    for (const role of ['DIRECTION_METIER', 'RSSI', 'RISK_MANAGER', 'CONTROLEUR', 'CONFORMITE', 'DPO', 'AUDITEUR'] as const) {
      expect(canViewAnalyse(u(role), a('EN_COURS'))).toBe(false)
      for (const s of ['SOUMIS', 'APPROUVE', 'REJETE', 'TERMINE']) expect(canViewAnalyse(u(role), a(s))).toBe(true)
    }
  })
  it('sa propre analyse ou une analyse partagée reste visible quel que soit le statut', () => {
    expect(canViewAnalyse(u('DIRECTION_METIER'), a('EN_COURS', { userId: 'moi' }))).toBe(true)
    expect(canViewAnalyse(u('RSSI'), a('EN_COURS', { accesUtilisateurs: [{ userId: 'moi', permission: 'LECTURE' }] }))).toBe(true)
  })
  it('administrateur : tout ; analyste ou lecteur : propres et partagées seulement', () => {
    expect(canViewAnalyse(u('ADMIN'), a('EN_COURS'))).toBe(true)
    expect(canViewAnalyse(u('SUPER_ADMIN'), a('EN_COURS'))).toBe(true)
    expect(canViewAnalyse(u('ANALYSTE'), a('APPROUVE'))).toBe(false)
    expect(canViewAnalyse(u('LECTEUR'), a('TERMINE'))).toBe(false)
  })
  it('une analyse archivée n\'est pas publiée pour la lecture globale', () => {
    expect(canViewAnalyse(u('DIRECTION_METIER'), a('ARCHIVE'))).toBe(false)
  })
})

describe('liste et vue unitaire : même ensemble de statuts publiés', () => {
  it('analyseWhereClause (lecture globale) ouvre exactement STATUTS_ANALYSE_PUBLIES', () => {
    const w = analyseWhereClause('moi', 'DIRECTION_METIER') as { OR: Record<string, unknown>[] }
    const statuts = w.OR.filter(c => 'statut' in c).map(c => c.statut)
    expect(statuts.sort()).toEqual([...STATUTS_ANALYSE_PUBLIES].sort())
    expect(STATUTS_ANALYSE_PUBLIES).toEqual(['SOUMIS', 'APPROUVE', 'REJETE', 'TERMINE'])
  })
})
