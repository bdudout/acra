import { describe, it, expect } from 'vitest'
import {
  menace,
  zoneOf,
  radiusFor,
  zoneRadii,
  polarToXY,
  presentTypes,
  layoutStakeholders,
  stakeholderRef,
  MENACE_MIN,
  MENACE_MAX,
} from '@/lib/ecosystem-radar'

// ─────────────────────────────────────────────────────────────────────────────
// Radar de menace de l'écosystème (Atelier 3 EBIOS RM) — géométrie pure.
// La logique de zones DOIT rester cohérente avec le calcul déjà utilisé dans
// l'application : vulnerabilite = ⌈ exposition × (5 − fiabilité) / 4 ⌉,
// zones danger ≥4 · contrôle =3 · veille ≤2.
// ─────────────────────────────────────────────────────────────────────────────

describe('menace = exposition × (5 − fiabilité)', () => {
  it('calcule la menace sur [1..16]', () => {
    expect(menace(4, 1)).toBe(16)  // exposition max, fiabilité min → menace max
    expect(menace(1, 4)).toBe(1)   // exposition min, fiabilité max → menace min
    expect(menace(2, 3)).toBe(4)
    expect(menace(3, 2)).toBe(9)
  })

  it('borne les entrées hors de [1..4]', () => {
    expect(menace(99, 1)).toBe(16)
    expect(menace(0, 0)).toBe(menace(1, 1)) // clamp à 1..4 → 1×4 = 4
    expect(menace(4, 99)).toBe(menace(4, 4)) // fiabilité clampée à 4 → 4×1 = 4
  })
})

describe('zoneOf — cohérence avec les paliers vulnerabilite ⌈menace/4⌉', () => {
  it('danger pour menace > 12, contrôle pour 8 < menace ≤ 12, veille pour ≤ 8', () => {
    expect(zoneOf(16)).toBe('danger')
    expect(zoneOf(13)).toBe('danger')
    expect(zoneOf(12)).toBe('controle')
    expect(zoneOf(9)).toBe('controle')
    expect(zoneOf(8)).toBe('veille')
    expect(zoneOf(4)).toBe('veille')
    expect(zoneOf(1)).toBe('veille')
  })

  it('correspond exactement au bucket ⌈menace/4⌉ utilisé par l\'app, pour tout menace entier 1..16', () => {
    for (let m = MENACE_MIN; m <= MENACE_MAX; m++) {
      const vuln = Math.ceil(m / 4)
      const expected = vuln >= 4 ? 'danger' : vuln === 3 ? 'controle' : 'veille'
      expect(zoneOf(m)).toBe(expected)
    }
  })
})

describe('radiusFor — rayon inversé (centre = menace max)', () => {
  it('menace minimale au bord, maximale au centre', () => {
    expect(radiusFor(MENACE_MIN, 200)).toBeCloseTo(200, 5)
    expect(radiusFor(MENACE_MAX, 200)).toBeCloseTo(0, 5)
  })

  it('est strictement décroissant avec la menace', () => {
    expect(radiusFor(4, 200)).toBeGreaterThan(radiusFor(9, 200))
    expect(radiusFor(9, 200)).toBeGreaterThan(radiusFor(16, 200))
  })

  it('place un point de zone danger à l\'intérieur du disque danger', () => {
    const rings = zoneRadii(200)
    expect(radiusFor(13, 200)).toBeLessThan(rings.danger)   // menace 13 = danger → dans le disque
    expect(radiusFor(9, 200)).toBeGreaterThan(rings.danger) // menace 9 = contrôle → hors disque danger
    expect(radiusFor(9, 200)).toBeLessThan(rings.controle)  // mais dans l'anneau contrôle
  })
})

describe('polarToXY — degrés depuis le haut, sens horaire', () => {
  it('0° pointe vers le haut, 90° vers la droite, 180° vers le bas', () => {
    const [x0, y0] = polarToXY(100, 0, 200, 200)
    expect(x0).toBeCloseTo(200, 5)
    expect(y0).toBeCloseTo(100, 5) // vers le haut → y diminue

    const [x90, y90] = polarToXY(100, 90, 200, 200)
    expect(x90).toBeCloseTo(300, 5)
    expect(y90).toBeCloseTo(200, 5)

    const [, y180] = polarToXY(100, 180, 200, 200)
    expect(y180).toBeCloseTo(300, 5) // vers le bas → y augmente
  })
})

