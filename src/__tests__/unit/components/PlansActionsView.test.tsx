import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import PlansActionsView, { type SerializedActionItem } from '@/components/PlansActionsView'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    locale: 'fr',
    t: {
      table: { sortAsc: 'A→Z', sortDesc: 'Z→A', sortNone: 'Sans tri', filterTitle: 'Filtrer', search: 'Rechercher', selectAll: 'Tout', selectNone: 'Aucun', onlyThis: 'Uniquement', clear: 'Effacer', menu: 'Trier et filtrer' },
      plansActions: {
        title: 'Plans d\'action', subtitle: 'sous-titre',
        kpiTotal: 'Actions', kpiRetard: 'En retard', kpiAvancement: 'Avancement',
        filterSource: 'Source', filterOrigine: 'Origine', filterPriorite: 'Priorité', filterStatut: 'Statut', filterPorteur: 'Porteur',
        filterAll: 'Toutes', searchPh: 'Rechercher', clear: 'Effacer',
        resultCount: '{n}/{total}', empty: 'Aucune action.',
        colTitre: 'Action', colSource: 'Source', colOrigine: 'Origine', colPorteur: 'Porteur', colPriorite: 'Priorité',
        colStatut: 'Statut', colEcheance: 'Échéance', open: 'Ouvrir', sansEcheance: '—', sansPorteur: 'Non attribué',
        sources: { MESURE: 'Mesure', RISK_ACTION: 'Registre', CONFORMITE: 'Conformité', AUDIT: 'Audit', CONTROLE: 'Contrôle', INCIDENT: 'Incident' },
        origines: { risque: 'Risque', conformite: 'Conformité', controle: 'Contrôle', audit: 'Audit', regulateur: 'Régulateur', incident: 'Incident', orpheline: 'Orpheline' },
        orphanAlert: '{n} orpheline(s)', save: 'Enregistrer',
        priorites: { CRITIQUE: 'Critique', MAJEUR: 'Majeur', MODERE: 'Modéré' },
        statuts: { A_FAIRE: 'À faire', EN_COURS: 'En cours', FAIT: 'Fait', EN_RETARD: 'En retard' },
      },
    },
  }),
}))

const mk = (p: Partial<SerializedActionItem>): SerializedActionItem => ({
  id: p.id ?? 'x', source: p.source ?? 'MESURE', origine: p.origine ?? 'risque', sourceId: p.sourceId ?? 'x',
  titre: p.titre ?? 't', description: p.description ?? null, porteur: p.porteur ?? null,
  entite: p.entite ?? null, echeance: p.echeance ?? null, statut: p.statut ?? 'A_FAIRE',
  priorite: p.priorite ?? 'MAJEUR', lien: p.lien ?? '/x', riskItemId: p.riskItemId ?? null,
})

const items: SerializedActionItem[] = [
  mk({ id: '1', source: 'MESURE', origine: 'risque', titre: 'Chiffrer les sauvegardes', priorite: 'CRITIQUE', statut: 'A_FAIRE', porteur: 'DSI' }),
  mk({ id: '2', source: 'AUDIT', origine: 'audit', titre: 'Revue trimestrielle', priorite: 'MODERE', statut: 'FAIT', porteur: 'Audit' }),
  mk({ id: '3', source: 'INCIDENT', origine: 'incident', titre: 'Fuite de données', priorite: 'MAJEUR', statut: 'A_FAIRE', porteur: 'RSSI', echeance: '2020-01-01T00:00:00.000Z' }),
]

