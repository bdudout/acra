import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import RiskMatrix from '@/components/RiskMatrix'
import { buildDefaultConfig } from '@/lib/configuration-defaults'
import type { ScaleConfig } from '@/lib/risk-scale'

describe('RiskMatrix — rendu piloté par la configuration', () => {
  it('rend une grille 4×4 par défaut (sans config)', () => {
    render(<RiskMatrix risks={[]} />)
    // "Critique" apparaît en en-tête de gravité ET dans la légende
    expect(screen.getAllByText('Critique').length).toBeGreaterThanOrEqual(2)
    // En-tête de gravité par défaut
    expect(within(screen.getByRole('grid')).getByText('Importante')).toBeInTheDocument()
  })

  it('rend une grille 5×5 quand nbNiveaux=5', () => {
    const config = buildDefaultConfig(5) as ScaleConfig
    render(<RiskMatrix risks={[]} config={config} />)
    // L'échelle 5 niveaux comporte le libellé "Catastrophique"
    expect(screen.getByText('Catastrophique')).toBeInTheDocument()
  })

  it('positionne un risque dans la bonne cellule (aria-label)', () => {
    render(
      <RiskMatrix
        risks={[{ nom: 'Rançongiciel', vraisemblance: 4, gravite: 4 }]}
      />
    )
    expect(screen.getByText('Rançongiciel')).toBeInTheDocument()
    // La cellule gravité max / vraisemblance max doit être de niveau Critique
    expect(
      screen.getByLabelText(/Gravité Critique \(Critique\) — 1 risque/)
    ).toBeInTheDocument()
  })

  it('numérote les risques (R1 = plus critique) et liste les libellés sous la matrice', () => {
    render(
      <RiskMatrix
        risks={[
          { nom: 'Phishing', vraisemblance: 1, gravite: 1 },
          { nom: 'Rançongiciel', vraisemblance: 4, gravite: 4 },
        ]}
      />
    )
    // Une pastille R1 et R2 sont rendues (cellule + légende)
    expect(screen.getAllByText('R1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('R2').length).toBeGreaterThanOrEqual(1)
    // La liste des libellés existe et contient les noms complets
    const list = screen.getByLabelText('Libellés des risques')
    expect(within(list).getByText('Rançongiciel')).toBeInTheDocument()
    expect(within(list).getByText('Phishing')).toBeInTheDocument()
  })

  it('respecte des libellés d\'échelle personnalisés', () => {
    const config: ScaleConfig = {
      nbNiveaux: 4,
      echelleGravite: [
        { niveau: 1, label: 'G-Un', couleur: '#22c55e' },
        { niveau: 2, label: 'G-Deux', couleur: '#f59e0b' },
        { niveau: 3, label: 'G-Trois', couleur: '#f97316' },
        { niveau: 4, label: 'G-Quatre', couleur: '#ef4444' },
      ],
      echelleVraisemblance: [
        { niveau: 1, label: 'V-Un', couleur: '#22c55e' },
        { niveau: 2, label: 'V-Deux', couleur: '#f59e0b' },
        { niveau: 3, label: 'V-Trois', couleur: '#f97316' },
        { niveau: 4, label: 'V-Quatre', couleur: '#ef4444' },
      ],
      seuilsMatrice: buildDefaultConfig(4).seuilsMatrice,
    }
    render(<RiskMatrix risks={[]} config={config} />)
    expect(screen.getByText('G-Quatre')).toBeInTheDocument()
    expect(screen.getByText('V-Un')).toBeInTheDocument()
  })
})
