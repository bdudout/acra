import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NouvelleAnalyseMenu from '@/components/NouvelleAnalyseMenu'

const labels = { trigger: 'Nouvelle analyse', analyse: 'Nouvelle analyse', projet360: 'Nouveau projet 360', importer: 'Importer une analyse' }

describe('NouvelleAnalyseMenu', () => {
  it('un seul bouton « Nouvelle analyse » ; le menu propose analyse, projet 360 et import', () => {
    render(<NouvelleAnalyseMenu labels={labels} projet360 />)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle analyse/ }))
    const items = screen.getAllByRole('menuitem')
    expect(items.map(i => i.textContent)).toEqual(['Nouvelle analyse', 'Nouveau projet 360', 'Importer une analyse'])
    expect(items.map(i => i.getAttribute('href'))).toEqual(['/analyses/new', '/analyses/new?methode=PROJET_360', '/analyses?import=1'])
  })
  it('sans module Projets 360 actif : l’entrée projet est absente', () => {
    render(<NouvelleAnalyseMenu labels={labels} projet360={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle analyse/ }))
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Nouvelle analyse', 'Importer une analyse'])
  })
  it('Échap ferme le menu ; aria-expanded reflète l’état', () => {
    render(<NouvelleAnalyseMenu labels={labels} projet360 />)
    const b = screen.getByRole('button', { name: /Nouvelle analyse/ })
    expect(b.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(b)
    expect(b.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
