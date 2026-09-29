import { describe, expect, it } from 'vitest'
import { buildHistoricImportPackage, detectHistoricImportSheet, partitionHistoricImportSheets, validateHistoricColumnMapping, validateHistoricImportSelection, type HistoricImportSheet } from '@/lib/historic-import'
import { parseAnalysisImportRequest } from '@/lib/analysis-import'

const vm: HistoricImportSheet = { name: '1 - Valeurs Métiers', type: 'BUSINESS_VALUES', mapping: { externalId: 'Réf.VM', title: 'Dénomination', availability: 'D', integrity: 'I', confidentiality: 'C' }, rows: [
  { 'Réf.VM': 'VM_01', Dénomination: 'Planification', D: '3', I: '3', C: '2' },
  { 'Réf.VM': 'VM_07', Dénomination: '', D: '', I: '', C: '' },
] }
const er: HistoricImportSheet = { name: '1 - Événements redoutés', type: 'FEARED_EVENTS', mapping: { externalId: 'Réf.ER', title: 'Intitulé', gravity: 'Gravité', businessValueRefs: 'VM' }, rows: [{ 'Réf.ER': 'ER_01', Intitulé: 'Divulgation', Gravité: '3 - Importante', VM: 'VM01' }] }
const ri: HistoricImportSheet = { name: '5 - Risques initiaux', type: 'RISKS', mapping: { externalId: 'Réf.RI', title: 'Description', gravity: 'Gravité initiale' }, rows: [{ 'Réf.RI': 'RI_01', Description: 'Usurpation', 'Gravité initiale': '3 - Importante' }] }

describe('import historique — ateliers 1 à 4', () => {
  it('le paquet porte les objets des ateliers, la méthode EBIOS RM, et reste valide pour l’import', () => {
    const pkg = buildHistoricImportPackage([vm, er, ri], 'Dossier BTP')
    expect(pkg.analysis.methode).toBe('EBIOS_RM')
    expect(pkg.businessValues?.map(v => v.title)).toEqual(['Planification'])
    expect(pkg.fearedEvents?.[0]).toMatchObject({ gravity: 3, businessValueExternalIds: ['VM1'] })
    expect(pkg.risks[0]).toMatchObject({ externalId: 'RI_01', gravity: 3 })
    const parsed = parseAnalysisImportRequest({ ...pkg, idempotencyKey: 'cle-idempotence-1' })
    expect(parsed.businessValues).toHaveLength(1)
  })
  it('sans feuille d’atelier : paquet inchangé (pas de clés v3, pas de méthode imposée)', () => {
    const pkg = buildHistoricImportPackage([ri], 'Registre')
    expect(Object.keys(pkg)).toEqual(['analysis', 'risks', 'vulnerabilities', 'measures', 'actions', 'links'])
    expect(pkg.analysis.methode).toBeUndefined()
  })
  it('la ligne modèle (référence seule) est ignorée avant construction', () => {
    const { sheets, decisions } = partitionHistoricImportSheets([vm])
    expect(sheets[0].rows).toHaveLength(1)
    expect(decisions.find(d => d.status === 'IGNORED')).toMatchObject({ reason: 'EMPTY_TEMPLATE_ROW' })
  })
  it('détection par colonne de référence à préfixe, intitulé requis, aucun blocage croisé', () => {
    expect(detectHistoricImportSheet('1 - Valeurs Métiers', ['Réf.VM', 'Dénomination'])).toMatchObject({ type: 'BUSINESS_VALUES', confidence: 'HIGH' })
    expect(validateHistoricColumnMapping('BUSINESS_VALUES', {})).toEqual(['title'])
    expect(validateHistoricImportSelection([{ name: 'VM', type: 'BUSINESS_VALUES', mapping: { title: 'Dénomination' } }])).toEqual([])
  })
})
