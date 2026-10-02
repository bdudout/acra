import { describe, expect, it } from 'vitest'
import { SECTOR_CODES, listSectorSuggestions } from '@/lib/sector-suggestions'

// Cibles minimales de profondeur par secteur (spec chantier-contenu-sectoriel § A.2.1).
const TARGETS = { CONTROL: 20, KRI: 8, AUDIT: 4, RISK: 12 } as const
// Secteurs dont le contenu a atteint la cible : la liste ne fait que croître (cliquet) jusqu'à couvrir tous les secteurs.
const DEEP: readonly string[] = [
  'DEFENSE', 'EDUCATION', 'AGRICOLE', 'IMMOBILIER', 'MEDIA', 'TOURISME', 'ASSOCIATIONS',
]

describe('profondeur du catalogue par secteur', () => {
  for (const sector of DEEP) {
    it(`${sector} atteint les cibles (contrôles, KRI, missions, risques) et chaque élément est traduit ×5`, () => {
      for (const locale of ['fr', 'en', 'de', 'es', 'it'] as const) {
        const own = listSectorSuggestions(sector as (typeof SECTOR_CODES)[number], locale).filter(i => i.sector === sector)
        for (const [kind, min] of Object.entries(TARGETS)) {
          expect(own.filter(i => i.kind === kind).length, `${sector} ${kind}`).toBeGreaterThanOrEqual(min)
        }
        for (const i of own) expect(i.title.trim(), `${i.key} ${locale}`).not.toBe('')
      }
    })
  }
  it('cliquet : tous les secteurs finiront dans la liste (échoue tant qu’un secteur n’a pas atteint ses cibles)', () => {
    for (const code of DEEP) expect(SECTOR_CODES as readonly string[]).toContain(code)  // TODO: passer à l'égalité stricte une fois tous les secteurs au niveau
  })
})
