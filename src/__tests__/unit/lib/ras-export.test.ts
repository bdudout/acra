import { describe, it, expect } from 'vitest'
import { buildRasExport, type RasRiskLite } from '../../../lib/ras-export'
import { type AppetitConfig } from '../../../lib/appetit'

const labelOf = (code: string) => ({ SI: 'Systèmes d\'information', FRAUDE: 'Fraude' }[code] ?? code)

const cfg: AppetitConfig = { seuilGlobal: 9, parCategorie: { FRAUDE: 4 } }

const risks: RasRiskLite[] = [
  { intitule: 'Panne SI', taxonomieCode: 'SI', niveauResiduel: 12 },     // 12 > 9 → HORS (écart 3)
  { intitule: 'Phishing', taxonomieCode: 'SI', niveauResiduel: 6 },      // 6 <= 9 → DANS
  { intitule: 'Détournement', taxonomieCode: 'FRAUDE', niveauResiduel: 9 }, // 9 > 4 → HORS (écart 5)
  { intitule: 'Non coté', taxonomieCode: 'SI', niveauResiduel: null },   // INCONNU
]

describe('buildRasExport', () => {
  it('expose le seuil global et les seuils par catégorie (avec libellés)', () => {
    const ras = buildRasExport(risks, cfg, labelOf)
    expect(ras.seuilGlobal).toBe(9)
    expect(ras.categories).toEqual([{ code: 'FRAUDE', label: 'Fraude', seuil: 4 }])
  })

  it('calcule la synthèse et le taux de conformité (dans / évalués)', () => {
    const ras = buildRasExport(risks, cfg, labelOf)
    expect(ras.synthese.total).toBe(4)
    expect(ras.synthese.evalues).toBe(3)
    expect(ras.synthese.horsAppetit).toBe(2)
    expect(ras.synthese.dansAppetit).toBe(1)
    expect(ras.tauxConformite).toBe(33) // 1/3
  })

  it('liste les dépassements triés par écart décroissant', () => {
    const ras = buildRasExport(risks, cfg, labelOf)
    expect(ras.depassements.map(d => d.intitule)).toEqual(['Détournement', 'Panne SI'])
    expect(ras.depassements[0]).toMatchObject({ categorieLabel: 'Fraude', niveauResiduel: 9, seuil: 4, ecart: 5 })
  })

  it('taux de conformité à 100 quand aucun risque évaluable (pas de division par zéro)', () => {
    const ras = buildRasExport([{ intitule: 'x', taxonomieCode: null, niveauResiduel: 5 }], { seuilGlobal: null, parCategorie: {} }, labelOf)
    expect(ras.synthese.evalues).toBe(0)
    expect(ras.tauxConformite).toBe(100)
    expect(ras.depassements).toEqual([])
  })
})
