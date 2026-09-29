/** Lot I3 — niveaux « N - libellé » et lignes modèles vides dans l'import historique. */
import { describe, expect, it } from 'vitest'
import { buildHistoricImportPackage, partitionHistoricImportSheets, profileHistoricColumn, validateHistoricColumnProfile, type HistoricImportSheet } from '@/lib/historic-import'

const risks = (rows: Record<string, string>[]): HistoricImportSheet => ({
  name: 'Risques', type: 'RISKS', rows,
  mapping: { externalId: 'Réf.RI', title: 'Description du risque', gravity: 'Gravité initiale', likelihood: 'Vraisemblance initiale' },
})

describe('niveaux « N - libellé » (B-IMP-28)', () => {
  it('le profil et la validation acceptent « 2 - Limitée » comme un niveau 1–4', () => {
    const p = profileHistoricColumn(['2 - Limitée', '3 - Importante', '4 - Critique'])
    expect(p.numeric1to4Count).toBe(3)
    expect(validateHistoricColumnProfile('gravity', p).invalidCount).toBe(0)
  })
  it('un niveau hors 1–4 (échelle à 5 niveaux) reste invalide : correspondance explicite requise', () => {
    const p = profileHistoricColumn(['5 - Trivial', '2 - Difficile'])
    expect(validateHistoricColumnProfile('likelihood', p).invalidCount).toBe(1)
  })
  it('l’import lit le niveau dans le libellé', () => {
    const pkg = buildHistoricImportPackage([risks([{ 'Réf.RI': 'RI_01', 'Description du risque': 'Usurpation de compte', 'Gravité initiale': '3 - Importante', 'Vraisemblance initiale': '2 - Vraisemblable' }])], 'Test')
    expect(pkg.risks[0]).toMatchObject({ externalId: 'RI_01', gravity: 3, likelihood: 2 })
  })
  it('une valeur hors échelle est écartée du champ, la ligne reste importée (FIELD_OMITTED)', () => {
    const { decisions, sheets } = partitionHistoricImportSheets([risks([{ 'Réf.RI': 'RI_02', 'Description du risque': 'Déni de service', 'Gravité initiale': '3 - Importante', 'Vraisemblance initiale': '5 - Courant' }])])
    expect(decisions.find(d => d.status === 'FIELD_OMITTED')).toMatchObject({ field: 'likelihood', reason: 'INVALID_FORMAT' })
    expect(sheets[0].rows).toHaveLength(1)
  })
})

describe('lignes modèles vides (B-IMP-44)', () => {
  it('une ligne dont seule la référence est renseignée est ignorée sans erreur et comptée', () => {
    const { decisions, sheets } = partitionHistoricImportSheets([risks([
      { 'Réf.RI': 'RI_01', 'Description du risque': 'Réel', 'Gravité initiale': '2', 'Vraisemblance initiale': '2' },
      { 'Réf.RI': 'RI_02', 'Description du risque': '', 'Gravité initiale': '', 'Vraisemblance initiale': '' },
    ])])
    expect(sheets[0].rows.map(r => r['Réf.RI'])).toEqual(['RI_01'])
    expect(decisions.filter(d => d.status === 'IGNORED')).toEqual([{ sheetName: 'Risques', row: 3, status: 'IGNORED', reason: 'EMPTY_TEMPLATE_ROW' }])
    expect(decisions.filter(d => d.status === 'REJECTED')).toHaveLength(0)
  })
  it('une ligne avec référence ET autre contenu mais sans intitulé reste rejetée (valeur requise manquante)', () => {
    const { decisions } = partitionHistoricImportSheets([risks([{ 'Réf.RI': 'RI_03', 'Description du risque': '', 'Gravité initiale': '3', 'Vraisemblance initiale': '' }])])
    expect(decisions.find(d => d.status === 'REJECTED')).toMatchObject({ field: 'title', reason: 'MISSING_REQUIRED_VALUE' })
  })
})
