import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
})

describe('HistoricImportPreview', () => {
  it('ne confirme pas une feuille de risques tant que son intitulé n’est pas mappé', () => {
    const onConfirm = vi.fn()
    render(<HistoricImportPreview
      sheets={[{ name: 'Risques', columns: ['Référence', 'Titre'], rows: 2, detection: { type: 'RISKS' }, mapping: { externalId: 'Référence' }, missing: ['title'] }]}
      labels={{ title: 'Préparer', confirm: 'Importer', cancel: 'Annuler', missing: 'Champ requis', noSheets: 'Aucune feuille', rows: 'lignes', mappingName: 'Nom', saveMapping: 'Enregistrer', loadMapping: 'Charger', fieldLabels: { title: 'Intitulé', externalId: 'Référence', riskExternalId: 'Référence risque', actionExternalId: 'Référence action' } }}
      onCancel={vi.fn()} onConfirm={onConfirm}
    />)
    expect(screen.getByRole('button', { name: 'Importer' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Risques — Intitulé'), { target: { value: 'Titre' } })
    expect(screen.getByRole('button', { name: 'Importer' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ Risques: expect.objectContaining({ title: 'Titre' }) }))
  })
})
