import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import PlansActionsView, { type SerializedActionItem } from '@/components/PlansActionsView'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    locale: 'fr',
    t: {
      plansActions: {
        title: 'Plans d\'action', subtitle: 'sous-titre',
        kpiTotal: 'Actions', kpiRetard: 'En retard', kpiAvancement: 'Avancement',
        filterSource: 'Source', filterPriorite: 'Priorité', filterStatut: 'Statut', filterPorteur: 'Porteur',
        filterAll: 'Toutes', searchPh: 'Rechercher', clear: 'Effacer',
        resultCount: '{n}/{total}', empty: 'Aucune action.',
        colTitre: 'Action', colSource: 'Source', colPorteur: 'Porteur', colPriorite: 'Priorité',
        colStatut: 'Statut', colEcheance: 'Échéance', open: 'Ouvrir', sansEcheance: '—', sansPorteur: 'Non attribué',
        sources: { MESURE: 'Mesure', RISK_ACTION: 'Registre', AUDIT: 'Audit', CONTROLE: 'Contrôle', INCIDENT: 'Incident' },
        priorites: { CRITIQUE: 'Critique', MAJEUR: 'Majeur', MODERE: 'Modéré' },
        statuts: { A_FAIRE: 'À faire', EN_COURS: 'En cours', FAIT: 'Fait', EN_RETARD: 'En retard' },
      },
    },
  }),
}))

const mk = (p: Partial<SerializedActionItem>): SerializedActionItem => ({
  id: p.id ?? 'x', source: p.source ?? 'MESURE', sourceId: p.sourceId ?? 'x',
  titre: p.titre ?? 't', description: p.description ?? null, porteur: p.porteur ?? null,
  entite: p.entite ?? null, echeance: p.echeance ?? null, statut: p.statut ?? 'A_FAIRE',
  priorite: p.priorite ?? 'MAJEUR', lien: p.lien ?? '/x', riskItemId: p.riskItemId ?? null,
})

const items: SerializedActionItem[] = [
  mk({ id: '1', source: 'MESURE', titre: 'Chiffrer les sauvegardes', priorite: 'CRITIQUE', statut: 'A_FAIRE', porteur: 'DSI' }),
  mk({ id: '2', source: 'AUDIT', titre: 'Revue trimestrielle', priorite: 'MODERE', statut: 'FAIT', porteur: 'Audit' }),
  mk({ id: '3', source: 'INCIDENT', titre: 'Fuite de données', priorite: 'MAJEUR', statut: 'A_FAIRE', porteur: 'RSSI', echeance: '2020-01-01T00:00:00.000Z' }),
]

describe('PlansActionsView', () => {
  it('affiche toutes les actions et les KPI (total/retard/avancement)', () => {
    render(<PlansActionsView items={items} />)
    expect(screen.getByText('Chiffrer les sauvegardes')).toBeInTheDocument()
    expect(screen.getByText('Revue trimestrielle')).toBeInTheDocument()
    expect(screen.getByText('Fuite de données')).toBeInTheDocument()
    // 1 fait / 3 → 33 % ; 1 en retard (échéance 2020 + non fait)
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  it('filtre par source', () => {
    render(<PlansActionsView items={items} />)
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'MESURE' } })
    expect(screen.getByText('Chiffrer les sauvegardes')).toBeInTheDocument()
    expect(screen.queryByText('Revue trimestrielle')).not.toBeInTheDocument()
  })

  it('filtre par statut effectif EN_RETARD', () => {
    render(<PlansActionsView items={items} />)
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'EN_RETARD' } })
    expect(screen.getByText('Fuite de données')).toBeInTheDocument()
    expect(screen.queryByText('Chiffrer les sauvegardes')).not.toBeInTheDocument()
  })

  it('recherche texte sur le titre', () => {
    render(<PlansActionsView items={items} />)
    fireEvent.change(screen.getByPlaceholderText('Rechercher'), { target: { value: 'revue' } })
    expect(screen.getByText('Revue trimestrielle')).toBeInTheDocument()
    expect(screen.queryByText('Chiffrer les sauvegardes')).not.toBeInTheDocument()
  })

  it('affiche un message quand aucune action ne correspond', () => {
    render(<PlansActionsView items={items} />)
    fireEvent.change(screen.getByLabelText('Porteur'), { target: { value: 'inexistant' } })
    expect(screen.getByText('Aucune action.')).toBeInTheDocument()
  })

  it('trie les retards en tête', () => {
    render(<PlansActionsView items={items} />)
    const rows = screen.getAllByRole('row').slice(1) // hors en-tête
    expect(within(rows[0]).getByText('Fuite de données')).toBeInTheDocument()
  })
})
