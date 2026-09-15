import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OrgConformiteEditor from '@/components/OrgConformiteEditor'

// i18n
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    locale: 'fr',
    t: {
      loading: '…',
      conformiteSocle: {
        title: 'Socle', subtitle: 'Socle de {org}', referentiel: 'Référentiel',
        snapshot: 'Figer', snapshotting: '…', snapshotHint: 'h', saved: 'Enregistré',
        evalues: '{n}/{total}', loadError: 'load err', saveError: 'save err',
        nonApplicable: 'na', aucunReferentiel: 'aucun',
      },
    },
  }),
}))

// Historique & tendance : composant enfant autonome (a ses propres i18n/fetch).
vi.mock('@/components/ConformiteHistory', () => ({ default: () => <div data-testid="history" /> }))
// Registre des traitements : composant enfant autonome (i18n/fetch propres).
vi.mock('@/components/TraitementsRegistre', () => ({ default: () => <div data-testid="registre" /> }))

// Grille : bouton qui simule le passage d'un contrôle à « non_conforme ».
vi.mock('@/components/ConformiteGrid', () => ({
  default: ({ entries, onChange }: { entries: { ref: string; statut: string }[]; onChange: (e: { ref: string; statut: string }[]) => void }) => (
    <div>
      <span data-testid="count">{entries.length}</span>
      <button onClick={() => onChange([{ ref: 'A.5.1', statut: 'non_conforme' }])}>toggle</button>
    </div>
  ),
}))

// Contrôles du référentiel (statique) — un seul contrôle.
vi.mock('@/lib/frameworks-data', () => ({
  getFrameworkControles: () => [{ ref: 'A.5.1', nom: 'Politique', categorie: '', type: '' }],
}))

describe('OrgConformiteEditor', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('charge le socle (GET) puis persiste un changement (PATCH) sur le bon référentiel', async () => {
    // Chargement = 3 fetch en parallèle (conformité, exigences, import) + PATCH au changement.
    const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
      const u = String(url)
      if (opts?.method === 'PATCH') return Promise.resolve({ ok: true, json: async () => ({ ok: true, stats: {} }) })
      if (u.includes('/conformite/import')) return Promise.resolve({ ok: true, json: async () => ({ analyses: [] }) })
      if (u.includes('/referentiels/exigences')) return Promise.resolve({ ok: true, json: async () => ({ exigences: [{ ref: 'A.5.1', nom: 'Politique' }] }) })
      if (u.includes('/conformite?referentiel')) return Promise.resolve({ ok: true, json: async () => ({ entries: [{ ref: 'A.5.1', statut: 'conforme' }] }) })
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<OrgConformiteEditor orgId="org1" orgNom="StarBank" referentiels={[{ code: 'ISO27001', nom: 'ISO 27001' }]} initialRef="ISO27001" />)

    // Chargement initial : GET avec le référentiel sélectionné.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/organizations/org1/conformite?referentiel=ISO27001'),
    ))
    // Grille hydratée avec 1 entrée.
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))

    // Changement → PATCH { referentiel, ref, statut }.
    fireEvent.click(screen.getByText('toggle'))
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === 'PATCH')
      expect(patch).toBeTruthy()
      expect(JSON.parse((patch![1] as RequestInit).body as string)).toMatchObject({ referentiel: 'ISO27001', ref: 'A.5.1', statut: 'non_conforme' })
    })
  })
})
