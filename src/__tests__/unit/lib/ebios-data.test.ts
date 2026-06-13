import { describe, it, expect } from 'vitest'
import {
  getNiveauRisqueLabel,
  NIVEAUX_GRAVITE,
  NIVEAUX_VRAISEMBLANCE,
  NIVEAUX_DICT,
  CRITERES_DICT,
  BIENS_SUPPORTS_EXEMPLES,
  VALEURS_METIER_EXEMPLES,
  SOURCES_RISQUE_EXEMPLES,
} from '@/lib/ebios-data'

// ─── getNiveauRisqueLabel ──────────────────────────────────────────────────────

describe('getNiveauRisqueLabel', () => {
  it('retourne Critique pour score >= 12', () => {
    expect(getNiveauRisqueLabel(12).label).toBe('Critique')
    expect(getNiveauRisqueLabel(16).label).toBe('Critique')
    expect(getNiveauRisqueLabel(15).label).toBe('Critique')
  })

  it('retourne Élevé pour score entre 8 et 11', () => {
    expect(getNiveauRisqueLabel(8).label).toBe('Élevé')
    expect(getNiveauRisqueLabel(11).label).toBe('Élevé')
    expect(getNiveauRisqueLabel(9).label).toBe('Élevé')
  })

  it('retourne Modéré pour score entre 4 et 7', () => {
    expect(getNiveauRisqueLabel(4).label).toBe('Modéré')
    expect(getNiveauRisqueLabel(7).label).toBe('Modéré')
    expect(getNiveauRisqueLabel(6).label).toBe('Modéré')
  })

  it('retourne Faible pour score < 4', () => {
    expect(getNiveauRisqueLabel(1).label).toBe('Faible')
    expect(getNiveauRisqueLabel(3).label).toBe('Faible')
    expect(getNiveauRisqueLabel(0).label).toBe('Faible')
  })

  it('contient toujours color et bg', () => {
    const result = getNiveauRisqueLabel(6)
    expect(result).toHaveProperty('color')
    expect(result).toHaveProperty('bg')
    expect(result.color).toBeTruthy()
    expect(result.bg).toBeTruthy()
  })
})

// ─── Critères DICT ────────────────────────────────────────────────────────────

describe('NIVEAUX_DICT', () => {
  it('contient 5 niveaux (0 à 4)', () => {
    expect(NIVEAUX_DICT).toHaveLength(5)
  })

  it('les valeurs vont de 0 à 4 sans doublons', () => {
    const values = NIVEAUX_DICT.map(n => n.value)
    expect(values).toEqual([0, 1, 2, 3, 4])
  })

  it('chaque niveau a label, color et bg', () => {
    NIVEAUX_DICT.forEach(n => {
      expect(n).toHaveProperty('label')
      expect(n).toHaveProperty('color')
      expect(n).toHaveProperty('bg')
      expect(n.label).toBeTruthy()
    })
  })

  it('niveau 0 est Nul, niveau 4 est Critique', () => {
    expect(NIVEAUX_DICT[0].label).toBe('Nul')
    expect(NIVEAUX_DICT[4].label).toBe('Critique')
  })
})

describe('CRITERES_DICT', () => {
  it('contient exactement 4 critères (D, I, C, T)', () => {
    expect(CRITERES_DICT).toHaveLength(4)
  })

  it('les valeurs sont D, I, C, T dans l\'ordre', () => {
    const values = CRITERES_DICT.map(c => c.value)
    expect(values).toEqual(['D', 'I', 'C', 'T'])
  })

  it('chaque critère a value, label, desc et icon', () => {
    CRITERES_DICT.forEach(c => {
      expect(c).toHaveProperty('value')
      expect(c).toHaveProperty('label')
      expect(c).toHaveProperty('desc')
      expect(c).toHaveProperty('icon')
      expect(c.label).toBeTruthy()
      expect(c.desc).toBeTruthy()
    })
  })
})

