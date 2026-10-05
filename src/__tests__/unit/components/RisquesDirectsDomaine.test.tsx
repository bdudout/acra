import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RisquesDirects from '@/components/RisquesDirects'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
const rows = [
  { id: 'r1', nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', domaine: 'CYBER', sourceAnalyseId: 'c1' },
  { id: 'r2', nom: 'Faux virement', gravite: 3, vraisemblance: 2, niveauRisque: 6, strategie: 'REDUIRE', domaine: 'FRAUD' },
]
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((_u: string, init?: RequestInit) => init?.method === 'POST' || init?.method === 'PATCH'
    ? ok({ risque: { id: 'r3' } })
    : ok({ risques: rows }))
  vi.stubGlobal('fetch', fetchMock)
})

describe('RisquesDirects — domaine (analyse projet 360)', () => {
  it('ajout avec domaine, filtre par domaine, badge « Importé »', async () => {
    render(<RisquesDirects analyseId="a1" editable withDomaine />)
    expect(await screen.findByText('Rançongiciel')).toBeTruthy()
    expect(screen.getByText('Importé')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Filtrer par domaine'), { target: { value: 'FRAUD' } })
    expect(screen.queryByText('Rançongiciel')).toBeNull()
    expect(screen.getByText('Faux virement')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Intitulé du risque'), { target: { value: 'Dérive planning' } })
    fireEvent.change(screen.getByLabelText('Domaine du nouveau risque'), { target: { value: 'PROJECT' } })
    fireEvent.click(screen.getByRole('button', { name: /Ajouter/ }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')))
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toMatchObject({ nom: 'Dérive planning', domaine: 'PROJECT' })
  })

  it('changer le domaine d’un risque envoie un PATCH', async () => {
    render(<RisquesDirects analyseId="a1" editable withDomaine />)
    fireEvent.change(await screen.findByLabelText('Domaine — Faux virement'), { target: { value: 'BUSINESS' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PATCH')))
    const patch = fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')!
    expect(patch[0]).toBe('/api/analyses/a1/risques/r2')
    expect(JSON.parse(patch[1].body)).toEqual({ domaine: 'BUSINESS' })
  })

  it('suggestion issue du registre : badge et domaine transmis à l’ajout', async () => {
    render(<RisquesDirects analyseId="a1" editable withDomaine suggestions={[{ intitule: 'Panne du SI de paiement', gravite: 3, vraisemblance: 2, pertinent: true, source: 'REGISTRE', domaine: 'IT' }]} />)
    const toggle = await screen.findByRole('button', { name: /Suggestions/ })
    if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
    const chip = await screen.findByRole('button', { name: /Panne du SI de paiement/ })
    expect(chip.textContent).toContain('Depuis le registre')
    fireEvent.click(chip)
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1].body)).toMatchObject({ nom: 'Panne du SI de paiement', domaine: 'IT' })
  })
})
