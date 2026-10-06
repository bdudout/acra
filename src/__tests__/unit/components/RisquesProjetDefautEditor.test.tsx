import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RisquesProjetDefautEditor from '@/components/RisquesProjetDefautEditor'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((_u: string, init?: RequestInit) => Promise.resolve({ ok: true, json: async () => (init?.method === 'PUT' ? {} : { risquesProjetDefaut: { desactives: ['PROJ_BUDGET'], ajoutes: [] } }) }))
  vi.stubGlobal('fetch', fetchMock)
})

describe('Configuration › Projets : risques par défaut', () => {
  it('liste le catalogue (désactivés décochés), ajoute un risque, enregistre', async () => {
    render(<RisquesProjetDefautEditor isAdmin />)
    const budget = await screen.findByRole('checkbox', { name: /Dépassement du budget du projet/ }) as HTMLInputElement
    expect(budget.checked).toBe(false)
    expect((screen.getByRole('checkbox', { name: /Dérive du planning/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /Dérive du planning/ }))
    fireEvent.change(screen.getByLabelText('Intitulé du risque'), { target: { value: 'Indisponibilité du site pilote' } })
    fireEvent.change(screen.getByLabelText('Plan d’action par défaut (facultatif)'), { target: { value: 'Valider le site de repli' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le risque' }))
    // Le plan par défaut de chaque risque du catalogue est visible (expert à consulter).
    expect(screen.getByText(/Faire qualifier le traitement de données personnelles par le DPO/)).toBeTruthy()
    expect(screen.getByText('Indisponibilité du site pilote')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)
    expect(body.risquesProjetDefaut.desactives.sort()).toEqual(['PROJ_BUDGET', 'PROJ_DELAIS'])
    expect(body.projetSuppressionValidation).toBe(true)
    expect(body.risquesProjetDefaut.ajoutes).toEqual([expect.objectContaining({ intitule: 'Indisponibilité du site pilote', gravite: 2, vraisemblance: 2, plan: 'Valider le site de repli' })])
    expect(await screen.findByText('Risques par défaut enregistrés.')).toBeTruthy()
  })
  it('lecture seule hors administrateur', async () => {
    render(<RisquesProjetDefautEditor isAdmin={false} />)
    expect(((await screen.findByRole('checkbox', { name: /Dérive du planning/ })) as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
  })
})
