import { describe, expect, it } from 'vitest'
import { buildMatrixGrid, matrixModelFromConfig } from '@/lib/risk-matrix-grid'

const risques = [
  { nom: 'A', gravite: 4, vraisemblance: 3, graviteResiduelle: 2, vraisemblanceResiduelle: 1 },
  { nom: 'B', gravite: 4, vraisemblance: 3 },
  { nom: 'C', gravite: 1, vraisemblance: 1 },
]

describe('matrixModelFromConfig — échelle de l’organisation ou défauts', () => {
  it('sans configuration : matrice 4×4 avec couleurs et libellés de paliers', () => {
    const m = matrixModelFromConfig(null)
    expect(m.graviteLevels).toHaveLength(4); expect(m.vraisemblanceLevels).toHaveLength(4)
    expect(m.cells[0][0].couleur).toMatch(/^#?[0-9A-Fa-f]{6}$/)
  })
  it('config invalide (échelle sans niveau) : repli sur les défauts', () => {
    expect(matrixModelFromConfig({ echelleGravite: [{ foo: 1 }] }).graviteLevels).toHaveLength(4)
  })
})

describe('buildMatrixGrid — matrice des risques pour l’export Word', () => {
  const model = matrixModelFromConfig(null)
  it('lignes = vraisemblance décroissante, colonnes = gravité croissante ; risques Rn placés par leur couple G×V', () => {
    const g = buildMatrixGrid(model, risques, r => ({ g: Number(r.gravite), v: Number(r.vraisemblance) }))
    expect(g.header.map(h => h.text)).toEqual(model.graviteLevels.map(l => `${l.niveau} · ${l.label}`))
    expect(g.rows.map(r => r.label.startsWith('4'))).toEqual([true, false, false, false])
    const at = (v: number, gr: number) => g.rows.find(r => r.label.startsWith(String(v)))!.cells[gr - 1]
    expect(at(3, 4).text).toBe('R1 R2')
    expect(at(1, 1).text).toBe('R3')
    expect(at(2, 2).text).toBe('')
  })
  it('position résiduelle (repli sur brut) : R1 se déplace, R2 et R3 restent', () => {
    const g = buildMatrixGrid(model, risques, r => ({ g: Number(r.graviteResiduelle ?? r.gravite), v: Number(r.vraisemblanceResiduelle ?? r.vraisemblance) }))
    const at = (v: number, gr: number) => g.rows.find(r => r.label.startsWith(String(v)))!.cells[gr - 1]
    expect(at(1, 2).text).toBe('R1'); expect(at(3, 4).text).toBe('R2')
  })
  it('couleurs : 6 hexadécimaux sans « # », éclaircies vers le blanc (lisibles avec le texte) ; légende = paliers du plus faible au plus fort', () => {
    const g = buildMatrixGrid(model, risques, () => ({ g: 1, v: 1 }))
    for (const row of g.rows) for (const c of row.cells) expect(c.fill).toMatch(/^[0-9A-F]{6}$/)
    expect(g.legend.length).toBeGreaterThanOrEqual(3)
    expect(new Set(g.legend.map(l => l.label)).size).toBe(g.legend.length)
  })
})
