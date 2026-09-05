import { describe, it, expect } from 'vitest'
// Import relatif volontaire : sous Node 26 l'alias @/ casse vitest sur l'hôte.
import {
  srOvCouples,
  coupleRadiusFor,
  couplePoint,
  categoriesInOrder,
  sectorCenterAngle,
  couplePointSector,
  sectorLabelPoint,
} from '../../../lib/sr-ov-radar'

describe('sr-ov-radar (cartographie des couples SR/OV, EXI_M2_09)', () => {
  describe('srOvCouples', () => {
    const sources = [
      { nom: 'Cybercriminel', categorie: 'CYBERCRIMINEL', retenu: true, pertinence: 3,
        objectifsVises: [
          { id: 'a', nom: 'Rançon', priorite: 'P1', pertinenceOV: 4 },
          { id: 'b', nom: 'Revente', priorite: 'P2', pertinenceOV: 2 },
        ] },
      { nom: 'Concurrent', categorie: 'CONCURRENT', retenu: false, pertinence: 2,
        objectifsVises: [{ id: 'c', nom: 'Espionnage', priorite: 'P2', pertinenceOV: 3 }] },
      { nom: 'État', categorie: 'ETAT_NATION', retenu: true, pertinence: 2, objectifsVises: [] },
    ]

    it('n\'aplatit que les sources retenues, un point par objectif visé', () => {
      const couples = srOvCouples(sources)
      expect(couples).toHaveLength(2) // Cybercriminel×2 ; Concurrent exclu ; État sans OV
      expect(couples.map(c => c.ovNom)).toEqual(['Rançon', 'Revente'])
    })

    it('reporte la catégorie de la source ; le RAYON = pertinence de la SOURCE', () => {
      const [c1] = srOvCouples(sources)
      expect(c1.categorie).toBe('CYBERCRIMINEL')
      expect(c1.sourceNom).toBe('Cybercriminel')
      expect(c1.priorite).toBe('P1')
      expect(c1.pertinence).toBe(3) // pertinence de la source (pertinenceOV non saisissable)
    })

    it('les deux couples d\'une même source partagent la pertinence de la source', () => {
      const couples = srOvCouples(sources)
      expect(couples[0].pertinence).toBe(couples[1].pertinence) // même source → même niveau
    })

    it('retombe sur pertinenceOV si la source n\'a pas de pertinence', () => {
      const src = [{ nom: 'X', categorie: 'AMATEUR', retenu: true,
        objectifsVises: [{ id: 'z', nom: 'OV', priorite: 'P2', pertinenceOV: 2 }] }]
      expect(srOvCouples(src)[0].pertinence).toBe(2)
    })
  })

  describe('coupleRadiusFor (centre = pertinence maximale)', () => {
    it('rapproche du centre les couples les plus pertinents', () => {
      const rMax = 100
      expect(coupleRadiusFor(4, rMax)).toBeLessThan(coupleRadiusFor(1, rMax))
      expect(coupleRadiusFor(1, rMax)).toBeCloseTo(100)
      expect(coupleRadiusFor(4, rMax)).toBeCloseTo(25)
    })
    it('borne les pertinences hors échelle', () => {
      const rMax = 100
      expect(coupleRadiusFor(0, rMax)).toBeCloseTo(coupleRadiusFor(1, rMax))
      expect(coupleRadiusFor(9, rMax)).toBeCloseTo(coupleRadiusFor(4, rMax))
    })
  })

  describe('couplePoint', () => {
    const geom = { cx: 160, cy: 160, rMax: 120 }
    it('place le premier point en haut (12 h)', () => {
      const p = couplePoint(0, 4, 4, geom)
      expect(p.x).toBeCloseTo(160)
      expect(p.y).toBeCloseTo(160 - coupleRadiusFor(4, 120))
    })
    it('répartit les points sur le cercle', () => {
      const p2 = couplePoint(1, 4, 1, geom) // quart de tour → à droite (x max)
      expect(p2.x).toBeGreaterThan(160)
      expect(p2.y).toBeCloseTo(160)
    })
  })
})

describe('cartographie améliorée — angle par catégorie', () => {
  const geom = { cx: 160, cy: 160, rMax: 120 }

  it('categoriesInOrder garde l’ordre stable d’apparition', () => {
    const couples = [
      { id: '1', sourceNom: 'A', categorie: 'CYBERCRIMINEL', ovNom: 'x', pertinence: 4, priorite: 'P1' },
      { id: '2', sourceNom: 'B', categorie: 'CONCURRENT', ovNom: 'y', pertinence: 2, priorite: 'P2' },
      { id: '3', sourceNom: 'A', categorie: 'CYBERCRIMINEL', ovNom: 'z', pertinence: 3, priorite: 'P2' },
    ]
    expect(categoriesInOrder(couples as any)).toEqual(['CYBERCRIMINEL', 'CONCURRENT'])
  })

  it('sectorCenterAngle répartit les catégories sur le cercle', () => {
    expect(sectorCenterAngle(0, 4)).toBeCloseTo(Math.PI / 4)      // 1er secteur centré à 45°
    expect(sectorCenterAngle(2, 4)).toBeCloseTo((5 * Math.PI) / 4)
  })

  it('couplePointSector : pertinence maximale → proche du centre', () => {
    const p4 = couplePointSector(0, 3, 0, 1, 4, geom)
    const p1 = couplePointSector(0, 3, 0, 1, 1, geom)
    const d = (p: { x: number; y: number }) => Math.hypot(p.x - geom.cx, p.y - geom.cy)
    expect(d(p4)).toBeLessThan(d(p1))
  })

  it('couplePointSector : un seul couple → au centre de son secteur', () => {
    const p = couplePointSector(1, 3, 0, 1, 3, geom)
    const a = sectorCenterAngle(1, 3)
    const r = coupleRadiusFor(3, geom.rMax)
    expect(p.x).toBeCloseTo(geom.cx + r * Math.sin(a))
    expect(p.y).toBeCloseTo(geom.cy - r * Math.cos(a))
  })

  it('sectorLabelPoint : hors du cercle avec un ancrage cohérent', () => {
    const pt = sectorLabelPoint(0, 1, geom) // secteur unique centré en bas (angle π)
    expect(Math.hypot(pt.x - geom.cx, pt.y - geom.cy)).toBeGreaterThan(geom.rMax)
    expect(pt.anchor).toBe('middle')
    // 1er de 4 secteurs → en haut à droite (x > cx, y < cy)
    const s0 = sectorLabelPoint(0, 4, geom)
    expect(s0.x).toBeGreaterThan(geom.cx)
    expect(s0.y).toBeLessThan(geom.cy)
  })
})
