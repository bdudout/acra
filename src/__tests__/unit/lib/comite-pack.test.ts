import { describe, it, expect } from 'vitest'
import { buildComitePack, COMITE_TYPES, type ComiteConsolide } from '../../../lib/comite-pack'

const base: ComiteConsolide = {
  risques: { total: 20, eleve: 3, moyen: 7, faible: 8, nonCote: 2 },
  actions: { total: 12, faits: 5, enRetard: 4, tauxAvancement: 42 },
  appetit: { horsAppetit: 2, dansAppetit: 15, evalues: 17 },
  incidents: { total: 8, ouverts: 3, perteNette: 125000 },
  controles: { tauxConformite: 72, anomalies: 5 },
  audit: { critiques: 1, recosEnRetard: 2 },
  regulateur: { echues: 1, sous30j: 3 },
  kri: { enAlerte: 2, critique: 1 },
  dora: { majeurs: 1, evalues: 4 },
}

describe('buildComitePack', () => {
  it('produit les sections d’un comité des risques avec les modules fournis', () => {
    const pack = buildComitePack('RISQUES', base, { risques: true, appetit: true, incidents: true, controles: true, audit: true, regulateur: true, kri: true, dora: true })
    const ids = pack.sections.map(s => s.id)
    expect(ids).toContain('risques')
    expect(ids).toContain('appetit')
    expect(ids).toContain('incidents')
    expect(pack.type).toBe('RISQUES')
  })

  it('omet les sections dont le module est inactif', () => {
    const pack = buildComitePack('RISQUES', base, { risques: true, appetit: false, incidents: false, controles: false, audit: false, regulateur: false, kri: false, dora: false })
    const ids = pack.sections.map(s => s.id)
    expect(ids).toEqual(['risques'])
  })

  it('remonte des points d’alerte (highlights) sur les seuils dépassés', () => {
    const pack = buildComitePack('RISQUES', base, { risques: true, appetit: true, incidents: true, controles: true, audit: true, regulateur: true, kri: true, dora: true })
    // hors appétit, actions en retard, conformité < 80, constats critiques, recos régulateur échues,
    // KRI critiques, incidents DORA majeurs → au moins un highlight de niveau 'alerte'.
    expect(pack.highlights.length).toBeGreaterThan(0)
    expect(pack.highlights.some(h => h.niveau === 'alerte')).toBe(true)
  })

  it('aucun highlight quand tout est au vert', () => {
    const sain: ComiteConsolide = {
      risques: { total: 10, eleve: 0, moyen: 2, faible: 8, nonCote: 0 },
      actions: { total: 5, faits: 5, enRetard: 0, tauxAvancement: 100 },
      appetit: { horsAppetit: 0, dansAppetit: 10, evalues: 10 },
      controles: { tauxConformite: 95, anomalies: 0 },
      audit: { critiques: 0, recosEnRetard: 0 },
      regulateur: { echues: 0, sous30j: 0 },
      kri: { enAlerte: 0, critique: 0 },
    }
    const pack = buildComitePack('RISQUES', sain, { risques: true, appetit: true, incidents: false, controles: true, audit: true, regulateur: true, kri: true, dora: false })
    expect(pack.highlights.filter(h => h.niveau === 'alerte')).toEqual([])
  })

  it('expose la liste des types de comité', () => {
    expect(COMITE_TYPES).toContain('RISQUES')
    expect(COMITE_TYPES).toContain('CONFORMITE')
    expect(COMITE_TYPES).toContain('INCIDENTS')
  })
})
