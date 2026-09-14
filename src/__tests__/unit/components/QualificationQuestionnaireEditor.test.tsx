import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QualificationQuestionnaireEditor from '@/components/QualificationQuestionnaireEditor'

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: {
      save: 'Enregistrer', saving: '…', delete: 'Supprimer',
      qualifEditor: {
        sectionTitle: 'Q', sectionDesc: 'd', builtinTitle: 'Natives', builtinHint: 'h', enabledHint: 'a',
        customTitle: 'Custom', customEmpty: 'vide', typeBool: 'Oui/Non', typeChoice: 'Choix',
        newLabel: 'Nouvelle', newLabelPh: 'ph', newType: 'Type', newOptions: 'Options', newOptionsPh: 'ph', add: 'Ajouter', saved: 'Enregistré',
      },
    },
  }),
}))

describe('QualificationQuestionnaireEditor', () => {
  it('ajoute une question personnalisée et l’enregistre (PUT)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ qualificationQuestionnaire: { overrides: {}, custom: [] } }) })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<QualificationQuestionnaireEditor initial={{ overrides: {}, custom: [] }} builtins={[{ id: 'criticite', label: 'Criticité' }]} />)

    fireEvent.change(screen.getByPlaceholderText('ph', { selector: 'input' }), { target: { value: 'Budget alloué ?' } })
    fireEvent.click(screen.getByText('Ajouter'))
    fireEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === 'PUT')
      expect(put).toBeTruthy()
      const body = JSON.parse((put![1] as RequestInit).body as string)
      expect(body.qualificationQuestionnaire.custom[0].label).toBe('Budget alloué ?')
    })
  })
})
