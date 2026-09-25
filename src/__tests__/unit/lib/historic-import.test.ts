import { describe, expect, it } from 'vitest'
import { buildHistoricImportPackage, buildHistoricImportPackages, detectHistoricImportSheet, suggestHistoricColumnMapping, validateHistoricColumnMapping } from '@/lib/historic-import'

describe('detectHistoricImportSheet', () => {
  it('reconnaît une feuille de risques malgré les accents et espaces', () => {
    expect(detectHistoricImportSheet(' Registre des risques ', ['Référence risque', 'Intitulé', 'Gravité', 'Vraisemblance'])).toMatchObject({ type: 'RISKS', confidence: 'HIGH' })
  })

  it('propose le type plan d’action par ses colonnes, sans inventer de lien', () => {
    expect(detectHistoricImportSheet('Suivi', ['Action ID', 'Intitulé action', 'Échéance', 'Responsable'])).toMatchObject({ type: 'ACTIONS', confidence: 'MEDIUM' })
  })

  it.each([
    ['Risks', ['Risk ID', 'Risk label', 'Impact', 'Likelihood']],
    ['registre', ['Libellé de risque', 'Gravité', 'Probabilité']],
  ])('reconnaît les synonymes métier de risque : %s', (name, columns) => {
    expect(detectHistoricImportSheet(name, columns)).toMatchObject({ type: 'RISKS', confidence: 'HIGH' })
  })

  it('reconnaît une feuille de vulnérabilités rattachée par référence de risque', () => {
    expect(detectHistoricImportSheet('Vulnérabilités', ['Référence risque', 'Libellé vulnérabilité'])).toMatchObject({ type: 'VULNERABILITIES', confidence: 'HIGH' })
  })

  it('mappe la référence d’analyse normalisée par les exports GRC', () => {
    expect(suggestHistoricColumnMapping(['analysis_external_id', 'Risk label']).analysisExternalId).toBe('analysis_external_id')
  })

  it('signale une feuille inconnue', () => {
    expect(detectHistoricImportSheet('Divers', ['Colonne A'])).toEqual({ type: 'UNKNOWN', confidence: 'NONE', missing: [] })
  })
})

describe('buildHistoricImportPackage', () => {
  it('conserve les références externes afin de relier risques et actions après import', () => {
    const result = buildHistoricImportPackage([
      { type: 'RISKS', mapping: { externalId: 'Ref', title: 'Risque', gravity: 'G', likelihood: 'V' }, rows: [{ Ref: 'R-1', Risque: 'Indisponibilité', G: '3', V: '2' }] },
      { type: 'ACTIONS', mapping: { externalId: 'Ref action', riskExternalId: 'Ref risque', title: 'Action' }, rows: [{ 'Ref action': 'A-1', 'Ref risque': 'R-1', Action: 'Tester le PRA' }] },
    ], 'Import historique')
    expect(result.risks).toEqual([expect.objectContaining({ externalId: 'R-1', title: 'Indisponibilité', gravity: 3, likelihood: 2 })])
    expect(result.actions).toEqual([expect.objectContaining({ externalId: 'A-1', riskExternalId: 'R-1', title: 'Tester le PRA' })])
  })

  it('importe des vulnérabilités depuis une autre feuille du même classeur', () => {
    const result = buildHistoricImportPackage([
      { type: 'RISKS', mapping: { externalId: 'Ref', title: 'Risque' }, rows: [{ Ref: 'R-1', Risque: 'Indisponibilité' }] },
      { type: 'VULNERABILITIES', mapping: { riskExternalId: 'Ref risque', title: 'Libellé vulnérabilité' }, rows: [{ 'Ref risque': 'R-1', 'Libellé vulnérabilité': 'Sauvegardes non testées' }] },
    ], 'Import historique')
    expect(result.vulnerabilities).toEqual([{ riskExternalId: 'R-1', title: 'Sauvegardes non testées' }])
  })

  it('sépare les risques de deux analyses grâce à leur référence source', () => {
    const packages = buildHistoricImportPackages([
      { type: 'ANALYSES', mapping: { externalId: 'Analyse ID', title: 'Titre' }, rows: [{ 'Analyse ID': 'A-1', Titre: 'Analyse 1' }, { 'Analyse ID': 'A-2', Titre: 'Analyse 2' }] },
      { type: 'RISKS', mapping: { externalId: 'Risque ID', analysisExternalId: 'Analyse ID', title: 'Risque' }, rows: [{ 'Analyse ID': 'A-1', 'Risque ID': 'R-1', Risque: 'R1' }, { 'Analyse ID': 'A-2', 'Risque ID': 'R-2', Risque: 'R2' }] },
      { type: 'VULNERABILITIES', mapping: { riskExternalId: 'Risque ID', title: 'Vulnérabilité' }, rows: [{ 'Risque ID': 'R-1', Vulnérabilité: 'V1' }, { 'Risque ID': 'R-2', Vulnérabilité: 'V2' }] },
    ], 'Fallback')
    expect(packages.map(item => [item.analysis.title, item.risks[0]?.title])).toEqual([['Analyse 1', 'R1'], ['Analyse 2', 'R2']])
    expect(packages.map(item => item.vulnerabilities[0]?.title)).toEqual(['V1', 'V2'])
  })
})

describe('validateHistoricColumnMapping', () => {
  it('bloque les risques sans intitulé, mais accepte les cotations absentes', () => {
    expect(validateHistoricColumnMapping('RISKS', { externalId: 'Ref', title: 'Intitulé' })).toEqual([])
    expect(validateHistoricColumnMapping('RISKS', { externalId: 'Ref' })).toEqual(['title'])
  })

  it('exige les deux références pour relier un risque à une action', () => {
    expect(validateHistoricColumnMapping('RISK_ACTION_LINKS', { riskExternalId: 'Risque', actionExternalId: 'Action' })).toEqual([])
    expect(validateHistoricColumnMapping('RISK_ACTION_LINKS', { riskExternalId: 'Risque' })).toEqual(['actionExternalId'])
  })
})
