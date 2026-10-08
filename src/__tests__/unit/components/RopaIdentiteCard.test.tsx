// Identité du responsable du traitement (RGPD art. 30 §1 a) : DPO désigné dans ACRA repris automatiquement (lecture
// seule), sinon champ libre ; manque signalé ; enregistrement.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RopaIdentiteCard from '@/components/RopaIdentiteCard'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const vide = { responsableNom: '', responsableAdresse: '', responsableContact: '', representantNom: '', representantContact: '', dpoNom: '', dpoContact: '' }
const reponse = (designes: { nom: string; contact: string }[], saisie = vide) => ({
  saisie, designes,
  effective: { responsable: { nom: saisie.responsableNom, adresse: '', contact: saisie.responsableContact }, representant: { nom: '', contact: '' },
    dpo: designes.length ? { source: 'DESIGNE', nom: designes[0].nom, contact: designes[0].contact } : { source: 'AUCUN', nom: '', contact: '' },
    manquants: saisie.responsableNom ? [] : ['responsableNom', 'responsableContact'] },
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('RopaIdentiteCard', () => {
  it('DPO désigné : repris automatiquement, pas de saisie libre du DPO ; manque du responsable signalé', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => reponse([{ nom: 'Alice Martin', contact: 'alice@x.fr' }]) })
    render(<RopaIdentiteCard />)
    expect(await screen.findByText('Désigné dans ACRA (rôle DPO) : Alice Martin (alice@x.fr)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Délégué à la protection des données')).toBeNull()
    expect(screen.getByText(/À compléter : nom et coordonnées du responsable/)).toBeInTheDocument()
  })
  it('aucun DPO désigné : champ libre ; enregistrement de la saisie', async () => {
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string; body?: string }) => ({ ok: true, json: async () => (init?.method === 'PUT' ? reponse([], { ...vide, ...JSON.parse(init.body!) }) : reponse([])) }))
    render(<RopaIdentiteCard />)
    expect(await screen.findByText(/Aucun DPO désigné dans ACRA/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Responsable du traitement'), { target: { value: 'Banque Exemple SA' } })
    fireEvent.change(screen.getByLabelText('Coordonnées (e-mail, téléphone)'), { target: { value: 'contact@banque.fr' } })
    fireEvent.change(screen.getByLabelText('Délégué à la protection des données'), { target: { value: 'Cabinet X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’identité' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(true))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)).toMatchObject({ responsableNom: 'Banque Exemple SA', responsableContact: 'contact@banque.fr', dpoNom: 'Cabinet X' })
    expect(await screen.findByText('Identité enregistrée.')).toBeInTheDocument()
  })
})
