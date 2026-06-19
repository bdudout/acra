import { describe, it, expect } from 'vitest'
import {
  menace,
  menaceFromCriteria,
  zoneOf,
  radiusFor,
  zoneRadii,
  fiabiliteLevel,
  expositionLevel,
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

describe('menace = exposition / fiabilité', () => {
  it('calcule le ratio (entrées 1..16)', () => {
    expect(menace(16, 1)).toBe(16) // exposition max, fiabilité min → menace max
    expect(menace(1, 16)).toBeCloseTo(1 / 16, 5)
    expect(menace(8, 4)).toBe(2)
    expect(menace(12, 6)).toBe(2)
  })

  it('borne les entrées à [1..16]', () => {
    expect(menace(99, 1)).toBe(16)
    expect(menace(8, 99)).toBe(menace(8, 16))
  })
})

describe('menaceFromCriteria = (dép×pén)/(mat×conf)', () => {
  it('reproduit les exemples du guide ANSSI', () => {
    expect(menaceFromCriteria(3, 4, 2, 2)).toBe(3)      // F3 = 12/4
    expect(menaceFromCriteria(3, 3, 2, 2)).toBe(2.25)   // P3 = 9/4
    expect(menaceFromCriteria(4, 2, 2, 3)).toBeCloseTo(8 / 6, 5) // F1 ≈ 1,33
    expect(menaceFromCriteria(1, 1, 1, 3)).toBeCloseTo(1 / 3, 5) // C1 ≈ 0,33
  })

  it('accepte des cotations flottantes', () => {
    expect(menaceFromCriteria(2.5, 2, 2, 2)).toBeCloseTo(5 / 4, 5)
  })
})

describe('zoneOf — 3 zones, seuils fixes sur le ratio', () => {
  it('danger ≥3 · contrôle ≥1,5 · veille sinon (pas de « hors »)', () => {
    expect(zoneOf(3)).toBe('danger')
    expect(zoneOf(2.25)).toBe('controle')
    expect(zoneOf(1.5)).toBe('controle')
    expect(zoneOf(1)).toBe('veille')
    expect(zoneOf(0.5)).toBe('veille')
    expect(zoneOf(0.06)).toBe('veille') // menace minimale → veille (l'au-delà est juste « hors périmètre » visuel)
  })
})

describe('fiabiliteLevel — couleur par fiabilité (quartiles de [1,max])', () => {
  it('niveau croissant avec la fiabilité, par quartiles (max=16 par défaut)', () => {
    expect(fiabiliteLevel(1)).toBe(0)
    expect(fiabiliteLevel(4)).toBe(0)
    expect(fiabiliteLevel(5)).toBe(1)
    expect(fiabiliteLevel(9)).toBe(2)
    expect(fiabiliteLevel(16)).toBe(3)
  })

  it('s\'adapte à une échelle différente (max paramétrable)', () => {
    expect(fiabiliteLevel(25, 25)).toBe(3) // fiabilité maximale d'une échelle 1..5 (5×5)
    expect(fiabiliteLevel(1, 25)).toBe(0)
  })
})

describe('expositionLevel — taille par exposition (quartiles de [1,max])', () => {
  it('niveau croissant avec l\'exposition, par quartiles (max=16 par défaut)', () => {
    expect(expositionLevel(1)).toBe(0)
    expect(expositionLevel(4)).toBe(0)
    expect(expositionLevel(5)).toBe(1)
    expect(expositionLevel(9)).toBe(2)
    expect(expositionLevel(16)).toBe(3)
  })
})

describe('radiusFor — rayon inversé log paramétré par les bornes', () => {
  it('menace minimale au bord, maximale au centre (bornes par défaut)', () => {
    expect(radiusFor(MENACE_MIN, 200)).toBeCloseTo(200, 5)
    expect(radiusFor(MENACE_MAX, 200)).toBeCloseTo(0, 5)
  })

  it('respecte des bornes explicites (échelle adaptée)', () => {
    // échelle 1..5 → menace ∈ [1/25, 25]
    expect(radiusFor(1 / 25, 200, 1 / 25, 25)).toBeCloseTo(200, 5)
    expect(radiusFor(25, 200, 1 / 25, 25)).toBeCloseTo(0, 5)
  })

  it('est strictement décroissant avec la menace', () => {
    expect(radiusFor(0.5, 200)).toBeGreaterThan(radiusFor(1.5, 200))
    expect(radiusFor(1.5, 200)).toBeGreaterThan(radiusFor(3, 200))
  })

  it('place un point de zone danger à l\'intérieur du disque danger', () => {
    const rings = zoneRadii(200)
    expect(radiusFor(4, 200)).toBeLessThan(rings.danger)     // menace 4 = danger → dans le disque
    expect(radiusFor(2, 200)).toBeGreaterThan(rings.danger)  // menace 2 = contrôle → hors disque danger
    expect(radiusFor(2, 200)).toBeLessThan(rings.controle)   // mais dans l'anneau contrôle
  })

  it('zoneRadii expose danger/contrôle/rim (veille = anneau extérieur)', () => {
    const rings = zoneRadii(200)
    expect(rings.rim).toBe(200)
    expect(rings.controle).toBeGreaterThan(rings.danger)
    expect(rings).not.toHaveProperty('veille') // plus de 4e anneau « hors »
  })

  it('découpe le rayon en 3 zones égales (1/3 chacune)', () => {
    const rings = zoneRadii(300)
    expect(rings.danger).toBeCloseTo(100, 5)   // rMax/3
    expect(rings.controle).toBeCloseTo(200, 5) // 2·rMax/3
    expect(rings.rim).toBe(300)
    // un point danger est dans le 1er tiers, contrôle dans le 2e, veille dans le 3e
    expect(radiusFor(4, 300)).toBeLessThan(100)
    expect(radiusFor(2, 300)).toBeGreaterThan(100)
    expect(radiusFor(2, 300)).toBeLessThan(200)
    expect(radiusFor(0.5, 300)).toBeGreaterThan(200)
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
    expect(a.menace).toBe(4)        // 4 / 1
    expect(a.zone).toBe('danger')   // ≥ 3
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

  it('propage le marquage critique et calcule showLabel (critique OU danger/contrôle)', () => {
    const parties = [
      { id: 'a', nom: 'A', type: 'PRESTATAIRE', exposition: 4, fiabilite: 1, critique: false }, // menace 4 → danger
      { id: 'b', nom: 'B', type: 'CLIENT', exposition: 1, fiabilite: 4, critique: true },        // menace 0,25 → veille mais critique
      { id: 'c', nom: 'C', type: 'FOURNISSEUR', exposition: 1, fiabilite: 4, critique: false },  // veille non critique
    ]
    const pts = layoutStakeholders(parties, geom)
    const a = pts.find(p => p.id === 'a')!
    const b = pts.find(p => p.id === 'b')!
    const c = pts.find(p => p.id === 'c')!
    expect(a.showLabel).toBe(true)  // zone danger
    expect(b.critique).toBe(true)
    expect(b.showLabel).toBe(true)  // critique
    expect(c.showLabel).toBe(false) // veille non critique
  })

  it('respecte des bornes de menace explicites (échelle adaptée)', () => {
    const parties = [{ id: 'a', nom: 'A', type: 'PRESTATAIRE', exposition: 25, fiabilite: 1 }]
    const pts = layoutStakeholders(parties, geom, { menaceMin: 1 / 25, menaceMax: 25 })
    expect(pts[0].x).not.toBeNaN()
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
