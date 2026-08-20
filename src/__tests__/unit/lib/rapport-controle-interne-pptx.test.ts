// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { renderRapportControleInternePptx } from '../../../lib/rapport-controle-interne-pptx'
import { buildRapportControleInterne } from '../../../lib/rapport-controle-interne'
import { type ComiteConsolide, type ComiteModules } from '../../../lib/comite-pack'

const ALL: ComiteModules = { risques: true, appetit: true, incidents: true, controles: true, audit: true, regulateur: true, kri: true, dora: true }
const consolide: ComiteConsolide = {
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

describe('renderRapportControleInternePptx', () => {
  it('produit un Buffer PPTX non vide (signature ZIP « PK ») dans chaque langue', async () => {
    const rapport = buildRapportControleInterne(consolide, ALL)
    for (const loc of ['fr', 'en', 'de', 'es', 'it']) {
      const buf = await renderRapportControleInternePptx(rapport, loc, 'Banque Démo', '2026', '2026-08-20')
      expect(Buffer.isBuffer(buf)).toBe(true)
      expect(buf.length).toBeGreaterThan(2000)
      // .pptx est un conteneur OOXML (ZIP) : commence par 0x50 0x4B (« PK »).
      expect(buf[0]).toBe(0x50)
      expect(buf[1]).toBe(0x4b)
    }
  }, 30000)

  it('génère un support même sans aucune alerte (appréciation satisfaisante)', async () => {
    const sain = buildRapportControleInterne({ risques: { total: 5, eleve: 0, moyen: 1, faible: 4, nonCote: 0 }, actions: { total: 2, faits: 2, enRetard: 0, tauxAvancement: 100 } }, { ...ALL, appetit: false, incidents: false, regulateur: false, kri: false, dora: false, audit: false })
    const buf = await renderRapportControleInternePptx(sain, 'fr', 'Banque Démo', '2026', '2026-08-20')
    expect(buf.length).toBeGreaterThan(2000)
    expect(buf[0]).toBe(0x50)
  }, 30000)
})