// ─── Échelles NIVEAUX_GRAVITE / NIVEAUX_VRAISEMBLANCE ─────────────────────────

describe('NIVEAUX_GRAVITE', () => {
  it('contient exactement 4 niveaux (1 à 4)', () => {
    expect(NIVEAUX_GRAVITE).toHaveLength(4)
  })

  it('chaque niveau a label et description', () => {
    NIVEAUX_GRAVITE.forEach(n => {
      expect(n).toHaveProperty('label')
      expect(n).toHaveProperty('description')
      expect(n.label).toBeTruthy()
    })
  })
})

describe('NIVEAUX_VRAISEMBLANCE', () => {
  it('contient exactement 4 niveaux (1 à 4)', () => {
    expect(NIVEAUX_VRAISEMBLANCE).toHaveLength(4)
  })

  it('chaque niveau a label et description', () => {
    NIVEAUX_VRAISEMBLANCE.forEach(n => {
      expect(n).toHaveProperty('label')
      expect(n).toHaveProperty('description')
    })
  })
})

// ─── Données d'exemples ────────────────────────────────────────────────────────

describe('BIENS_SUPPORTS_EXEMPLES', () => {
  it('contient au moins 10 exemples', () => {
    expect(BIENS_SUPPORTS_EXEMPLES.length).toBeGreaterThanOrEqual(10)
  })

  it('chaque exemple a nom, type et description', () => {
    BIENS_SUPPORTS_EXEMPLES.forEach(b => {
      expect(b).toHaveProperty('nom')
      expect(b).toHaveProperty('type')
      expect(b).toHaveProperty('description')
    })
  })
})

describe('VALEURS_METIER_EXEMPLES', () => {
  it('contient au moins 5 exemples', () => {
    expect(VALEURS_METIER_EXEMPLES.length).toBeGreaterThanOrEqual(5)
  })

  it('chaque exemple a nom, type et description', () => {
    VALEURS_METIER_EXEMPLES.forEach(v => {
      expect(v).toHaveProperty('nom')
      expect(v).toHaveProperty('type')
      expect(v).toHaveProperty('description')
      expect(v.nom).toBeTruthy()
    })
  })

  it('chaque exemple a les 4 champs DICT avec valeurs 0–4', () => {
    VALEURS_METIER_EXEMPLES.forEach(v => {
      for (const field of ['disponibilite', 'integrite', 'confidentialite', 'tracabilite']) {
        expect(v, `champ ${field} manquant sur "${v.nom}"`).toHaveProperty(field)
        const val = (v as any)[field]
        expect(val, `${field} hors plage sur "${v.nom}"`).toBeGreaterThanOrEqual(0)
        expect(val, `${field} hors plage sur "${v.nom}"`).toBeLessThanOrEqual(4)
      }
    })
  })

  it('les exemples PROCESSUS ont tracabilite définie', () => {
    const processus = VALEURS_METIER_EXEMPLES.filter(v => v.type === 'PROCESSUS')
    expect(processus.length).toBeGreaterThan(0)
    processus.forEach(v => {
      expect(typeof (v as any).tracabilite).toBe('number')
    })
  })

  it('contient des exemples des deux types PROCESSUS et INFORMATION', () => {
    const types = new Set(VALEURS_METIER_EXEMPLES.map(v => v.type))
    expect(types.has('PROCESSUS')).toBe(true)
    expect(types.has('INFORMATION')).toBe(true)
  })
})

describe('SOURCES_RISQUE_EXEMPLES', () => {
  it('contient au moins 5 exemples', () => {
    expect(SOURCES_RISQUE_EXEMPLES.length).toBeGreaterThanOrEqual(5)
  })

  it('chaque source a nom, categorie et motivation', () => {
    SOURCES_RISQUE_EXEMPLES.forEach(s => {
      expect(s).toHaveProperty('nom')
      expect(s).toHaveProperty('categorie')
      expect(s).toHaveProperty('motivation')
    })
  })
})
