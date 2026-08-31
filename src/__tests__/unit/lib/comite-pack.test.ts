import { describe, it, expect } from 'vitest'
import { buildComitePack, verdictGlobal, verdictDispositif, COMITE_TYPES, type ComiteConsolide } from '../../../lib/comite-pack'

const MODULES_ON = { risques: true, appetit: true, incidents: true, controles: true, audit: true, regulateur: true, kri: true, dora: true }

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

describe('verdictGlobal (#134 M5 — verdict RAG en tête du pack décideur)', () => {
  it('aucune alerte → MAITRISE', () => {
    const pack = buildComitePack('RISQUES', { risques: { total: 5, eleve: 0, moyen: 2, faible: 3, nonCote: 0 } }, MODULES_ON)
    expect(verdictGlobal(pack).niveau).toBe('MAITRISE')
    expect(verdictGlobal(pack).alertes).toBe(0)
  })
  it('un signal de crise (constats critiques) → ELEVE', () => {
    const pack = buildComitePack('RISQUES', { audit: { critiques: 1, recosEnRetard: 0 } }, MODULES_ON)
    expect(verdictGlobal(pack).niveau).toBe('ELEVE')
  })
  it('des alertes non critiques (3) → MODERE', () => {
    const pack = buildComitePack('RISQUES', {
      appetit: { horsAppetit: 1, dansAppetit: 9, evalues: 10 },
      risques: { total: 3, eleve: 0, moyen: 0, faible: 3, nonCote: 0 }, actions: { total: 5, faits: 1, enRetard: 2, tauxAvancement: 20 },
      controles: { tauxConformite: 50, anomalies: 3 },
    }, MODULES_ON)
    expect(verdictGlobal(pack).niveau).toBe('MODERE')
  })
  it('une seule alerte non critique → MODERE', () => {
    const pack = buildComitePack('RISQUES', { appetit: { horsAppetit: 2, dansAppetit: 8, evalues: 10 } }, MODULES_ON)
    expect(verdictGlobal(pack).niveau).toBe('MODERE')
  })
})

describe('buildComitePack — heatmap (#134 M5)', () => {
  it('passe la grille heatmap du consolidé au pack ; absente si non fournie', () => {
    const grid = { gravites: [5, 4, 3, 2, 1], vraisemblances: [1, 2, 3, 4, 5], counts: {}, buckets: {} } as never
    const avec = buildComitePack('RISQUES', { risques: { total: 1, eleve: 0, moyen: 0, faible: 1, nonCote: 0, grid } }, MODULES_ON)
    expect(avec.heatmap).toBe(grid)
    const sans = buildComitePack('RISQUES', { risques: { total: 1, eleve: 0, moyen: 0, faible: 1, nonCote: 0 } }, MODULES_ON)
    expect(sans.heatmap).toBeUndefined()
  })
})

describe('verdictDispositif (#136 — verdict cockpit à partir des signaux bruts)', () => {
  it('signal de crise (DORA majeur) → ELEVE', () => {
    expect(verdictDispositif({ doraMajeurs: 3 }).niveau).toBe('ELEVE')
    expect(verdictDispositif({ constatsCritiques: 1 }).niveau).toBe('ELEVE')
  })
  it('alertes non critiques : 1 → MODERE, ≥4 → ELEVE', () => {
    expect(verdictDispositif({ horsAppetit: 2 }).niveau).toBe('MODERE')
    expect(verdictDispositif({ horsAppetit: 1, conformiteSousSeuil: true, actionsEnRetard: 3 }).niveau).toBe('MODERE')
    expect(verdictDispositif({ horsAppetit: 1, conformiteSousSeuil: true, actionsEnRetard: 3, doraMajeurs: 1 }).niveau).toBe('ELEVE')
  })
  it('aucun signal → MAITRISE', () => {
    expect(verdictDispositif({}).niveau).toBe('MAITRISE')
    expect(verdictDispositif({ horsAppetit: 0, conformiteSousSeuil: false }).alertes).toBe(0)
  })
})

describe('buildComitePack — flag positif (RAG vert, #134)', () => {
  it('« dans l’appétit » positif ; conformité ≥ seuil positif, < seuil alerte', () => {
    const pack = buildComitePack('RISQUES', {
      appetit: { horsAppetit: 0, dansAppetit: 10, evalues: 10 },
      controles: { tauxConformite: 92, anomalies: 0 },
    }, MODULES_ON)
    expect(pack.sections.find(s => s.id === 'appetit')!.metrics.find(m => m.key === 'dansAppetit')?.positif).toBe(true)
    expect(pack.sections.find(s => s.id === 'controles')!.metrics.find(m => m.key === 'tauxConformite')?.positif).toBe(true)
    const bas = buildComitePack('RISQUES', { controles: { tauxConformite: 50, anomalies: 1 } }, MODULES_ON)
    const ctrlBas = bas.sections.find(s => s.id === 'controles')!.metrics.find(m => m.key === 'tauxConformite')
    expect(ctrlBas?.positif).toBeFalsy()
    expect(ctrlBas?.alerte).toBe(true)
  })
})
