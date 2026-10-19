import { describe, it, expect } from 'vitest'
import { statutAnalyseAffiche, estFinalisee, compterStatutsAnalyses } from '@/lib/dashboard-statut'

// Recette n° 62 (2026-10-19) : le tableau de bord affichait « En cours » pour toute analyse
// non TERMINE et n'en comptait aucune approuvée dans « Terminées ».
describe('statutAnalyseAffiche', () => {
  it('rend le statut réel de chaque analyse', () => {
    for (const s of ['EN_COURS', 'SOUMIS', 'APPROUVE', 'REJETE', 'TERMINE'] as const) {
      expect(statutAnalyseAffiche(s).cle).toBe(s)
    }
  })
  it('donne une teinte propre à chaque statut', () => {
    const teintes = new Set(['EN_COURS', 'SOUMIS', 'APPROUVE', 'REJETE'].map(s => statutAnalyseAffiche(s).ton))
    expect(teintes.size).toBe(4)
    expect(statutAnalyseAffiche('APPROUVE').ton).toBe(statutAnalyseAffiche('TERMINE').ton)
  })
  it('replie un statut inconnu sur EN_COURS', () => {
    expect(statutAnalyseAffiche('XYZ').cle).toBe('EN_COURS')
    expect(statutAnalyseAffiche(null).cle).toBe('EN_COURS')
  })
})

describe('estFinalisee', () => {
  it('vrai pour APPROUVE et TERMINE uniquement', () => {
    expect(estFinalisee('APPROUVE')).toBe(true)
    expect(estFinalisee('TERMINE')).toBe(true)
    expect(estFinalisee('SOUMIS')).toBe(false)
    expect(estFinalisee('REJETE')).toBe(false)
    expect(estFinalisee('EN_COURS')).toBe(false)
  })
})

describe('compterStatutsAnalyses', () => {
  it('compte les approuvées dans « Approuvées / terminées »', () => {
    const s = compterStatutsAnalyses([{ statut: 'APPROUVE' }])
    expect(s).toEqual({ total: 1, enCours: 0, soumises: 0, approuvees: 1, rejetees: 0, terminees: 0, finalisees: 1 })
  })
  it('ventile chaque statut (« en cours » = EN_COURS, comme le filtre de la liste)', () => {
    const s = compterStatutsAnalyses(['EN_COURS', 'EN_COURS', 'SOUMIS', 'APPROUVE', 'REJETE', 'TERMINE'].map(statut => ({ statut })))
    expect(s.total).toBe(6)
    expect(s.enCours).toBe(2)
    expect(s.soumises).toBe(1)
    expect(s.rejetees).toBe(1)
    expect(s.finalisees).toBe(2)
  })
})
