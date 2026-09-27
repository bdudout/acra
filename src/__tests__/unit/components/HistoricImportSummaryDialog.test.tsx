import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import HistoricImportSummaryDialog from '@/components/HistoricImportSummaryDialog'

const labels = {
  title: 'Bilan de l’import',
  explanation: 'Le fichier a été traité.',
  imported: 'Analyses importées',
  created: { risks: 'Risques', vulnerabilities: 'Vulnérabilités', measures: 'Mesures', actions: 'Actions' },
  importedRows: 'Lignes importées',
  omittedFields: 'Importé avec champ écarté',
  rejectedRows: 'Lignes non importées',
  sourceValue: 'Valeur source', expectedValue: 'Règle attendue', emptyValue: 'vide',
  reasons: { MISSING_REQUIRED_VALUE: 'champ obligatoire absent', INVALID_FORMAT: 'format invalide', CARDINALITY_MISMATCH: 'référence incompatible' },
  close: 'Fermer',
  mapping: { title: 'Conserver ce mapping', explanation: 'Optionnel.', newMapping: 'Nouveau mapping', updateMapping: 'Mettre à jour un mapping', save: 'Enregistrer le mapping', saved: 'Mapping enregistré' },
}

describe('HistoricImportSummaryDialog', () => {
  it('détaille les données créées, les lignes écartées et ferme tout l’assistant', () => {
    const onClose = vi.fn()
    render(<HistoricImportSummaryDialog labels={labels} onClose={onClose} selection={{ mappings: {}, sheetTypes: {}, transforms: {}, statusMappings: {}, scoreMappings: {}, organizationId: 'org-1' }} result={{ imported: 1, results: [{ nom: 'Analyse historique', created: { risks: 2, vulnerabilities: 3, measures: 4, actions: 5 } }], decisions: [{ sheetName: 'Risques', row: 8, status: 'REJECTED', field: 'title', reason: 'MISSING_REQUIRED_VALUE', sourceColumn: 'Intitulé', sourceValue: '', expectedValue: 'texte non vide' }, { sheetName: 'Risques', row: 9, status: 'FIELD_OMITTED', field: 'gravity', reason: 'INVALID_FORMAT', sourceColumn: 'Impact', sourceValue: 'Critique', expectedValue: '1–4' }] }} />)
    expect(screen.getByRole('dialog', { name: 'Bilan de l’import' })).toHaveTextContent('2 Risques')
    expect(screen.getByRole('dialog')).toHaveTextContent('3 Vulnérabilités')
    expect(screen.getByRole('dialog')).toHaveTextContent('Risques — ligne 8')
    expect(screen.getByRole('dialog')).toHaveTextContent('Intitulé = vide')
    expect(screen.getByRole('dialog')).toHaveTextContent('champ obligatoire absent')
    expect(screen.getByText('Conserver ce mapping')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('enregistre le mapping depuis le bilan dans l’organisation cible', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mappings: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<HistoricImportSummaryDialog labels={labels} onClose={vi.fn()} selection={{ mappings: { Risques: { title: 'Intitulé' } }, sheetTypes: { Risques: 'RISKS' }, transforms: {}, statusMappings: {}, scoreMappings: {}, organizationId: 'org-1' }} result={{ imported: 1, results: [], decisions: [] }} />)
    fireEvent.change(screen.getByLabelText('Nouveau mapping'), { target: { value: 'Historique 2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mapping' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/analysis-imports/mappings', expect.objectContaining({ method: 'POST' })))
    expect(fetchMock.mock.calls[1][1].body).toContain('"organizationId":"org-1"')
    expect(await screen.findByText('Mapping enregistré')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
