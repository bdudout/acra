// Formulaire du registre : sélecteur facultatif « Famille de risque TIC » (axe distinct de la catégorie, lot L2).
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegistreRisques from '@/components/RegistreRisques'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/registre' }))
vi.mock('@/components/AutocompleteInput', () => ({ default: () => <input /> }))
vi.mock('@/components/SectorSuggestionsPanel', () => ({ default: () => null }))
vi.mock('@/components/RisquesViewTabs', () => ({ default: () => null }))

const risk = {
  id: 'r1', intitule: 'Panne du prestataire cloud', taxonomieCode: 'BALE_6', familleRisqueTic: 'TIERS_TIC', processusId: null, processusNom: null,
  entite: null, proprietaire: null, statut: 'IDENTIFIE', provenance: 'MANUEL',
  graviteInherente: null, vraisemblanceInherente: null, graviteResiduelle: null, vraisemblanceResiduelle: null, niveauInherent: null, niveauResiduel: null,
  actionsSummary: { total: 0, faits: 0, enCours: 0, aFaire: 0, enRetard: 0, tauxAvancement: 0 }, calibration: null, controleEfficacite: null,
}
const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/risk-items?') && !init?.method) return ok({
      active: true, risks: [risk], pagination: { page: 1, taille: 50, total: 1, pages: 1 },
      synthese: { total: 1, entiteFrequente: null, valeurs: { category: [], process: [], statut: ['IDENTIFIE'] } },
    })
    if (url === '/api/taxonomie') return ok({ taxonomie: [] })
    if (url === '/api/processus') return ok({ processus: [] })
    return ok({ ok: true })
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('confirm', () => true)
})
const sentBody = (method: string) => {
  const call = fetchMock.mock.calls.find(c => c[1]?.method === method)
  return call ? JSON.parse(call[1].body as string) : null
}

describe('RegistreRisques — famille de risque TIC', () => {
  it('propose les 5 familles (facultatif) et transmet le choix à la création', async () => {
    render(<RegistreRisques canEdit />)
    await screen.findByText('Panne du prestataire cloud')
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un risque/i }))
    const select = screen.getByLabelText('Famille de risque TIC') as HTMLSelectElement
    expect(select.options).toHaveLength(6)
    expect(select.value).toBe('')
    fireEvent.change(screen.getByPlaceholderText(/intitulé/i), { target: { value: 'Rançongiciel' } })
    fireEvent.change(select, { target: { value: 'CYBER' } })
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer' }))
    await waitFor(() => expect(sentBody('POST')).not.toBeNull())
    expect(sentBody('POST')).toMatchObject({ intitule: 'Rançongiciel', familleRisqueTic: 'CYBER' })
  })
  it('pré-remplit la famille à l’édition et l’efface si « non renseignée » est choisi', async () => {
    render(<RegistreRisques canEdit />)
    await screen.findByText('Panne du prestataire cloud')
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const select = screen.getByLabelText('Famille de risque TIC') as HTMLSelectElement
    expect(select.value).toBe('TIERS_TIC')
    fireEvent.change(select, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(sentBody('PATCH')).not.toBeNull())
    expect(sentBody('PATCH')).toMatchObject({ familleRisqueTic: null, taxonomieCode: 'BALE_6' })
  })
})
