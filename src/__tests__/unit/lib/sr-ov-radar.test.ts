import { describe, it, expect } from 'vitest'
// Import relatif volontaire : sous Node 26 l'alias @/ casse vitest sur l'hôte.
import {
  srOvCouples,
  coupleRadiusFor,
  couplePoint,
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

    it('reporte la catégorie de la source et la pertinence du couple (pertinenceOV prioritaire)', () => {
      const [c1] = srOvCouples(sources)
      expect(c1.categorie).toBe('CYBERCRIMINEL')
      expect(c1.sourceNom).toBe('Cybercriminel')
      expect(c1.priorite).toBe('P1')
      expect(c1.pertinence).toBe(4) // pertinenceOV
    })

    it('retombe sur la pertinence de la source si le couple n\'en a pas', () => {
      const src = [{ nom: 'X', categorie: 'AMATEUR', retenu: true, pertinence: 3,
        objectifsVises: [{ id: 'z', nom: 'OV', priorite: 'P2' }] }]
      expect(srOvCouples(src)[0].pertinence).toBe(3)
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
