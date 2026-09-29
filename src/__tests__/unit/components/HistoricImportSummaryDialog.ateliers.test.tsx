import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HistoricImportSummaryDialog from '@/components/HistoricImportSummaryDialog'
import { fr } from '@/lib/i18n/fr'

describe('bilan d’import — ateliers, lignes ignorées, avertissements', () => {
  it('affiche les objets d’atelier créés, la note des lignes modèles (sans rejet) et les points à vérifier traduits', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ mappings: [] }) })))
    render(<HistoricImportSummaryDialog
      result={{ imported: 1, results: [], decisions: [{ sheetName: 'VM', row: 9, status: 'IGNORED', reason: 'EMPTY_TEMPLATE_ROW' }], ateliers: { businessValues: 6, fearedEvents: 8 }, warnings: ['strategic_scenario_feared_event_not_found:ER_77', 'code_inconnu:x'] }}
      selection={{ mappings: {}, sheetTypes: {}, transforms: {}, statusMappings: {}, scoreMappings: {} } as never}
      labels={fr.historicImportSummary as never} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Ateliers importés').textContent).toContain('6 valeur(s) métier · 8 événement(s) redouté(s)')
    expect(screen.getByRole('note').textContent).toContain('1 ligne(s) modèle vide(s) ignorée(s)')
    const w = screen.getByLabelText('Points à vérifier')
    expect(w.textContent).toContain('événement redouté « ER_77 » introuvable')
    expect(w.textContent).toContain('code_inconnu')
  })
  it('écart de gravité : nom du scénario et deux gravités lisibles (pas de clé technique)', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ mappings: [] }) })))
    render(<HistoricImportSummaryDialog
      result={{ imported: 1, results: [], decisions: [], warnings: ['strategic_scenario_gravity_differs:SS_04:2:3'] }}
      selection={{ mappings: {}, sheetTypes: {}, transforms: {}, statusMappings: {}, scoreMappings: {} } as never}
      labels={fr.historicImportSummary as never} onClose={vi.fn()} />)
    const text = screen.getByLabelText('Points à vérifier').textContent ?? ''
    expect(text).toContain('Scénario stratégique « SS_04 » : gravité 2 dans le fichier')
    expect(text).toContain('est 3')
    expect(text).not.toContain('SS_04:2:3')
  })
})

describe('bilan d’import — champs nommés lisiblement', () => {
  it('une ligne rejetée affiche le libellé du champ ACRA, pas sa clé technique', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ mappings: [] }) })))
    render(<HistoricImportSummaryDialog
      result={{ imported: 1, results: [], decisions: [{ sheetName: 'PACS', row: 6, status: 'FIELD_OMITTED', reason: 'INVALID_FORMAT', field: 'status', sourceColumn: 'Statut', sourceValue: 'Terminé' }] }}
      selection={{ mappings: {}, sheetTypes: {}, transforms: {}, statusMappings: {}, scoreMappings: {} } as never}
      labels={{ ...(fr.historicImportSummary as object), fieldLabels: { status: 'Statut' } } as never} onClose={vi.fn()} />)
    expect(screen.getByText(/PACS — ligne 6 — Statut/)).toBeTruthy()
  })
})
