import { describe, it, expect } from 'vitest'
import { buildRapportControleInterne, APPRECIATIONS } from '../../../lib/rapport-controle-interne'
import { type ComiteConsolide, type ComiteModules } from '../../../lib/comite-pack'

const ALL: ComiteModules = { risques: true, appetit: true, incidents: true, controles: true, audit: true, regulateur: true, kri: true, dora: true }

const sain: ComiteConsolide = {
  risques: { total: 10, eleve: 0, moyen: 2, faible: 8, nonCote: 0 },
  actions: { total: 5, faits: 5, enRetard: 0, tauxAvancement: 100 },
  appetit: { horsAppetit: 0, dansAppetit: 10, evalues: 10 },
  incidents: { total: 3, ouverts: 0, perteNette: 0 },
  controles: { tauxConformite: 95, anomalies: 0 },
  audit: { critiques: 0, recosEnRetard: 0 },
  regulateur: { echues: 0, sous30j: 0 },
  kri: { enAlerte: 0, critique: 0 },
  dora: { majeurs: 0, evalues: 2 },
}

const degrade: ComiteConsolide = {
  ...sain,
  actions: { total: 5, faits: 1, enRetard: 3, tauxAvancement: 20 },
  appetit: { horsAppetit: 4, dansAppetit: 6, evalues: 10 },
  controles: { tauxConformite: 60, anomalies: 5 },
  audit: { critiques: 2, recosEnRetard: 1 },
  regulateur: { echues: 2, sous30j: 1 },
  kri: { enAlerte: 3, critique: 2 },
  dora: { majeurs: 1, evalues: 3 },
}

describe('buildRapportControleInterne', () => {
  it('regroupe les sections par ligne de défense (1, 2, 3, TIC)', () => {
    const r = buildRapportControleInterne(sain, ALL)
    expect(r.groupes.map(g => g.ligne)).toEqual(['1', '2', '3', 'TIC'])
    const l1 = r.groupes.find(g => g.ligne === '1')!
    expect(l1.sections.map(s => s.id).sort()).toEqual(['controles', 'incidents', 'risques'])
    const l3 = r.groupes.find(g => g.ligne === '3')!
    expect(l3.sections.map(s => s.id)).toEqual(['audit'])
    const tic = r.groupes.find(g => g.ligne === 'TIC')!
    expect(tic.sections.map(s => s.id)).toEqual(['dora'])
  })

  it('omet une ligne de défense sans section active', () => {
    const r = buildRapportControleInterne(sain, { ...ALL, audit: false })
    expect(r.groupes.map(g => g.ligne)).toEqual(['1', '2', 'TIC'])
  })

  it('apprécie SATISFAISANT sans alerte', () => {
    const r = buildRapportControleInterne(sain, ALL)
    expect(r.appreciation).toBe('SATISFAISANT')
    expect(r.highlights.filter(h => h.niveau === 'alerte')).toEqual([])
  })

  it('apprécie INSUFFISANT quand les alertes s’accumulent', () => {
    const r = buildRapportControleInterne(degrade, ALL)
    expect(r.appreciation).toBe('INSUFFISANT')
    expect(r.highlights.some(h => h.niveau === 'alerte')).toBe(true)
  })

  it('expose la liste des appréciations', () => {
    expect(APPRECIATIONS).toEqual(['SATISFAISANT', 'A_RENFORCER', 'INSUFFISANT'])
  })
})
