import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProcessusCartoView from '@/components/ProcessusCartoView'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) }); vi.stubGlobal('fetch', fetchMock) })

const processus = {
  periodicite: 'ANNUELLE' as const,
  etapes: [
    { key: 'identification' as const, titre: 'Identification des risques', description: 'Recenser', responsable: 'Risk Manager' },
    { key: 'evaluation' as const, titre: 'Évaluation', description: 'Coter' },
    { key: 'traitement' as const, titre: 'Traitement', description: 'Décider' },
    { key: 'suivi' as const, titre: 'Suivi et revue', description: 'Réviser' },
    { key: 'communication' as const, titre: 'Communication', description: 'Présenter' },
  ],
}
const faits = { derniereMaj: '2025-06-01T00:00:00.000Z', prochaineRevue: '2026-06-01T00:00:00.000Z', statut: 'EN_RETARD' as const, nbRisques: 12 }

describe('ProcessusCartoView', () => {
  it('affiche les étapes, le statut de revue et le nombre de risques', () => {
    render(<ProcessusCartoView processus={processus} faits={faits} canEdit={false} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('Revue en retard')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('12 risque(s) au registre')
    expect(screen.queryByRole('button', { name: 'Modifier le processus' })).toBeNull()
  })

  it('modification par la gouvernance : PUT avec étapes et périodicité', async () => {
    render(<ProcessusCartoView processus={processus} faits={faits} canEdit />)
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le processus' }))
    fireEvent.change(screen.getByLabelText('Périodicité de revue'), { target: { value: 'SEMESTRIELLE' } })
    fireEvent.change(screen.getByLabelText('Suivi et revue — Responsable'), { target: { value: 'Comité des risques' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/cartographie/processus')
    const body = JSON.parse(init.body)
    expect(body.periodicite).toBe('SEMESTRIELLE')
    expect(body.etapes.find((e: { key: string }) => e.key === 'suivi')).toMatchObject({ responsable: 'Comité des risques' })
  })
})
