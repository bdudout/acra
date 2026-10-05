import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NouvelleAnalyseMenu from '@/components/NouvelleAnalyseMenu'

const labels = { trigger: 'Nouvelle analyse', analyse: 'Nouvelle analyse', projet360: 'Nouveau projet 360', importer: 'Importer une analyse' }

describe('NouvelleAnalyseMenu', () => {
  it('un seul bouton « Nouvelle analyse » ; le menu propose analyse, projet 360 et import', () => {
    render(<NouvelleAnalyseMenu labels={labels} projet360 />)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle analyse/ }))
    const items = screen.getAllByRole('menuitem')
    expect(items.map(i => i.textContent)).toEqual(['Nouvelle analyse', 'Nouveau projet 360', 'Importer une analyse'])
    expect(items.map(i => i.getAttribute('href'))).toEqual(['/analyses/new', '/projets/nouveau', '/analyses?import=1'])
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

describe('NouvelleAnalyseMenu — clavier, lecteur d’écran, mobile', () => {
  const open = () => { render(<NouvelleAnalyseMenu labels={labels} projet360 />); return screen.getByRole('button', { name: /Nouvelle analyse/ }) }
  it('↓ sur le bouton ouvre le menu et place le focus sur le premier élément ; ↓/↑ circulent (avec retour), Début/Fin', () => {
    const trigger = open()
    trigger.focus(); fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document, { key: 'ArrowDown' }); expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(document, { key: 'ArrowDown' }); fireEvent.keyDown(document, { key: 'ArrowDown' }); expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document, { key: 'ArrowUp' }); expect(document.activeElement).toBe(items[2])
    fireEvent.keyDown(document, { key: 'Home' }); expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document, { key: 'End' }); expect(document.activeElement).toBe(items[2])
  })
  it('↑ sur le bouton ouvre le menu sur le dernier élément', () => {
    const trigger = open(); trigger.focus(); fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    const items = screen.getAllByRole('menuitem'); expect(document.activeElement).toBe(items[items.length - 1])
  })
  it('Échap ferme et rend le focus au bouton ; Tab ferme sans piéger le focus', () => {
    const trigger = open(); trigger.focus(); fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull(); expect(document.activeElement).toBe(trigger)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
  it('lecteur d’écran : le bouton annonce un menu (aria-haspopup, aria-controls) et le menu est nommé par le bouton', () => {
    const trigger = open(); fireEvent.click(trigger)
    const menu = screen.getByRole('menu')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id)
    expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(screen.getByRole('menu', { name: /Nouvelle analyse/ })).toBeTruthy()
  })
  it('visible sur mobile : aucune classe qui masque le bouton sous 640 px', () => {
    const trigger = open(); expect(trigger.closest('div')!.className).not.toMatch(/\bhidden\b/); expect(trigger.className).not.toMatch(/\bhidden\b/)
  })
  it('onImport : l’entrée d’import devient un bouton (page Analyses) qui ferme le menu', () => {
    const onImport = vi.fn()
    render(<NouvelleAnalyseMenu labels={labels} projet360 onImport={onImport} />)
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle analyse/ }))
    const item = screen.getByRole('menuitem', { name: 'Importer une analyse' })
    expect(item.tagName).toBe('BUTTON')
    fireEvent.click(item)
    expect(onImport).toHaveBeenCalledOnce(); expect(screen.queryByRole('menu')).toBeNull()
  })
})
