import { describe, it, expect } from 'vitest'
import {
  clampInt, capArr, IMPORT_MAX_ITEMS,
  cleanSourceRisque, cleanScenarioStrat, cleanScenarioOp, cleanRisque, cleanMesure,
  cleanPartiePrenante, cleanCadrage,
} from '@/lib/import-sanitize'

describe('clampInt', () => {
  it('ramène dans [min, max]', () => {
    expect(clampInt(9999, 1, 4, 2)).toBe(4)
    expect(clampInt(-5, 1, 4, 2)).toBe(1)
    expect(clampInt(3, 1, 4, 2)).toBe(3)
    expect(clampInt(99, 1, 16, 4)).toBe(16)
  })
  it('arrondit les décimaux', () => {
    expect(clampInt(2.7, 1, 4, 2)).toBe(3)
  })
  it('renvoie le défaut si non-fini', () => {
    expect(clampInt('abc', 1, 4, 2)).toBe(2)
    expect(clampInt(null, 1, 4, 2)).toBe(2)
    expect(clampInt(undefined, 1, 4, 2)).toBe(2)
    expect(clampInt(NaN, 1, 4, 2)).toBe(2)
  })
  it('renvoie undefined si non-fini et pas de défaut', () => {
    expect(clampInt('x', 1, 4)).toBeUndefined()
  })
})

describe('capArr', () => {
  it('tronque à IMPORT_MAX_ITEMS (500) par défaut', () => {
    const big = Array.from({ length: 600 }, (_, i) => i)
    expect(capArr(big)).toHaveLength(IMPORT_MAX_ITEMS)
    expect(capArr(big)).toHaveLength(500)
  })
  it('respecte un max explicite', () => {
    expect(capArr([1, 2, 3, 4], 2)).toEqual([1, 2])
  })
  it('renvoie [] pour une entrée non-tableau', () => {
    expect(capArr(undefined)).toEqual([])
    expect(capArr('nope')).toEqual([])
    expect(capArr(null)).toEqual([])
  })
})

describe('clamp des cotations dans les cleaners (#117)', () => {
  it('cleanScenarioStrat clampe gravité/vraisemblance (1-4) et niveauRisque (1-16)', () => {
    const s = cleanScenarioStrat({ nom: 'X', gravite: 9999, vraisemblance: -5, niveauRisque: 99 })
    expect(s.gravite).toBe(4)
    expect(s.vraisemblance).toBe(1)
    expect(s.niveauRisque).toBe(16)
  })
  it('cleanRisque clampe niveauResiduel (1-16)', () => {
    expect(cleanRisque({ nom: 'X', niveauResiduel: 500 }).niveauResiduel).toBe(16)
    expect(cleanRisque({ nom: 'X' }).niveauResiduel).toBeUndefined()
  })
  it('cleanScenarioOp clampe gravité/vraisemblance (négatif→min, 0→défaut)', () => {
    const s = cleanScenarioOp({ nom: 'X', gravite: 42, vraisemblance: -3 })
    expect(s.gravite).toBe(4)
    expect(s.vraisemblance).toBe(1)
    // 0 est invalide sur une échelle 1-4 → retombe sur le défaut (2), pas 1.
    expect(cleanScenarioOp({ nom: 'X', vraisemblance: 0 }).vraisemblance).toBe(2)
  })
  it('cleanMesure clampe priorité et efficacité (1-4)', () => {
    const m = cleanMesure({ nom: 'X', priorite: 100, efficacite: 42 })
    expect(m.priorite).toBe(4)
    expect(m.efficacite).toBe(4)
  })
  it('cleanSourceRisque clampe la pertinence (1-4)', () => {
    expect(cleanSourceRisque({ nom: 'X', pertinence: 77 }).pertinence).toBe(4)
  })
  it('cleanSourceRisque garantit une catégorie valide (enum requis)', () => {
    expect(cleanSourceRisque({ nom: 'X' }).categorie).toBe('AUTRE')            // absente
    expect(cleanSourceRisque({ nom: 'X', categorie: 'BIDON' }).categorie).toBe('AUTRE') // inconnue
    expect(cleanSourceRisque({ nom: 'X', categorie: 'ETAT_NATION' }).categorie).toBe('ETAT_NATION')
  })
  it('cleanSourceRisque : motivation/ressources/activite restent du texte (String?), scores clampés', () => {
    const s = cleanSourceRisque({ nom: 'X', motivation: 'Forte', ressources: 'Élevées', activite: 'Intense', motivationScore: 9 })
    expect(s.motivation).toBe('Forte')      // texte préservé (pas Number())
    expect(s.ressources).toBe('Élevées')
    expect(s.activite).toBe('Intense')
    expect(s.motivationScore).toBe(4)        // 9 → clampé 1-4
    expect(cleanSourceRisque({ nom: 'X' }).motivation).toBeUndefined()
  })
  it('cleanPartiePrenante clampe les sous-critères et recalcule exposition/fiabilité', () => {
    const p = cleanPartiePrenante({ nom: 'X', dependance: 99, penetration: 4, maturite: -1, confiance: 3 })
    expect(p.dependance).toBe(4)
    expect(p.maturite).toBe(1)
    expect(p.exposition).toBe(16) // 4 × 4
    expect(p.fiabilite).toBe(3)   // 1 × 3
  })
})

describe('cap de cardinalité dans les cleaners (#117)', () => {
  it('cleanCadrage tronque les tableaux JSON à 500', () => {
    const big = Array.from({ length: 600 }, (_, i) => ({ id: i }))
    const c = cleanCadrage({ valeursMetier: big, biensSupports: big })
    expect(c.valeursMetier).toHaveLength(500)
    expect(c.biensSupports).toHaveLength(500)
  })
  it('cleanCadrage laisse undefined un champ absent (pas de tableau vide)', () => {
    expect(cleanCadrage({ perimetre: 'p' }).valeursMetier).toBeUndefined()
  })
  it('cleanScenarioOp tronque cheminsAttaque/actionsMenace à 500', () => {
    const big = Array.from({ length: 600 }, (_, i) => i)
    const s = cleanScenarioOp({ nom: 'X', cheminsAttaque: big, actionsMenace: big })
    expect(s.cheminsAttaque).toHaveLength(500)
    expect(s.actionsMenace).toHaveLength(500)
  })
})
