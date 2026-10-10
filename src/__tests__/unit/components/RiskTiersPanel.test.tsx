// Vue inverse sur un risque du registre : services tiers dont l'évaluation alimente ce risque (zone actuelle → cible) ;
// rien n'est affiché quand aucun service n'est rattaché.
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RiskTiersPanel from '@/components/RiskTiersPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body } as Response)
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('RiskTiersPanel', () => {
  it('liste les services tiers rattachés avec zone actuelle → cible et statut', async () => {
    fetchMock.mockImplementation(() => ok({ services: [{ tiers: 'Hébergeur', offre: 'IaaS', usage: 'Paie', statut: 'VALIDEE', actuelle: { menace: 3, zone: 'danger' }, cible: { menace: 0.89, zone: 'veille' } }] }))
    render(<RiskTiersPanel riskId="r1" />)
    expect(await screen.findByText('Services tiers rattachés')).toBeInTheDocument()
    expect(screen.getByText(/Hébergeur — IaaS — Paie/)).toBeInTheDocument()
    expect(screen.getByText('3 — Danger')).toBeInTheDocument()
    expect(screen.getByText('0,89 — Veille')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/risk-items/r1/tiers')
  })
  it('aucun service rattaché : rien n’est affiché', async () => {
    fetchMock.mockImplementation(() => ok({ services: [] }))
    const { container } = render(<RiskTiersPanel riskId="r1" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
