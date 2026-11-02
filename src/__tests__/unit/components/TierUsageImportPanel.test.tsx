// Import des points d'accès / qualification des usages TIC : aperçu (dryRun) puis application, erreurs par ligne traduites.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TierUsageImportPanel from '@/components/TierUsageImportPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const apercu = { lines: [{ line: 2, statut: 'OK' }, { line: 3, statut: 'ERREUR', erreur: 'usage_ambigu' }], counts: { ok: 1, ignorees: 0, erreurs: 1, points: 1, qualifications: 1 } }
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (_u: string, init: RequestInit) => ({ ok: true, json: async () => (JSON.parse(String(init.body)).dryRun ? apercu : { ...apercu, points: 1, qualifications: 1, plafond: 0 }) }))
  vi.stubGlobal('fetch', fetchMock)
})

describe('TierUsageImportPanel', () => {
  it('aperçu puis application', async () => {
    const onImported = vi.fn()
    render(<TierUsageImportPanel onImported={onImported} />)
    const file = new File(['Prestataire;Service\nA;B\n'], 'usages.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('Fichier CSV ou XLSX'), { target: { files: [file] } })
    expect(await screen.findByTestId('compteurs')).toHaveTextContent('1 ligne(s) prête(s)')
    expect(screen.getByText(/plusieurs usages correspondent/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer les 1 ligne(s) prête(s)' }))
    await waitFor(() => expect(onImported).toHaveBeenCalled())
    expect(await screen.findByRole('status')).toHaveTextContent('1 point(s) d’accès ajouté(s), 1 usage(s) qualifié(s).')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).dryRun).toBe(false)
  })
})
