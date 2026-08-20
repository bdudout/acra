import { describe, it, expect } from 'vitest'
import { buildSoaExport, type SoaControleLite } from '../../../lib/soa-export'
import { type ConformiteEntry } from '../../../lib/conformite'

const controles: SoaControleLite[] = [
  { ref: 'A.5.1', nom: 'Politiques', categorie: 'Organisationnel' },
  { ref: 'A.5.2', nom: 'Rôles', categorie: 'Organisationnel' },
  { ref: 'A.8.1', nom: 'Terminaux', categorie: 'Technologique' },
]
const entries: ConformiteEntry[] = [
  { ref: 'A.5.1', statut: 'conforme', commentaire: 'OK' },
  { ref: 'A.8.1', statut: 'non_conforme' },
]

describe('buildSoaExport', () => {
  it('fusionne les contrôles du référentiel avec les évaluations (ordre préservé)', () => {
    const soa = buildSoaExport(controles, entries)
    expect(soa.lignes.map(l => l.ref)).toEqual(['A.5.1', 'A.5.2', 'A.8.1'])
    expect(soa.lignes[0]).toMatchObject({ statut: 'conforme', commentaire: 'OK' })
    // Contrôle non évalué → statut null.
    expect(soa.lignes[1]).toMatchObject({ ref: 'A.5.2', statut: null })
  })

  it('regroupe par catégorie dans l’ordre d’apparition', () => {
    const soa = buildSoaExport(controles, entries)
    expect(soa.groupes.map(g => g.categorie)).toEqual(['Organisationnel', 'Technologique'])
    expect(soa.groupes[0].lignes.length).toBe(2)
    expect(soa.groupes[1].lignes.length).toBe(1)
  })

  it('compte la distribution par statut, avec un bucket « non évalué »', () => {
    const soa = buildSoaExport(controles, entries)
    expect(soa.parStatut).toEqual({ conforme: 1, partiel: 0, nonConforme: 1, na: 0, nonEvalue: 1 })
  })

  it('catégorie manquante → repli sur un libellé vide regroupé ensemble', () => {
    const soa = buildSoaExport([{ ref: 'X', nom: 'Sans cat' }], [])
    expect(soa.groupes.length).toBe(1)
    expect(soa.groupes[0].lignes[0].categorie).toBeNull()
  })
})
