import { describe, it, expect } from 'vitest'
import {
  computeRiskScore,
  getRiskLevelFromSeuils,
  getRiskLevel,
  resolveScaleConfig,
  buildRiskMatrixModel,
  getRiskTier,
  buildDefaultQualitativeMatrix,
  type ScaleConfig,
} from '@/lib/risk-scale'
import { buildDefaultConfig, DEFAULT_SEUILS_MATRICE } from '@/lib/configuration-defaults'

const DEFAULT4 = buildDefaultConfig(4) as ScaleConfig
const DEFAULT5 = buildDefaultConfig(5) as ScaleConfig

describe('risk-scale — calcul du niveau de risque (source unique)', () => {
  describe('computeRiskScore', () => {
    it('est le produit gravité × vraisemblance', () => {
      expect(computeRiskScore(3, 4)).toBe(12)
      expect(computeRiskScore(1, 1)).toBe(1)
      expect(computeRiskScore(5, 5)).toBe(25)
    })
  })

  describe('getRiskLevelFromSeuils', () => {
    it('retourne le seuil correspondant au score', () => {
      expect(getRiskLevelFromSeuils(1, DEFAULT_SEUILS_MATRICE)?.label).toBe('Faible')
      expect(getRiskLevelFromSeuils(3, DEFAULT_SEUILS_MATRICE)?.label).toBe('Faible')
      expect(getRiskLevelFromSeuils(6, DEFAULT_SEUILS_MATRICE)?.label).toBe('Modéré')
      expect(getRiskLevelFromSeuils(10, DEFAULT_SEUILS_MATRICE)?.label).toBe('Élevé')
      expect(getRiskLevelFromSeuils(12, DEFAULT_SEUILS_MATRICE)?.label).toBe('Critique')
      expect(getRiskLevelFromSeuils(25, DEFAULT_SEUILS_MATRICE)?.label).toBe('Critique')
    })

    it('retourne null hors de toute plage', () => {
      expect(getRiskLevelFromSeuils(0, DEFAULT_SEUILS_MATRICE)).toBeNull()
    })
  })

  describe('getRiskLevel', () => {
    it('combine score et seuils de la config', () => {
      expect(getRiskLevel(4, 4, DEFAULT4).label).toBe('Critique') // 16
      expect(getRiskLevel(3, 4, DEFAULT4).label).toBe('Critique') // 12
      expect(getRiskLevel(2, 4, DEFAULT4).label).toBe('Élevé')    // 8
      expect(getRiskLevel(2, 3, DEFAULT4).label).toBe('Modéré')   // 6
      expect(getRiskLevel(1, 1, DEFAULT4).label).toBe('Faible')   // 1
    })

    it('a toujours un label et une couleur (jamais null)', () => {
      const lvl = getRiskLevel(0, 0, DEFAULT4)
      expect(lvl.label).toBeTruthy()
      expect(lvl.couleur).toMatch(/^#/)
    })
  })

  describe('getRiskTier — classification canonique (listes/dashboard)', () => {
    it('classe selon les seuils par défaut 4/8/12', () => {
      expect(getRiskTier(1)).toBe('faible')
      expect(getRiskTier(3)).toBe('faible')
      expect(getRiskTier(4)).toBe('modere')
      expect(getRiskTier(7)).toBe('modere')
      expect(getRiskTier(8)).toBe('eleve')
      expect(getRiskTier(11)).toBe('eleve')
      expect(getRiskTier(12)).toBe('critique')
      expect(getRiskTier(25)).toBe('critique')
    })

    it('est cohérent avec getNiveauRisqueLabel (mêmes frontières)', () => {
      // bornes critiques : 11 → non critique, 12 → critique
      expect(getRiskTier(11)).not.toBe('critique')
      expect(getRiskTier(12)).toBe('critique')
    })
  })

  describe('mode QUALITATIVE — matrice définie manuellement', () => {
    it('utilise le niveau défini manuellement pour une case, même si la probabilité est faible', () => {
      // Cas métier : gravité critique (4) + vraisemblance minime (1) → score 4 = "Modéré"
      // en quantitatif, mais l'organisation veut "Critique" quoi qu'il arrive.
      const cfg: ScaleConfig = {
        ...DEFAULT4,
        matriceMode: 'QUALITATIVE',
        matriceQualitative: [
          { gravite: 4, vraisemblance: 1, seuilLabel: 'Critique' },
        ],
      }
      // Quantitatif : score 4 → Modéré
      expect(getRiskLevel(4, 1, DEFAULT4).label).toBe('Modéré')
      // Qualitatif : forcé à Critique
      expect(getRiskLevel(4, 1, cfg).label).toBe('Critique')
    })

    it('retombe sur le calcul quantitatif si la case n\'est pas définie manuellement', () => {
      const cfg: ScaleConfig = {
        ...DEFAULT4,
        matriceMode: 'QUALITATIVE',
        matriceQualitative: [{ gravite: 4, vraisemblance: 1, seuilLabel: 'Critique' }],
      }
      // (2,3)=6 non défini → quantitatif → Modéré
      expect(getRiskLevel(2, 3, cfg).label).toBe('Modéré')
    })

    it('buildRiskMatrixModel reflète la matrice qualitative', () => {
      const cfg: ScaleConfig = {
        ...DEFAULT4,
        matriceMode: 'QUALITATIVE',
        matriceQualitative: [{ gravite: 4, vraisemblance: 1, seuilLabel: 'Critique' }],
      }
      const m = buildRiskMatrixModel(cfg)
      const cell = m.cells.flat().find(c => c.gravite === 4 && c.vraisemblance === 1)!
      expect(cell.label).toBe('Critique')
    })

    it('buildDefaultQualitativeMatrix génère une case par couple gravité×vraisemblance', () => {
      const grid = buildDefaultQualitativeMatrix(DEFAULT4)
      expect(grid).toHaveLength(16) // 4×4
      // Initialisé sur les valeurs quantitatives : (4,4)=16 → Critique
      const top = grid.find(c => c.gravite === 4 && c.vraisemblance === 4)!
      expect(top.seuilLabel).toBe('Critique')
    })
  })

  describe('resolveScaleConfig', () => {
    it('complète une config partielle avec les défauts', () => {
      const r = resolveScaleConfig(null)
      expect(r.nbNiveaux).toBe(4)
      expect(r.echelleGravite).toHaveLength(4)
      expect(r.seuilsMatrice.length).toBeGreaterThan(0)
    })

    it('respecte nbNiveaux=5 pour les défauts manquants', () => {
      const r = resolveScaleConfig({ nbNiveaux: 5 })
      expect(r.echelleGravite).toHaveLength(5)
      expect(r.echelleVraisemblance).toHaveLength(5)
    })

    it('conserve les échelles fournies', () => {
      const custom = { nbNiveaux: 4, echelleGravite: DEFAULT4.echelleGravite, echelleVraisemblance: DEFAULT4.echelleVraisemblance, seuilsMatrice: DEFAULT_SEUILS_MATRICE }
      const r = resolveScaleConfig(custom)
      expect(r.echelleGravite[0].label).toBe(DEFAULT4.echelleGravite[0].label)
    })
  })

  describe('buildRiskMatrixModel', () => {
    it('produit une grille NxN selon nbNiveaux (4)', () => {
      const m = buildRiskMatrixModel(DEFAULT4)
      expect(m.graviteLevels).toHaveLength(4)
      expect(m.vraisemblanceLevels).toHaveLength(4)
      expect(m.cells).toHaveLength(4)        // lignes (vraisemblance)
      expect(m.cells[0]).toHaveLength(4)     // colonnes (gravité)
    })

    it('produit une grille 5x5 pour nbNiveaux=5', () => {
      const m = buildRiskMatrixModel(DEFAULT5)
      expect(m.graviteLevels).toHaveLength(5)
      expect(m.cells).toHaveLength(5)
      expect(m.cells[0]).toHaveLength(5)
    })

    it('chaque cellule porte score, label et couleur cohérents', () => {
      const m = buildRiskMatrixModel(DEFAULT4)
      // ligne du haut = vraisemblance=4, colonne gravité=4 → score 16 → Critique
      const cell = m.cells[0].find(c => c.gravite === 4)!
      expect(cell.vraisemblance).toBe(4)
      expect(cell.score).toBe(16)
      expect(cell.label).toBe('Critique')
      expect(cell.couleur).toMatch(/^#/)
    })

    it('ordonne les lignes par vraisemblance décroissante (haut = plus probable)', () => {
      const m = buildRiskMatrixModel(DEFAULT4)
      expect(m.cells[0][0].vraisemblance).toBe(4)
      expect(m.cells[3][0].vraisemblance).toBe(1)
    })
  })
})