describe('PlansActionsView', () => {
  it('affiche toutes les actions et les KPI (total/retard/avancement)', () => {
    render(<PlansActionsView items={items} />)
    expect(screen.getAllByText('Chiffrer les sauvegardes')).toHaveLength(2)
    expect(screen.getAllByText('Revue trimestrielle')).toHaveLength(2)
    expect(screen.getAllByText('Fuite de données')).toHaveLength(2)
    // 1 fait / 3 → 33 % ; 1 en retard (échéance 2020 + non fait)
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  it('propose des cartes dédiées aux petits écrans', () => {
    render(<PlansActionsView items={items} />)
    expect(screen.getByTestId('actions-mobile-list')).toHaveClass('md:hidden')
    expect(screen.getByTestId('actions-desktop-table')).toHaveClass('hidden')
  })

  it('filtre par origine (typologie)', () => {
    render(<PlansActionsView items={items} />)
    fireEvent.change(screen.getByLabelText('Origine'), { target: { value: 'risque' } })
    expect(screen.getAllByText('Chiffrer les sauvegardes')).toHaveLength(2)
    expect(screen.queryAllByText('Revue trimestrielle')).toHaveLength(0)
  })

  it('filtre par statut effectif EN_RETARD', () => {
    render(<PlansActionsView items={items} />)
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'EN_RETARD' } })
    expect(screen.getAllByText('Fuite de données')).toHaveLength(2)
    expect(screen.queryAllByText('Chiffrer les sauvegardes')).toHaveLength(0)
  })

  it('recherche texte sur le titre', () => {
    render(<PlansActionsView items={items} />)
    fireEvent.change(screen.getByPlaceholderText('Rechercher'), { target: { value: 'revue' } })
    expect(screen.getAllByText('Revue trimestrielle')).toHaveLength(2)
    expect(screen.queryAllByText('Chiffrer les sauvegardes')).toHaveLength(0)
  })

  it('affiche un message quand aucune action ne correspond', () => {
    render(<PlansActionsView items={items} />)
    fireEvent.change(screen.getByLabelText('Porteur'), { target: { value: 'inexistant' } })
    expect(screen.getAllByText('Aucune action.')).toHaveLength(2)
  })

  it('trie les retards en tête', () => {
    render(<PlansActionsView items={items} />)
    const rows = screen.getAllByRole('row').slice(1) // hors en-tête
    expect(within(rows[0]).getByText('Fuite de données')).toBeInTheDocument()
  })

  it('tri par colonne au clic sur l\'en-tête (porteur, asc)', () => {
    render(<PlansActionsView items={items} />)
    // Porteurs : DSI / Audit / RSSI → asc alpha = Audit en tête
    fireEvent.click(screen.getByRole('button', { name: /Porteur/ }))
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Revue trimestrielle')).toBeInTheDocument() // porteur Audit
  })

  it('filtre par colonne façon tableur : décocher une valeur retire les lignes', () => {
    render(<PlansActionsView items={items} />)
    // Ouvre le menu de la colonne Origine (2ᵉ colonne)
    fireEvent.click(screen.getAllByRole('button', { name: 'Trier et filtrer' })[1])
    // Valeurs distinctes triées : Audit(0), Incident(1), Risque(2) → décocher Risque
    const checks = screen.getAllByRole('checkbox')
    fireEvent.click(checks[2])
    expect(screen.queryAllByText('Chiffrer les sauvegardes')).toHaveLength(0) // origine Risque
    expect(screen.getAllByText('Revue trimestrielle')).toHaveLength(2) // origine Audit
  })

  it('action orpheline : alerte + édition en place (PATCH plans-actions)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const orphan = { ...mk({ id: 'PLAN_ACTION:p7', sourceId: 'p7', source: 'PLAN_ACTION', origine: 'orpheline', titre: 'Action isolée' }), lien: null }
    render(<PlansActionsView items={[orphan]} orgId="o1" />)
    // Bandeau d'alerte présent
    expect(screen.getByText('1 orpheline(s)')).toBeInTheDocument()
    // Ouvre l'éditeur en place, modifie le titre, enregistre
    fireEvent.click(within(screen.getByTestId('actions-desktop-table')).getByRole('button', { name: /Modifier|Ouvrir|Edit/ }))
    const titre = within(screen.getByTestId('actions-desktop-table')).getByDisplayValue('Action isolée')
    fireEvent.change(titre, { target: { value: 'Action corrigée' } })
    fireEvent.click(within(screen.getByTestId('actions-desktop-table')).getByText('Enregistrer'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/organizations/o1/plans-actions/p7')
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body).titre).toBe('Action corrigée')
  })
})
