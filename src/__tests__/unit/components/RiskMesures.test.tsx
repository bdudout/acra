import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RiskMesures from '@/components/RiskMesures'

const M = {
  add: 'Ajouter', delete: 'Supprimer',
  mesuresTitle: 'Mesures de sécurité existantes', mesuresEmpty: 'Aucune mesure.',
  mesuresNomPlaceholder: 'Intitulé de la mesure', mesuresEfficacite: 'Efficacité',
}
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ locale: 'fr', t: { risquesDirects: M } }) }))
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const jsonOk = (b: unknown) => Promise.resolve({ ok: true, json: async () => b } as Response)

describe('RiskMesures', () => {
  it('liste les mesures rattachées + état vide', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ mesures: [{ id: 'm1', nom: 'MFA', type: 'PREVENTIVE', statut: 'REALISE', efficacite: 3 }] }))
    render(<RiskMesures analyseId="an1" riskId="r1" editable />)
    expect(await screen.findByText('MFA')).toBeInTheDocument()
    expect(screen.getByText('Mesures de sécurité existantes')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/analyses/an1/risques/r1/mesures')
  })

  it('ajoute une mesure (POST) puis recharge', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ mesures: [] }))
    render(<RiskMesures analyseId="an1" riskId="r1" editable />)
    await screen.findByText('Aucune mesure.')
    fireEvent.change(screen.getByPlaceholderText('Intitulé de la mesure'), { target: { value: 'Sauvegardes' } })
    fetchMock.mockReturnValueOnce(jsonOk({ mesure: { id: 'm2' } }))                 // POST
    fetchMock.mockReturnValueOnce(jsonOk({ mesures: [{ id: 'm2', nom: 'Sauvegardes', type: 'CORRECTIVE', statut: 'REALISE', efficacite: 3 }] })) // reload
    fireEvent.click(screen.getByText('Ajouter'))
    await waitFor(() => expect(screen.getByText('Sauvegardes')).toBeInTheDocument())
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')
    expect(post?.[0]).toBe('/api/analyses/an1/risques/r1/mesures')
    expect(JSON.parse(post![1].body)).toMatchObject({ nom: 'Sauvegardes', efficacite: 3 })
  })

  it('supprime une mesure (DELETE)', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ mesures: [{ id: 'm1', nom: 'MFA', type: 'PREVENTIVE', statut: 'REALISE', efficacite: 3 }] }))
    render(<RiskMesures analyseId="an1" riskId="r1" editable />)
    await screen.findByText('MFA')
    fetchMock.mockReturnValueOnce(jsonOk({ ok: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByText('MFA')).toBeNull())
    const del = fetchMock.mock.calls.find(c => c[1]?.method === 'DELETE')
    expect(del?.[0]).toBe('/api/analyses/an1/risques/r1/mesures/m1')
  })

  it('lecture seule : pas de formulaire d’ajout', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ mesures: [] }))
    render(<RiskMesures analyseId="an1" riskId="r1" editable={false} />)
    await screen.findByText('Aucune mesure.')
    expect(screen.queryByText('Ajouter')).toBeNull()
  })
})
