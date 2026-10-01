import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectorSettings from '@/components/SectorSettings'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async (url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'PUT') return { ok: true, json: async () => ({ sectors: JSON.parse(init.body!).sectors }) }
    return { ok: true, json: async () => ({ sectors: ['SANTE'], available: ['FINANCE', 'ASSURANCE', 'SANTE', 'PUBLIC', 'SAAS', 'INDUSTRIE', 'COMMERCE', 'SERVICES'] }) }
  })
})

describe('SectorSettings — secteurs d’activité de l’organisation', () => {
  it('affiche les secteurs déclarés, le principal, et permet d’en ajouter puis d’enregistrer dans l’ordre', async () => {
    render(<SectorSettings />)
    const santé = await screen.findByRole('checkbox', { name: 'Santé / Médico-social' })
    expect(santé).toBeChecked()
    expect(screen.getByText('Secteur principal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Informatique / Numérique' }))
    fireEvent.click(screen.getByRole('button', { name: 'Monter Informatique / Numérique' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les secteurs' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/catalogue-suggestions/sectors', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ sectors: ['SAAS', 'SANTE'] }) })))
    expect(await screen.findByRole('status')).toHaveTextContent('Secteurs enregistrés')
  })
  it('au-delà de trois secteurs, les autres cases sont désactivées', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ sectors: ['SANTE', 'SAAS', 'PUBLIC'], available: ['FINANCE', 'SANTE', 'SAAS', 'PUBLIC'] }) }))
    render(<SectorSettings />)
    expect(await screen.findByRole('checkbox', { name: 'Banque / Finance' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Santé / Médico-social' })).toBeEnabled()
  })
  it('lecture seule (403) : rien n’est affiché', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 403, json: async () => ({}) }))
    const { container } = render(<SectorSettings />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
