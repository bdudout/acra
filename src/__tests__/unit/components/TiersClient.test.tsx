/**
 * TiersClient.test.tsx — liste agrégée des tiers (écosystème).
 *  - Rendu des tiers de plusieurs analyses
 *  - Recherche (nom / type / analyse)
 *  - Filtre par zone
 *  - État vide
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import TiersClient from '@/components/TiersClient'
import type { ConsolidatedTier } from '@/lib/tiers'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const rows: ConsolidatedTier[] = [
  { key: 'infogereur', nom: 'Infogéreur', type: 'PRESTATAIRE', occurrences: 1, analyses: [{ analyseId: 'a1', analyseNom: 'Analyse Alpha', menace: 16, zone: 'danger' }], exposition: 4, fiabilite: 1, menace: 16, zone: 'danger', critique: false },
  { key: 'client final', nom: 'Client Final', type: 'CLIENT', occurrences: 1, analyses: [{ analyseId: 'a2', analyseNom: 'Analyse Beta', menace: 4, zone: 'veille' }], exposition: 2, fiabilite: 3, menace: 4, zone: 'veille', critique: false },
]

describe('TiersClient', () => {
  it('liste les tiers de toutes les analyses', () => {
    render(<TiersClient tiers={rows} />)
    expect(screen.getAllByText('Infogéreur')).toHaveLength(2)
    expect(screen.getAllByText('Client Final')).toHaveLength(2)
    expect(screen.getAllByText('Analyse Alpha')).toHaveLength(2)
  })

  it('propose des cartes dédiées aux petits écrans', () => {
    render(<TiersClient tiers={rows} />)
    expect(screen.getByTestId('tiers-mobile-list')).toHaveClass('sm:hidden')
    expect(screen.getByTestId('tiers-desktop-table')).toHaveClass('hidden')
  })

  it('filtre par recherche (nom)', () => {
    render(<TiersClient tiers={rows} />)
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'client' } })
    expect(screen.getAllByText('Client Final')).toHaveLength(2)
    expect(screen.queryAllByText('Infogéreur')).toHaveLength(0)
  })

  it('filtre par zone (Danger)', () => {
    render(<TiersClient tiers={rows} />)
    fireEvent.click(screen.getByRole('button', { name: /Danger/i }))
    expect(screen.getAllByText('Infogéreur')).toHaveLength(2)
    expect(screen.queryAllByText('Client Final')).toHaveLength(0)
  })

  it('affiche un état vide sans correspondance', () => {
    render(<TiersClient tiers={rows} />)
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'zzz-introuvable' } })
    expect(screen.queryAllByText('Infogéreur')).toHaveLength(0)
    expect(screen.queryAllByText('Client Final')).toHaveLength(0)
  })

  it('rend chaque tiers avec un lien vers son atelier 3', () => {
    render(<TiersClient tiers={rows} />)
    const link = within(screen.getByTestId('tiers-desktop-table')).getByRole('link', { name: /Analyse Alpha/ })
    expect(link).toHaveAttribute('href', '/analyses/a1/atelier/3')
  })

  // Fusion de doublons (étape 2b) : groupe « Microsoft » / « Microsoft Azure ».
  const dupRows: ConsolidatedTier[] = [
    { key: 'microsoft', nom: 'Microsoft', type: 'PRESTATAIRE', occurrences: 1, analyses: [{ analyseId: 'a1', analyseNom: 'A', menace: 4, zone: 'veille' }], exposition: 4, fiabilite: 9, menace: 4, zone: 'veille', critique: false },
    { key: 'microsoft azure', nom: 'Microsoft Azure', type: 'PRESTATAIRE', occurrences: 1, analyses: [{ analyseId: 'a2', analyseNom: 'B', menace: 4, zone: 'veille' }], exposition: 4, fiabilite: 9, menace: 4, zone: 'veille', critique: false },
  ]

  it('affiche le bouton Fusionner pour un groupe de doublons quand canMerge', () => {
    render(<TiersClient tiers={dupRows} canMerge />)
    expect(screen.getByRole('button', { name: 'Fusionner' })).toBeInTheDocument()
  })

  it('masque la fusion en lecture seule (canMerge=false)', () => {
    render(<TiersClient tiers={dupRows} canMerge={false} />)
    expect(screen.queryByRole('button', { name: 'Fusionner' })).not.toBeInTheDocument()
  })

  it('ouvre la confirmation avant de fusionner', () => {
    render(<TiersClient tiers={dupRows} canMerge />)
    fireEvent.click(screen.getByRole('button', { name: 'Fusionner' }))
    expect(screen.getByText('Fusionner ces tiers ?')).toBeInTheDocument()
  })
})
