/**
 * TiersClient.test.tsx — liste agrégée des tiers (écosystème).
 *  - Rendu des tiers de plusieurs analyses
 *  - Recherche (nom / type / analyse)
 *  - Filtre par zone
 *  - État vide
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import TiersClient, { type TiersRow } from '@/components/TiersClient'

const rows: TiersRow[] = [
  { id: '1', analyseId: 'a1', analyseNom: 'Analyse Alpha', analyseOrg: 'OrgA', nom: 'Infogéreur', type: 'PRESTATAIRE', description: null, exposition: 4, fiabilite: 1, menace: 16, zone: 'danger' },
  { id: '2', analyseId: 'a2', analyseNom: 'Analyse Beta', analyseOrg: null, nom: 'Client Final', type: 'CLIENT', description: null, exposition: 2, fiabilite: 3, menace: 4, zone: 'veille' },
]

describe('TiersClient', () => {
  it('liste les tiers de toutes les analyses', () => {
    render(<TiersClient tiers={rows} />)
    expect(screen.getByText('Infogéreur')).toBeInTheDocument()
    expect(screen.getByText('Client Final')).toBeInTheDocument()
    expect(screen.getByText('Analyse Alpha')).toBeInTheDocument()
  })

  it('filtre par recherche (nom)', () => {
    render(<TiersClient tiers={rows} />)
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'client' } })
    expect(screen.getByText('Client Final')).toBeInTheDocument()
    expect(screen.queryByText('Infogéreur')).not.toBeInTheDocument()
  })

  it('filtre par zone (Danger)', () => {
    render(<TiersClient tiers={rows} />)
    fireEvent.click(screen.getByRole('button', { name: /Danger/i }))
    expect(screen.getByText('Infogéreur')).toBeInTheDocument()
    expect(screen.queryByText('Client Final')).not.toBeInTheDocument()
  })

  it('affiche un état vide sans correspondance', () => {
    render(<TiersClient tiers={rows} />)
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'zzz-introuvable' } })
    expect(screen.queryByText('Infogéreur')).not.toBeInTheDocument()
    expect(screen.queryByText('Client Final')).not.toBeInTheDocument()
  })

  it('rend chaque tiers avec un lien vers son atelier 3', () => {
    render(<TiersClient tiers={rows} />)
    const link = within(screen.getByText('Infogéreur').closest('tr')!).getByRole('link')
    expect(link).toHaveAttribute('href', '/analyses/a1/atelier/3')
  })
})
