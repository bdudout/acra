import { describe, it, expect } from 'vitest'
import { execGlobalLevel, execTopRisks, execMeasuresToEngage } from '@/lib/pdf-exec-summary'

// Résumé exécutif non technique du PDF (issue #76).

describe('execGlobalLevel', () => {
  it('none si aucun risque', () => {
    expect(execGlobalLevel([])).toBe('none')
    expect(execGlobalLevel(undefined)).toBe('none')
  })
  it('high dès qu\'un risque est critique (≥12)', () => {
    expect(execGlobalLevel([{ niveauRisque: 6 }, { niveauRisque: 16 }])).toBe('high')
  })
  it('medium si élevé (8-11) sans critique', () => {
    expect(execGlobalLevel([{ niveauRisque: 9 }, { niveauRisque: 4 }])).toBe('medium')
  })
  it('low si seulement modéré/faible', () => {
    expect(execGlobalLevel([{ niveauRisque: 4 }, { niveauRisque: 2 }])).toBe('low')
  })
})

describe('execTopRisks', () => {
  it('renvoie les 3 risques les plus élevés, décroissant', () => {
    const r = execTopRisks([{ niveauRisque: 4 }, { niveauRisque: 16 }, { niveauRisque: 9 }, { niveauRisque: 12 }])
    expect(r.map(x => x.niveauRisque)).toEqual([16, 12, 9])
  })
})

describe('execMeasuresToEngage', () => {
  it('exclut les mesures réalisées et trie par priorité croissante', () => {
    const m = execMeasuresToEngage([
      { nom: 'a', statut: 'A_FAIRE', priorite: 2 },
      { nom: 'b', statut: 'REALISE', priorite: 1 },
      { nom: 'c', statut: 'EN_COURS', priorite: 1 },
    ] as any)
    expect(m.map((x: any) => x.nom)).toEqual(['c', 'a'])
  })
  it('limite à 5', () => {
    const m = execMeasuresToEngage(Array.from({ length: 8 }, (_, i) => ({ statut: 'A_FAIRE', priorite: 1, i })) as any)
    expect(m.length).toBe(5)
  })
  it('repli sur les premières mesures si toutes réalisées', () => {
    const m = execMeasuresToEngage([{ nom: 'a', statut: 'REALISE' }, { nom: 'b', statut: 'REALISE' }] as any)
    expect(m.length).toBe(2)
  })
})
