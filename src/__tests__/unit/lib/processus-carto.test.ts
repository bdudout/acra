import { describe, expect, it } from 'vitest'
import {
  ETAPES_CARTO, PERIODICITES, sanitizeProcessusCarto, resolveProcessusCarto, prochaineRevue, statutRevue,
} from '@/lib/processus-carto'

const DEFAULTS = ETAPES_CARTO.map(k => ({ key: k, titre: `T-${k}`, description: `D-${k}` }))

describe('processus de cartographie des risques', () => {
  it('cinq étapes par défaut, périodicités connues', () => {
    expect(ETAPES_CARTO).toEqual(['identification', 'evaluation', 'traitement', 'suivi', 'communication'])
    expect(PERIODICITES).toEqual(['TRIMESTRIELLE', 'SEMESTRIELLE', 'ANNUELLE'])
  })

  it('personnalisation bornée : étapes connues, textes tronqués, périodicité validée', () => {
    const s = sanitizeProcessusCarto({
      etapes: [{ key: 'identification', titre: ' Atelier RCSA ', description: 'x'.repeat(3000), responsable: 'RM', frequence: 'Annuelle' }, { key: 'inconnue', titre: 'x' }],
      periodicite: 'SEMESTRIELLE', introduction: ' Intro ',
    })
    expect(s.etapes).toHaveLength(1)
    expect(s.etapes[0]).toMatchObject({ key: 'identification', titre: 'Atelier RCSA', responsable: 'RM', frequence: 'Annuelle' })
    expect(s.etapes[0].description).toHaveLength(2000)
    expect(s.periodicite).toBe('SEMESTRIELLE')
    expect(s.introduction).toBe('Intro')
    expect(sanitizeProcessusCarto({ periodicite: 'X' }).periodicite).toBe('ANNUELLE')
  })

  it('résolution : la personnalisation surcharge le défaut étape par étape', () => {
    const r = resolveProcessusCarto({ etapes: [{ key: 'traitement', titre: 'Plans d’action', description: '' }] }, DEFAULTS)
    expect(r.etapes.map(e => e.titre)).toEqual(['T-identification', 'T-evaluation', 'Plans d’action', 'T-suivi', 'T-communication'])
    expect(r.etapes[2].description).toBe('D-traitement')
  })

  it('prochaine revue et statut', () => {
    const base = new Date('2026-01-15T00:00:00Z')
    expect(prochaineRevue(base, 'TRIMESTRIELLE').toISOString().slice(0, 10)).toBe('2026-04-15')
    expect(prochaineRevue(base, 'ANNUELLE').toISOString().slice(0, 10)).toBe('2027-01-15')
    expect(statutRevue(null, 'ANNUELLE', new Date('2026-09-29'))).toBe('JAMAIS')
    expect(statutRevue(base, 'SEMESTRIELLE', new Date('2026-06-01'))).toBe('A_JOUR')
    expect(statutRevue(base, 'SEMESTRIELLE', new Date('2026-06-20'))).toBe('BIENTOT')
    expect(statutRevue(base, 'SEMESTRIELLE', new Date('2026-09-29'))).toBe('EN_RETARD')
  })
})
