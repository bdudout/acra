import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegistreTicManager from '@/components/RegistreTicManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }))

const fetchMock = vi.fn()
const list = {
  active: true, canManage: true, completude: { total: 1, complets: 0, incomplets: 1, taux: 0 },
  synthese: { arrangements: 1, prestataires: 1, critiques: 0, sousTraitance: 0, concentrationTop: null, expirentBientot: 0 },
  tiersOptions: [{ id: 't1', nom: 'Acme Logiciels', lei: '549300ABCDEFGHIJ1234', pays: 'FR' }],
  arrangements: [{ id: 'a1', reference: 'C-1', prestataireNom: 'ACME', identifiant: null, pays: null, typeService: 'CLOUD', fonctionSupportee: null, criticite: 'NON_CRITIQUE', dateDebut: null, dateFin: null, paysDonnees: null, sousTraitance: false, champsManquants: [], tierId: 't1', questionnaire: [] }],
}
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response)
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation((_u: string, init?: RequestInit) => (init?.method && init.method !== 'GET' ? ok({ id: 'new' }, 201) : ok(list)))
})

describe('RegistreTicManager — identité du tiers à la saisie', () => {
  it('l’arrangement rapproché l’indique dans la liste', async () => {
    render(<RegistreTicManager canManage />)
    expect(await screen.findByLabelText('Identité de tiers rattachée')).toBeInTheDocument()
  })
  it('choisir une identité préremplit nom, LEI et pays seulement s’ils sont vides, et l’envoie avec la saisie', async () => {
    render(<RegistreTicManager canManage />)
    await screen.findByText('C-1')
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un accord/ }))
    fireEvent.change(screen.getByLabelText('Identité du tiers (facultatif)'), { target: { value: 't1' } })
    const nom = screen.getAllByRole('textbox').find(el => (el as HTMLInputElement).required && (el as HTMLInputElement).value === 'Acme Logiciels') as HTMLInputElement
    expect(nom).toBeTruthy()
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'C-9' } })
    fireEvent.submit(nom.closest('form')!)
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true))
    const body = JSON.parse(String(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1].body))
    expect(body).toMatchObject({ reference: 'C-9', prestataireNom: 'Acme Logiciels', identifiant: '549300ABCDEFGHIJ1234', pays: 'FR', tierId: 't1' })
  })
  it('« Non rapproché » envoie tierId nul ; un nom déjà saisi n’est pas écrasé', async () => {
    render(<RegistreTicManager canManage />)
    await screen.findByText('C-1')
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un accord/ }))
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'C-2' } }); fireEvent.change(inputs[1], { target: { value: 'Mon nom' } })
    fireEvent.change(screen.getByLabelText('Identité du tiers (facultatif)'), { target: { value: 't1' } })
    expect((screen.getAllByRole('textbox')[1] as HTMLInputElement).value).toBe('Mon nom')
    fireEvent.change(screen.getByLabelText('Identité du tiers (facultatif)'), { target: { value: '' } })
    fireEvent.submit(screen.getAllByRole('textbox')[0].closest('form')!)
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true))
    expect(JSON.parse(String(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1].body)).tierId).toBeNull()
  })
})
