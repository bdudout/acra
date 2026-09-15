import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TraitementPopover, { type ExistingTraitement } from '@/components/TraitementPopover'

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: {
      conformite: {
        traitements: { plan_action: 'Plan d\'action', derogation: 'Dérogation', acceptation_risque: 'Acceptation' },
        traitementUI: {
          intitule: 'Intitulé', responsable: 'Responsable', echeance: 'Échéance', descriptionLabel: 'Description',
          niveauRisqueMaintenu: 'Maintenir', niveauRisque: 'Niveau', niveauRisquePh: 'Ex.',
          create: 'Créer', creating: '…', cancel: 'Annuler', covers: '{n} exigence(s)', error: 'Échec.',
          searchExisting: 'Rechercher…', update: 'Mettre à jour', lockedHint: 'Libellé verrouillé', newInstead: 'Nouveau',
          attachBtn: 'Rattacher', actionTag: 'action', linkActionHint: 'Action existante',
        },
      },
    },
  }),
}))

const existing: ExistingTraitement[] = [
  { id: 't1', type: 'PLAN_ACTION', intitule: 'Chiffrer les sauvegardes', refs: ['A.8.1', 'A.8.2'], responsable: 'DSI', echeance: '2026-06-01T00:00:00.000Z', description: 'Plan existant' },
  { id: 't2', type: 'DEROGATION', intitule: 'Dérogation VPN', refs: ['A.9.1'], responsable: 'RSSI' },
]

// Route les fetch par URL + méthode ; `plans` = actions réelles renvoyées au montage.
function mockFetch(plans: unknown[] = []) {
  return vi.fn((url: string, opts?: { method?: string }) => {
    if (url.endsWith('/plans-actions')) return Promise.resolve({ ok: true, json: async () => ({ plans }) })
    return Promise.resolve({ ok: true, json: async () => ({}) })
  }) as unknown as typeof fetch
}

function setup(props: Partial<React.ComponentProps<typeof TraitementPopover>> = {}) {
  const onApplied = vi.fn()
  render(<TraitementPopover
    orgId="o1" referentiel="ISO27001" entite="" controlRef="A.5.1" controlNom="Politique"
    type="PLAN_ACTION" existing={existing} onApplied={onApplied} onClose={() => {}} {...props} />)
  return { onApplied }
}

describe('TraitementPopover — rattacher/mettre à jour', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('crée un nouveau traitement (POST) quand rien n\'est sélectionné', async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { onApplied } = setup()
    fireEvent.click(screen.getByText('Créer'))
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith('plan_action'))
    const post = (fetchMock as unknown as { mock: { calls: [string, { method?: string; body?: string }][] } }).mock.calls
      .find(c => c[0] === '/api/organizations/o1/conformite/traitements' && c[1]?.method === 'POST')
    expect(post).toBeTruthy()
    expect(JSON.parse(post![1].body!).refs).toEqual(['A.5.1'])
  })

  it('sélectionner un traitement existant → PATCH conformité + addRef (libellé verrouillé)', async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { onApplied } = setup()
    fireEvent.focus(screen.getByLabelText('Intitulé'))
    fireEvent.mouseDown(screen.getByText('Chiffrer les sauvegardes'))
    const titre = screen.getByLabelText('Intitulé') as HTMLInputElement
    expect(titre.readOnly).toBe(true)
    expect(screen.getByText('Mettre à jour')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Mettre à jour'))
    await waitFor(() => expect(onApplied).toHaveBeenCalled())
    const patch = (fetchMock as unknown as { mock: { calls: [string, { method?: string; body?: string }][] } }).mock.calls
      .find(c => c[0] === '/api/organizations/o1/conformite/traitements/t1' && c[1]?.method === 'PATCH')
    expect(patch).toBeTruthy()
    expect(JSON.parse(patch![1].body!).addRef).toBe('A.5.1')
  })

  it('rattache une ACTION réelle existante → PATCH plans-actions addLien CONFORMITE', async () => {
    const fetchMock = mockFetch([{ id: 'p9', titre: 'Revue des accès', porteur: 'RSSI', statut: 'EN_COURS', liens: [] }])
    vi.stubGlobal('fetch', fetchMock)
    const { onApplied } = setup()
    fireEvent.focus(screen.getByLabelText('Intitulé'))
    await screen.findByText('Revue des accès') // action chargée au montage
    fireEvent.mouseDown(screen.getByText('Revue des accès'))
    expect(screen.getByText('Rattacher')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Rattacher'))
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith('plan_action'))
    const patch = (fetchMock as unknown as { mock: { calls: [string, { method?: string; body?: string }][] } }).mock.calls
      .find(c => c[0] === '/api/organizations/o1/plans-actions/p9' && c[1]?.method === 'PATCH')
    expect(patch).toBeTruthy()
    const lien = JSON.parse(patch![1].body!).addLien
    expect(lien).toEqual({ type: 'CONFORMITE', targetId: 'ISO27001', ref: 'A.5.1', label: 'Politique' })
  })
})
