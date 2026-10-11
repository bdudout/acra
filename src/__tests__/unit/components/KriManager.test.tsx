// Recette n° 35 : un KRI rattaché à une catégorie d'incidents a sa mesure de la période pré-remplie (nombre d'incidents,
// commentaire explicatif) à l'ouverture ; rien n'est enregistré avant le clic sur « Enregistrer ».
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KriManager from '@/components/KriManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const kri = {
  id: 'k1', intitule: 'Fraude externe', description: null, unite: null, sens: 'HAUSSE', seuilAlerte: 2, seuilCritique: 5, frequence: 'MENSUEL',
  responsable: null, taxonomieCode: 'BALE_2', riskItemId: null, riskIntitule: null, actif: true, derniereValeur: null, derniereMesureLe: null,
  statut: 'INCONNU', tendance: 'INCONNU', suggestionIncidents: { nombre: 2, depuis: '2026-10-01' },
}
const fetchMock = vi.fn()
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body } as Response)
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/kri') return ok({ kris: [kri], synthese: { total: 1, normal: 0, alerte: 0, critique: 0, inconnu: 1, enAlerte: 0 } })
    if (url === '/api/kri/k1') return ok({ mesures: [] })
    if (url === '/api/kri/k1/mesures') return ok({ ok: true })
    return ok({})
  })
})

describe('KriManager — mesure suggérée depuis les incidents', () => {
  it('pré-remplit la valeur et le commentaire ; enregistre seulement au clic', async () => {
    const { fr } = await import('@/lib/i18n/fr')
    render(<KriManager canDefine={false} canMeasure />)
    fireEvent.click(await screen.findByText('Fraude externe'))
    await waitFor(() => expect(screen.getByPlaceholderText(fr.kri.valeurPlaceholder)).toHaveValue(2))
    expect(screen.getByText(/2 incident\(s\)/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(c => c[0] === '/api/kri/k1/mesures')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: fr.kri.addMesure }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0] === '/api/kri/k1/mesures')).toBe(true))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/kri/k1/mesures')![1].body).valeur).toBe(2)
  })
})
