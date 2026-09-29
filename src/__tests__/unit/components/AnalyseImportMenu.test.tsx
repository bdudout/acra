import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AnalyseImportMenu from '@/components/AnalyseImportMenu'
import HistoricImportPreview from '@/components/HistoricImportPreview'

const labels = {
  trigger: 'Importer', acraTitle: 'Export ACRA', acraDesc: 'JSON ou CSV ACRA.',
  excelTitle: 'Excel historique', excelDesc: 'Assistant Excel en préparation.',
  apiTitle: 'API', apiDesc: 'Import industrialisé via API.',
  mcpTitle: 'MCP', mcpDesc: 'Import assisté avec validation humaine.',
}

describe('AnalyseImportMenu', () => {
  it('affiche les quatre parcours au premier clic et ouvre le sélecteur ACRA', () => {
    const onAcraImport = vi.fn()
    render(<AnalyseImportMenu labels={labels} onAcraImport={onAcraImport} onExcelImport={vi.fn()} />)
    expect(screen.queryByText(labels.excelTitle)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: labels.trigger }))
    expect(screen.getByText(labels.excelTitle)).toBeInTheDocument()
    expect(screen.getByText(labels.apiTitle)).toBeInTheDocument()
    expect(screen.getByText(labels.mcpTitle)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(labels.acraTitle) }))
    expect(onAcraImport).toHaveBeenCalledOnce()
  })

  it('préremplit l’organisation active et transmet l’organisation cible choisie', () => {
    const onConfirm = vi.fn()
    render(<HistoricImportPreview
      sheets={[{ name: 'Risques', columns: ['Titre'], rows: 1, detection: { type: 'RISKS' }, mapping: { title: 'Titre' }, missing: [] }]}
      organizationOptions={[{ id: 'org-active', nom: 'Organisation active' }, { id: 'org-filiale', nom: 'Filiale' }]}
      defaultOrganizationId="org-active"
      labels={{ title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'Champ requis', noSheets: 'Aucune feuille', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Utiliser cette feuille comme', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Comment compléter le mapping ?', mappingHelp: 'Choisissez le rôle de chaque feuille puis associez les colonnes.', targetOrganization: 'Organisation cible', fieldLabels: { title: 'Intitulé' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens risque-action' } }}
      onCancel={vi.fn()} onConfirm={onConfirm}
    />)
    const organization = screen.getByLabelText('Organisation cible')
    expect(organization).toHaveValue('org-active')
    fireEvent.change(organization, { target: { value: 'org-filiale' } })
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-filiale' }))
  })
})

describe('HistoricImportPreview', () => {
  it('ne confirme pas une feuille de risques tant que son intitulé n’est pas mappé', () => {
    const onConfirm = vi.fn()
    render(<HistoricImportPreview
      sheets={[{ name: 'Risques', columns: ['Référence', 'Titre'], rows: 2, detection: { type: 'RISKS' }, mapping: { externalId: 'Référence' }, missing: ['title'] }]}
      labels={{ title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'Champ requis', noSheets: 'Aucune feuille', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Utiliser cette feuille comme', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Comment compléter le mapping ?', mappingHelp: 'Choisissez le rôle de chaque feuille puis associez les colonnes.', fieldLabels: { title: 'Intitulé', externalId: 'Référence', riskExternalId: 'Référence risque', actionExternalId: 'Référence action' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens risque-action' } }}
      onCancel={vi.fn()} onConfirm={onConfirm}
    />)
    expect(screen.getAllByText(/ACRA/).length).toBeGreaterThan(0)
    expect(screen.getByText('✕')).toBeInTheDocument()
    expect(screen.getByTestId('historic-import-footer')).toHaveTextContent('Intitulé')
    expect(screen.getByRole('button', { name: 'Importer' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Risques — Intitulé'), { target: { value: 'Titre' } })
    expect(screen.getAllByText('✓').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Importer' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ mappings: expect.objectContaining({ Risques: expect.objectContaining({ title: 'Titre' }) }), sheetTypes: { Risques: 'RISKS' } }))
  })

  it('permet d’affecter une feuille non reconnue aux mesures et de mapper ses colonnes', () => {
    render(<HistoricImportPreview
      sheets={[{ name: 'Dispositifs consultant', columns: ['Code', 'Dispositif', 'Pilote', 'Statut'], rows: 2, detection: { type: 'UNKNOWN' }, mapping: {}, missing: [] }]}
      labels={{ title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'Champ requis', noSheets: 'Aucune feuille', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Utiliser cette feuille comme', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Comment compléter le mapping ?', mappingHelp: 'Choisissez le rôle de chaque feuille puis associez les colonnes.', fieldLabels: { title: 'Intitulé', externalId: 'Référence', riskExternalId: 'Référence risque', actionExternalId: 'Référence action' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens risque-action' } }}
      onCancel={vi.fn()} onConfirm={vi.fn()}
    />)
    expect(screen.getAllByText(/feuilles ignorées/i).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Dispositifs consultant — Utiliser cette feuille comme'), { target: { value: 'MEASURES' } })
    expect(screen.getByLabelText('Dispositifs consultant — Intitulé')).toBeInTheDocument()
  })

  it('laisse confirmer un import partiel quand une cotation source reste invalide', () => {
    render(<HistoricImportPreview
      sheets={[{ name: 'Risques', columns: ['Titre', 'Impact historique'], rows: 1, detection: { type: 'RISKS' }, mapping: { title: 'Titre', gravity: 'Impact historique' }, missing: [], profiles: { 'Impact historique': { examples: ['Critique'], values: ['Critique'], total: 1, numeric1to4Count: 0, isoDateCount: 0, measureStatusCount: 0, strategyCount: 0 } } }]}
      labels={{ title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'Champ requis', noSheets: 'Aucune feuille', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Utiliser cette feuille comme', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Comment compléter le mapping ?', mappingHelp: 'Choisissez le rôle de chaque feuille puis associez les colonnes.', fieldLabels: { title: 'Intitulé', externalId: 'Référence', gravity: 'Gravité', riskExternalId: 'Référence risque', actionExternalId: 'Référence action' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens risque-action' } }}
      onCancel={vi.fn()} onConfirm={vi.fn()}
    />)
    expect(screen.getByLabelText('Gravité: INVALID')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer' })).toBeEnabled()
  })

  it('propose clairement de ne pas importer ou de compléter chaque ligne à donnée requise manquante', () => {
    const onConfirm = vi.fn()
    render(<HistoricImportPreview
      sheets={[{ name: 'Risques', columns: ['Titre'], rows: 1, detection: { type: 'RISKS' }, mapping: { title: 'Titre' }, missing: [] }]}
      requiredValueGaps={[{ sheetName: 'Risques', row: 8, field: 'title', sourceColumn: 'Intitulé historique', sourceValue: '', expectedValue: 'texte non vide' }]}
      labels={{ title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'Champ requis', noSheets: 'Aucune feuille', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Utiliser cette feuille comme', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Comment compléter le mapping ?', mappingHelp: 'Choisissez le rôle de chaque feuille puis associez les colonnes.', fieldLabels: { title: 'Intitulé', externalId: 'Référence', riskExternalId: 'Référence risque', actionExternalId: 'Référence action' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens risque-action' }, completion: { title: 'Données manquantes', explanation: 'Choisissez une action pour chaque ligne.', skip: 'Ne pas importer la ligne', complete: 'Compléter la ligne', value: 'Valeur à renseigner', sourceValue: 'Valeur Excel', expectedValue: 'Valeur attendue', emptyValue: 'vide', skipSummary: 'ligne(s) ne seront pas importées', completeSummary: 'ligne(s) seront complétées' } }}
      onCancel={vi.fn()} onConfirm={onConfirm}
    />)
    const missingDataPanel = screen.getByLabelText('Données manquantes')
    expect(missingDataPanel).toHaveClass('dark:bg-amber-950/50', 'dark:text-amber-50')
    expect(missingDataPanel.querySelector('fieldset')).toHaveClass('dark:bg-slate-900', 'dark:text-slate-100')
    expect(missingDataPanel).toHaveTextContent('Valeur Excel : Intitulé historique = vide')
    expect(missingDataPanel).toHaveTextContent('Valeur attendue : texte non vide')
    expect(screen.getByLabelText('Risques — ligne 8 — Intitulé — Ne pas importer la ligne')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Risques — ligne 8 — Intitulé — Compléter la ligne'))
    const input = screen.getByLabelText('Risques — ligne 8 — Intitulé — Valeur à renseigner')
    expect(screen.getByRole('button', { name: 'Importer' })).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Risque renseigné' } })
    expect(screen.getByRole('button', { name: 'Importer' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ rowOverrides: { Risques: { '8': { title: 'Risque renseigné' } } } }))
  })
})

describe('HistoricImportPreview — formules sans valeur', () => {
  it('avertit d’une feuille dont des cellules calculées n’ont pas de valeur enregistrée', () => {
    render(<HistoricImportPreview
      sheets={[{ name: '2 - Parties prenantes', columns: ['Partie prenante'], rows: 3, detection: { type: 'UNKNOWN' }, mapping: {}, missing: [], warnings: { formulasWithoutValue: { count: 71, samples: ['G9', 'J9'] } } }]}
      labels={{ title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'Champ requis', noSheets: 'Aucune feuille', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Utiliser cette feuille comme', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Aide', mappingHelp: 'Aide', fieldLabels: {}, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens risque-action' }, warnings: { noValue: '{n} cellule(s) sans valeur (ex. {cells})', errors: '{n} en erreur' } }}
      onCancel={vi.fn()} onConfirm={vi.fn()}
    />)
    expect(screen.getByRole('note').textContent).toBe('71 cellule(s) sans valeur (ex. G9, J9)')
  })
})
