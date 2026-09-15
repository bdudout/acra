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
        },
      },
    },
  }),
}))

const existing: ExistingTraitement[] = [
  { id: 't1', type: 'PLAN_ACTION', intitule: 'Chiffrer les sauvegardes', refs: ['A.8.1', 'A.8.2'], responsable: 'DSI', echeance: '2026-06-01T00:00:00.000Z', description: 'Plan existant' },
  { id: 't2', type: 'DEROGATION', intitule: 'Dérogation VPN', refs: ['A.9.1'], responsable: 'RSSI' },
]

function setup(props: Partial<React.ComponentProps<typeof TraitementPopover>> = {}) {
  const onApplied = vi.fn()
  render(<TraitementPopover
    orgId="o1" referentiel="ISO27001" entite="" controlRef="A.5.1" controlNom="Politique"
    type="PLAN_ACTION" existing={existing} onApplied={onApplied} onClose={() => {}} {...props} />)
  return { onApplied }
}

describe('TraitementPopover — rattacher/mettre à jour', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('crée un nouveau traitement (POST) quand aucun existant n\'est sélectionné', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const { onApplied } = setup()
    expect(screen.getByText('Créer')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Créer'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/organizations/o1/conformite/traitements')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body).refs).toEqual(['A.5.1'])
    expect(onApplied).toHaveBeenCalledWith('plan_action')
  })

  it('ne propose en autocomplétion que les traitements du même type', () => {
    setup()
    fireEvent.focus(screen.getByLabelText('Intitulé'))
    expect(screen.getByText('Chiffrer les sauvegardes')).toBeInTheDocument() // PLAN_ACTION
    expect(screen.queryByText('Dérogation VPN')).not.toBeInTheDocument()     // autre type
  })

  it('sélectionner un existant préremplit, verrouille le libellé et bascule en « Mettre à jour » (PATCH + addRef)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const { onApplied } = setup()
    fireEvent.focus(screen.getByLabelText('Intitulé'))
    fireEvent.mouseDown(screen.getByText('Chiffrer les sauvegardes'))

    const titre = screen.getByLabelText('Intitulé') as HTMLInputElement
    expect(titre.value).toBe('Chiffrer les sauvegardes')
    expect(titre.readOnly).toBe(true)
    expect((screen.getByDisplayValue('DSI'))).toBeInTheDocument() // responsable prérempli
    expect(screen.getByText('Mettre à jour')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Mettre à jour'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/organizations/o1/conformite/traitements/t1')
    expect(opts.method).toBe('PATCH')
    const body = JSON.parse(opts.body)
    expect(body.addRef).toBe('A.5.1')
    expect(body.intitule).toBeUndefined() // libellé jamais modifié
    expect(onApplied).toHaveBeenCalledWith('plan_action')
  })

  it('« Nouveau » ré-ouvre la création après une sélection', () => {
    setup()
    fireEvent.focus(screen.getByLabelText('Intitulé'))
    fireEvent.mouseDown(screen.getByText('Chiffrer les sauvegardes'))
    expect(screen.getByText('Mettre à jour')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Nouveau'))
    expect(screen.getByText('Créer')).toBeInTheDocument()
    const titre = screen.getByLabelText('Intitulé') as HTMLInputElement
    expect(titre.readOnly).toBe(false)
  })
})