describe('presentTypes — ordre canonique stable', () => {
  it('retourne les types distincts présents, dans l\'ordre canonique de l\'enum', () => {
    const parties = [
      { type: 'CLIENT' }, { type: 'FOURNISSEUR' }, { type: 'CLIENT' }, { type: 'PRESTATAIRE' },
    ]
    expect(presentTypes(parties)).toEqual(['FOURNISSEUR', 'CLIENT', 'PRESTATAIRE'])
  })

  it('place un type inconnu en fin (catégorie AUTRE)', () => {
    const parties = [{ type: 'INCONNU' }, { type: 'CLIENT' }]
    const result = presentTypes(parties)
    expect(result[0]).toBe('CLIENT')
    expect(result).toContain('INCONNU')
  })
})

describe('layoutStakeholders', () => {
  const geom = { cx: 200, cy: 200, rMax: 180 }

  it('retourne un point par partie prenante avec zone, menace et coordonnées', () => {
    const parties = [
      { id: 'a', nom: 'Infogéreur', type: 'PRESTATAIRE', exposition: 4, fiabilite: 1 },
      { id: 'b', nom: 'Client', type: 'CLIENT', exposition: 2, fiabilite: 3 },
    ]
    const pts = layoutStakeholders(parties, geom)
    expect(pts).toHaveLength(2)
    const a = pts.find(p => p.id === 'a')!
    expect(a.menace).toBe(16)
    expect(a.zone).toBe('danger')
    expect(typeof a.x).toBe('number')
    expect(typeof a.y).toBe('number')
    expect(a.x).not.toBeNaN()
    expect(a.y).not.toBeNaN()
  })

  it('place une PP seule de son secteur au centre angulaire du secteur', () => {
    const parties = [
      { id: 'a', nom: 'A', type: 'FOURNISSEUR', exposition: 3, fiabilite: 2 },
      { id: 'b', nom: 'B', type: 'CLIENT', exposition: 3, fiabilite: 2 },
    ]
    const pts = layoutStakeholders(parties, geom)
    // 2 types → secteurs de 180°, centres à 0° et 180°
    const a = pts.find(p => p.id === 'a')!
    expect(a.angleDeg).toBeCloseTo(0, 5)
  })

  it('écarte angulairement (jitter) les PP d\'un même secteur pour éviter le chevauchement', () => {
    const parties = [
      { id: 'a', nom: 'A', type: 'PRESTATAIRE', exposition: 3, fiabilite: 2 },
      { id: 'b', nom: 'B', type: 'PRESTATAIRE', exposition: 3, fiabilite: 2 },
      { id: 'c', nom: 'C', type: 'PRESTATAIRE', exposition: 3, fiabilite: 2 },
    ]
    const pts = layoutStakeholders(parties, geom)
    const angles = pts.map(p => p.angleDeg)
    expect(new Set(angles).size).toBe(3) // 3 angles distincts
  })

  it('ne plante pas sur un écosystème vide', () => {
    expect(layoutStakeholders([], geom)).toEqual([])
  })

  it('attribue une référence T1, T2, … selon l\'ordre des parties prenantes', () => {
    const parties = [
      { id: 'a', nom: 'A', type: 'PRESTATAIRE', exposition: 3, fiabilite: 2 },
      { id: 'b', nom: 'B', type: 'CLIENT', exposition: 3, fiabilite: 2 },
      { id: 'c', nom: 'C', type: 'FOURNISSEUR', exposition: 3, fiabilite: 2 },
    ]
    const pts = layoutStakeholders(parties, geom)
    expect(pts.find(p => p.id === 'a')!.ref).toBe('T1')
    expect(pts.find(p => p.id === 'b')!.ref).toBe('T2')
    expect(pts.find(p => p.id === 'c')!.ref).toBe('T3')
  })
})

describe('stakeholderRef', () => {
  it('numérote à partir de 1 (T1, T2, …)', () => {
    expect(stakeholderRef(0)).toBe('T1')
    expect(stakeholderRef(4)).toBe('T5')
  })
})
