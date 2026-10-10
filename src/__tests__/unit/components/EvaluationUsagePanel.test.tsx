// Panneau d'évaluation d'un usage de service tiers (lot T1) : critères de l'atelier 3 EBIOS RM sur les échelles de
// l'organisation, cotation actuelle et cible avec menace et zone recalculées à la saisie, clauses, traitements RGPD et
// risques d'externalisation ; boutons selon les droits (évaluer / soumettre ; valider / renvoyer pour le RSSI).
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EvaluationUsagePanel from '@/components/EvaluationUsagePanel'
import { ECHELLES_ECOSYSTEME_DEFAUT } from '@/lib/ecosystem-echelles'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response)
const reponse = (o: Record<string, unknown> = {}) => ({
  evaluation: null, cotation: { actuelle: null, cible: null }, prochaineEvaluation: null,
  droits: { peutEvaluer: true, peutValider: false }, echelles: ECHELLES_ECOSYSTEME_DEFAUT,
  options: { traitements: [{ id: 't1', nom: 'Paie' }], risques: [{ id: 'r1', intitule: 'Externalisation de l’hébergement', taxonomieCode: null }] }, ...o,
})
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('EvaluationUsagePanel', () => {
  it('saisie : menace et zone recalculées ; enregistrement PUT avec clauses, traitements et risques', async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => (init?.method === 'PUT' ? ok({ ok: true, statut: 'BROUILLON' }) : ok(reponse())))
    const onChange = vi.fn()
    render(<EvaluationUsagePanel usageId="u1" usageNom="Signature des contrats de travail" onChange={onChange} />)
    for (const [crit, v] of [['Dépendance', '4'], ['Pénétration', '3'], ['Maturité SSI', '2'], ['Confiance', '2']] as const) {
      fireEvent.change(await screen.findByLabelText(`${crit} — actuelle`), { target: { value: v } })
    }
    expect(screen.getByTestId('menace-actuelle')).toHaveTextContent('3,00')
    expect(screen.getByTestId('menace-actuelle')).toHaveTextContent('Danger')
    fireEvent.click(screen.getByLabelText('Clauses de sécurité'))
    fireEvent.click(screen.getByLabelText('Paie'))
    fireEvent.click(screen.getByLabelText('Externalisation de l’hébergement'))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)
    expect(body).toMatchObject({ actuelle: { dependance: 4, penetration: 3, maturite: 2, confiance: 2 }, clauses: ['securite'], traitementIds: ['t1'], risqueIds: ['r1'] })
    expect(onChange).toHaveBeenCalled()
  })
  it('évaluation soumise : le RSSI valide ou renvoie ; l’évaluateur ne voit pas « Valider »', async () => {
    const soumise = { evaluation: { statut: 'SOUMISE', actuelle: { dependance: 3, penetration: 3, maturite: 3, confiance: 3 }, cible: null, clauses: [], traitementIds: [], risqueIds: [], justification: '' } }
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => (init?.method === 'POST' ? ok({ ok: true, statut: 'VALIDEE' }) : ok(reponse({ ...soumise, droits: { peutEvaluer: true, peutValider: true } }))))
    render(<EvaluationUsagePanel usageId="u1" usageNom="X" onChange={() => {}} />)
    expect(await screen.findByText('Soumise')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST' && JSON.parse(c[1].body).action === 'VALIDER')).toBe(true))
  })
  it('lecture seule (aucun droit) : pas de bouton d’action', async () => {
    fetchMock.mockImplementation(() => ok(reponse({ droits: { peutEvaluer: false, peutValider: false } })))
    render(<EvaluationUsagePanel usageId="u1" usageNom="X" onChange={() => {}} />)
    await screen.findByLabelText('Dépendance — actuelle')
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
    expect(screen.getByLabelText('Dépendance — actuelle')).toBeDisabled()
  })
})
