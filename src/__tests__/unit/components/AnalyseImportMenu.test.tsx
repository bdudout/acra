import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AnalyseImportMenu from '@/components/AnalyseImportMenu'
import HistoricImportPreview, { type HistoricPreviewSheet } from '@/components/HistoricImportPreview'
import { BUILTIN_PROFILES } from '@/lib/import-profile'

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
      sheets={[{ name: 'Risques', columns: ['Titre', 'Impact historique'], rows: 1, detection: { type: 'RISKS' }, mapping: { title: 'Titre', gravity: 'Impact historique' }, missing: [], profiles: { 'Impact historique': { examples: ['Bof'], values: ['Bof'], total: 1, numeric1to4Count: 0, isoDateCount: 0, measureStatusCount: 0, strategyCount: 0 } } }]}
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

describe('HistoricImportPreview — profil reconnu (lot I4)', () => {
  const columns = Object.fromEntries(BUILTIN_PROFILES[0].sheets.map(sh => [sh.match.name, [...Object.values(sh.fields).filter((c): c is string => !!c)]]))
  const sheets = Object.entries(columns).map(([name, cols]) => ({ name, columns: cols, rows: 5, detection: { type: 'UNKNOWN' as const }, mapping: {}, missing: [] }))
  const labels = { title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'requis', noSheets: 'Aucune', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Rôle', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Aide', mappingHelp: 'Aide', fieldLabels: { title: 'Intitulé' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens', BUSINESS_VALUES: 'Valeurs métier', SUPPORT_ASSETS: 'Biens supports', FEARED_EVENTS: 'Événements redoutés', RISK_SOURCES: 'Sources de risque', STAKEHOLDERS: 'Parties prenantes', STRATEGIC_SCENARIOS: 'Scénarios stratégiques', OPERATIONAL_SCENARIOS: 'Scénarios opérationnels', SECURITY_BASELINE: 'Socle' }, profile: { recognized: 'Profil reconnu : {name} ({pct} %)', apply: 'Appliquer ce profil', builtin: 'livré', partial: 'partiel' } }
  it('propose le profil livré et l’applique : rôles et colonnes chargés', () => {
    render(<HistoricImportPreview sheets={sheets} labels={labels} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toContain('Profil reconnu : Dossier de sécurité EBIOS RM (100 %)')
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer ce profil' }))
    expect((screen.getByLabelText('5 - Risques initiaux — Rôle') as HTMLSelectElement).value).toBe('RISKS')
    expect((screen.getByLabelText('5 - PACS — Rôle') as HTMLSelectElement).value).toBe('MEASURES')
    expect((screen.getByLabelText('1 - Valeurs Métiers — Rôle') as HTMLSelectElement).value).toBe('BUSINESS_VALUES')
  })
  it('aucun profil sur un classeur inconnu', () => {
    render(<HistoricImportPreview sheets={[{ name: 'Divers', columns: ['a'], rows: 1, detection: { type: 'UNKNOWN' }, mapping: {}, missing: [] }]} labels={labels} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('HistoricImportPreview — alias de préfixe (R_ ⇒ RI_)', () => {
  const profile = (values: string[]) => ({ examples: values.slice(0, 3), values, total: values.length, numeric1to4Count: 0, isoDateCount: 0, measureStatusCount: 0, strategyCount: 0 })
  const labels = { title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'requis', noSheets: 'Aucune', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Rôle', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Aide', mappingHelp: 'Aide', fieldLabels: { title: 'Intitulé' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens' }, aliasPrefix: 'Préfixe « {from} » ≠ « {to} » : rapprocher ?' }
  const sheets: HistoricPreviewSheet[] = [
    { name: 'Risques', columns: ['Réf.RI', 'Libellé'], rows: 3, detection: { type: 'RISKS' as const }, mapping: { externalId: 'Réf.RI', title: 'Libellé' }, missing: [], profiles: { 'Réf.RI': profile(['RI_01', 'RI_02']) } },
    { name: 'PACS', columns: ['Mesure', 'Risques'], rows: 3, detection: { type: 'MEASURES' as const }, mapping: { title: 'Mesure', riskExternalId: 'Risques' }, missing: [], profiles: { Risques: profile(['R_01 à R_09', 'R_05 R_07']) } },
  ]
  it('propose l’alias, jamais appliqué sans validation ; transmis à l’import quand il est coché', async () => {
    const onConfirm = vi.fn()
    render(<HistoricImportPreview sheets={sheets} labels={labels} onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm.mock.calls[0][0].refAliases).toEqual({})
    await waitFor(() => expect(screen.getByRole('button', { name: 'Importer' })).toBeEnabled()) // le verrou anti double clic se lève à la fin de l'appel
    fireEvent.click(screen.getByLabelText('Préfixe « R » ≠ « RI » : rapprocher ?'))
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm.mock.calls[1][0].refAliases).toEqual({ PACS: { R: 'RI' } })
  })
})

describe('HistoricImportPreview — correspondance des valeurs (sources de risque)', () => {
  const profile = (values: string[]) => ({ examples: values.slice(0, 3), values, total: values.length, numeric1to4Count: 0, isoDateCount: 0, measureStatusCount: 0, strategyCount: 0 })
  const labels = { title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'requis', noSheets: 'Aucune', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Rôle', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Aide', mappingHelp: 'Aide', fieldLabels: { title: 'Intitulé' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens', RISK_SOURCES: 'Sources de risque' }, valueMap: { title: 'Correspondance des valeurs', hint: 'Aide', other: 'Autre', category: { CYBERCRIMINEL: 'Cybercriminel', ETAT_NATION: 'État / Nation', AUTRE: 'Autre' }, type: {} } }
  const sheets: HistoricPreviewSheet[] = [{ name: '1 - SROV', columns: ['Réf.SR/OV', 'Sources de risques'], rows: 3, detection: { type: 'RISK_SOURCES' }, mapping: { externalId: 'Réf.SR/OV', title: 'Sources de risques' }, missing: [], profiles: { 'Sources de risques': profile(['Etat', 'Officine Spécialisée']) } }]
  it('pré-remplit depuis le dictionnaire (Etat → État / Nation), signale l’inconnu (Autre) et transmet le choix', () => {
    const onConfirm = vi.fn()
    render(<HistoricImportPreview sheets={sheets} labels={labels} onCancel={vi.fn()} onConfirm={onConfirm} />)
    expect((screen.getByLabelText('1 - SROV — Etat') as HTMLSelectElement).value).toBe('ETAT_NATION')
    expect((screen.getByLabelText('1 - SROV — Officine Spécialisée') as HTMLSelectElement).value).toBe('AUTRE')
    fireEvent.change(screen.getByLabelText('1 - SROV — Officine Spécialisée'), { target: { value: 'CYBERCRIMINEL' } })
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm.mock.calls[0][0].valueMaps).toEqual({ '1 - SROV': { category: { 'Officine Spécialisée': 'CYBERCRIMINEL' } } })
  })
})

describe('HistoricImportPreview — cotations en clair proposées', () => {
  const profile = (values: string[]) => ({ examples: values.slice(0, 3), values, total: values.length, numeric1to4Count: 0, isoDateCount: 0, measureStatusCount: 0, strategyCount: 0 })
  it('propose Critique → 4 (modifiable) et le transmet ; une échelle inconnue n’est jamais proposée', () => {
    const onConfirm = vi.fn()
    const labels = { title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'requis', noSheets: 'Aucune', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Rôle', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Aide', mappingHelp: 'Aide', fieldLabels: { title: 'Intitulé' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens', RISK_SOURCES: 'Sources de risque' }, valueMap: { title: 'Correspondance des valeurs', hint: 'Aide', other: 'Autre', category: { CYBERCRIMINEL: 'Cybercriminel', ETAT_NATION: 'État / Nation', AUTRE: 'Autre' }, type: {} } }
    render(<HistoricImportPreview sheets={[{ name: 'Registre', columns: ['Risque', 'Impact', 'Probabilité'], rows: 2, detection: { type: 'RISKS' }, mapping: { title: 'Risque', gravity: 'Impact', likelihood: 'Probabilité' }, missing: [], profiles: { Risque: profile(['A', 'B']), Impact: profile(['Critique', 'Limitée']), Probabilité: profile(['Bof', 'Peut-être']) } }]} labels={labels} onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm.mock.calls[0][0].scoreMappings).toEqual({ Registre: { gravity: { Critique: '4', Limitée: '2' } } })
  })
})

describe('AnalyseImportMenu — clavier, lecteur d’écran, mobile', () => {
  it('↓ ouvre et focalise le premier parcours ; les canaux non disponibles sont annoncés inactifs et sautés au clavier ; Échap rend le focus', () => {
    render(<AnalyseImportMenu labels={labels} onAcraImport={vi.fn()} onExcelImport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: labels.trigger })
    trigger.focus(); fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document, { key: 'ArrowDown' }); expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(document, { key: 'ArrowDown' }); expect(document.activeElement).toBe(items[0]) // API et MCP (aria-disabled) sont sautés
    expect(items.filter(i => i.getAttribute('aria-disabled') === 'true')).toHaveLength(2)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull(); expect(document.activeElement).toBe(trigger)
  })
  it('annonce un menu nommé par son bouton et reste visible sur mobile', () => {
    render(<AnalyseImportMenu labels={labels} onAcraImport={vi.fn()} onExcelImport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: labels.trigger })
    expect(trigger.className).not.toMatch(/\bhidden\b/)
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu'); expect(trigger.getAttribute('aria-controls')).toBe(menu.id); expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id)
  })
})

describe('HistoricImportPreview — lignes à décider regroupées', () => {
  const labels = { title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'requis', noSheets: 'Aucune', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Rôle', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Aide', mappingHelp: 'Aide', fieldLabels: { title: 'Intitulé' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens', RISK_SOURCES: 'Sources de risque' }, valueMap: { title: 'Correspondance des valeurs', hint: 'Aide', other: 'Autre', category: { CYBERCRIMINEL: 'Cybercriminel', ETAT_NATION: 'État / Nation', AUTRE: 'Autre' }, type: {} } , completion: { title: 'Données manquantes', explanation: 'Choisissez une action pour chaque ligne.', skip: 'Ne pas importer la ligne', complete: 'Compléter la ligne', value: 'Valeur à renseigner', sourceValue: 'Valeur Excel', expectedValue: 'Valeur attendue', emptyValue: 'vide', skipSummary: 'ligne(s) ne seront pas importées', completeSummary: 'ligne(s) seront complétées', groupSummary: '{sheet} — {n} ligne(s) à décider', skipAll: 'Ne pas importer les {n} lignes', perRow: 'Décider ligne par ligne', importableTitle: 'Ce qui sera importé', importableReady: '{n} prête(s)', importableToDecide: '{n} à décider', importableTemplate: '{n} modèle(s) ignoré(s)' } }
  const gaps = (n: number, sheetName = 'Parties prenantes') => Array.from({ length: n }, (_, i) => ({ sheetName, row: 20 + i, field: 'title', sourceColumn: 'Partie prenante', sourceValue: '', expectedValue: 'texte non vide' }))
  const sheets: HistoricPreviewSheet[] = [{ name: 'Parties prenantes', columns: ['Partie prenante'], rows: 30, detection: { type: 'RISKS' }, mapping: { title: 'Partie prenante' }, missing: [] }]
  it('au-delà de 5 lignes d’une même feuille : titre du groupe et bouton global TOUJOURS visibles ; lignes dans un détail replié', () => {
    render(<HistoricImportPreview sheets={sheets} requiredValueGaps={gaps(18)} labels={labels} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    const panel = screen.getByLabelText('Données manquantes')
    expect(panel.textContent).toContain('Parties prenantes — 18 ligne(s) à décider')
    const button = screen.getByRole('button', { name: /Ne pas importer les 18 lignes/ })
    expect(button.closest('details')).toBeNull() // visible sans ouvrir le détail
    const details = panel.querySelectorAll('details')
    expect(details).toHaveLength(1); expect(details[0]).not.toHaveAttribute('open')
    expect(details[0].querySelector('summary')!.textContent).toBe('Décider ligne par ligne')
  })
  it('le clic sur « Ne pas importer les N lignes » donne un retour visible (état annoncé) et annule les « Compléter » du groupe', () => {
    render(<HistoricImportPreview sheets={sheets} requiredValueGaps={gaps(6)} labels={labels} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Parties prenantes — ligne 20 — Intitulé — Compléter la ligne'))
    const status = () => screen.getByTestId('group-status-Parties prenantes')
    expect(status().textContent).toContain('5 ligne(s) ne seront pas importées'); expect(status().textContent).toContain('1 ligne(s) seront complétées')
    fireEvent.click(screen.getByRole('button', { name: /Ne pas importer les 6 lignes/ }))
    expect(screen.getByLabelText('Parties prenantes — ligne 20 — Intitulé — Ne pas importer la ligne')).toBeChecked()
    expect(status().textContent).toContain('6 ligne(s) ne seront pas importées'); expect(status().textContent).toContain('0 ligne(s) seront complétées')
    expect(status()).toHaveAttribute('role', 'status')
  })
  it('5 lignes ou moins : affichage ligne par ligne inchangé (pas de groupe)', () => {
    render(<HistoricImportPreview sheets={sheets} requiredValueGaps={gaps(5)} labels={labels} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByLabelText('Données manquantes').querySelectorAll('details')).toHaveLength(0)
  })
  it('avant les lignes à décider : « Ce qui sera importé » par objet (lignes prêtes, à décider, modèles ignorés)', () => {
    const decisions = [
      ...Array.from({ length: 64 }, (_, i) => ({ sheetName: 'Parties prenantes', row: 6 + i, status: 'READY' as const })),
      { sheetName: 'Parties prenantes', row: 90, status: 'IGNORED' as const, reason: 'EMPTY_TEMPLATE_ROW' as const },
    ]
    render(<HistoricImportPreview sheets={sheets} requiredValueGaps={gaps(8)} reviewDecisions={decisions} labels={labels} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    const ready = screen.getByLabelText('Ce qui sera importé')
    expect(ready.textContent).toContain('64 prête(s)'); expect(ready.textContent).toContain('8 à décider'); expect(ready.textContent).toContain('1 modèle(s) ignoré(s)')
    const panel = screen.getByLabelText('Données manquantes')
    expect(ready.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy() // placé AVANT la revue
  })
})

describe('HistoricImportPreview — retour visible après « Appliquer ce profil » et chargement d’un mapping', () => {
  it('annonce le profil appliqué (nombre de feuilles configurées) dans une zone status', () => {
    const sheet = (name: string, columns: string[]) => ({ name, columns, rows: 3, detection: { type: 'UNKNOWN' }, mapping: {}, missing: [] }) as HistoricPreviewSheet
    const p = BUILTIN_PROFILES[0]
    const sheets = p.sheets.filter(x => x.role !== 'UNKNOWN').map(x => sheet(x.match.name, Object.values(x.fields).filter(Boolean) as string[]))
    const labels = { title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'requis', noSheets: 'Aucune', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Rôle', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Importables', ignoredSheets: 'Ignorées', mappingHelpTitle: 'Aide', mappingHelp: 'Aide', fieldLabels: {}, sheetTypes: {}, profile: { recognized: 'Profil reconnu : {name} ({pct} %)', apply: 'Appliquer ce profil', applied: 'Profil « {name} » appliqué : {n} feuille(s) configurée(s).', builtin: 'livré', partial: 'partiel' } } as never
    render(<HistoricImportPreview sheets={sheets} labels={labels} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer ce profil' }))
    const status = screen.getAllByRole('status').map(x => x.textContent).join(' ')
    expect(status).toMatch(/Profil « Dossier de sécurité EBIOS RM » appliqué : \d+ feuille\(s\) configurée\(s\)\./)
  })
})

describe('HistoricImportPreview — import en cours', () => {
  const labels = { title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'requis', noSheets: 'Aucune', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', sheetRole: 'Rôle', ignoreSheet: 'Ne pas importer', summaryTitle: 'Résumé', importableSheets: 'Feuilles à importer', ignoredSheets: 'Feuilles ignorées', mappingHelpTitle: 'Aide', mappingHelp: 'Aide', fieldLabels: { title: 'Intitulé' }, sheetTypes: { ANALYSES: 'Analyse', RISKS: 'Risques', VULNERABILITIES: 'Vulnérabilités', MEASURES: 'Mesures', ACTIONS: 'Plans d’action', RISK_ACTION_LINKS: 'Liens', RISK_SOURCES: 'Sources de risque' }, valueMap: { title: 'Correspondance des valeurs', hint: 'Aide', other: 'Autre', category: { CYBERCRIMINEL: 'Cybercriminel', ETAT_NATION: 'État / Nation', AUTRE: 'Autre' }, type: {} } }
  const sheets: HistoricPreviewSheet[] = [{ name: 'Risques', columns: ['Titre'], rows: 1, detection: { type: 'RISKS' }, mapping: { title: 'Titre' }, missing: [] }]
  it('pendant l’import : bouton désactivé avec indicateur qui tourne et libellé « Import en cours… » annoncé', () => {
    render(<HistoricImportPreview sheets={sheets} importing labels={{ ...labels, importing: 'Import en cours…' } as never} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    const button = screen.getByRole('button', { name: /Import en cours/ })
    expect(button).toBeDisabled(); expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
  })
  it('hors import : bouton actif ; un seul appel malgré un double clic rapide', () => {
    const onConfirm = vi.fn()
    render(<HistoricImportPreview sheets={sheets} labels={{ ...labels, importing: 'Import en cours…' } as never} onCancel={vi.fn()} onConfirm={onConfirm} />)
    const button = screen.getByRole('button', { name: 'Importer' })
    expect(button).toBeEnabled()
    fireEvent.click(button); fireEvent.click(button)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
