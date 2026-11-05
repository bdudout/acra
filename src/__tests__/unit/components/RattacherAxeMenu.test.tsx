// Lot S2 : menu « Rattacher à un axe » (/actions) — clavier, focus, fermeture, message de succès.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RattacherAxeMenu, { type AxeDisponibleVue } from '@/components/RattacherAxeMenu'

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: {
      plansActions: { rattacher: { bouton: 'Rattacher à un axe', menu: 'Axes', validee: 'validée', ok: 'Rattachée à « {axe} ».', erreur: 'Échec.', deja: 'Déjà.' } },
      strategie: { ui: { annuler: 'Annuler', justification: { titre: 'Justification', aide: 'Aide', champ: 'Motif', confirmer: 'Confirmer' } } },
    },
  }),
}))

const AXES: AxeDisponibleVue[] = [
  { strategieId: 's1', strategieTitre: 'Cyber', strategieStatut: 'BROUILLON', axeId: 'a1', axeTitre: 'Identifier' },
  { strategieId: 's1', strategieTitre: 'Cyber', strategieStatut: 'BROUILLON', axeId: 'a2', axeTitre: 'Protéger' },
  { strategieId: 's1', strategieTitre: 'Cyber', strategieStatut: 'BROUILLON', axeId: 'a3', axeTitre: 'Détecter' },
]
const bouton = () => screen.getByRole('button', { name: 'Rattacher à un axe' })
const items = () => screen.getAllByRole('menuitem')

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
})

describe('RattacherAxeMenu', () => {
  it('ouverture : focus sur le premier élément ; Bas, Haut, Début, Fin déplacent le focus', () => {
    render(<RattacherAxeMenu action={{ source: 'MESURE', sourceId: 'm1' }} axes={AXES} onRattache={() => {}} />)
    fireEvent.click(bouton())
    expect(items()[0]).toHaveFocus()
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(items()[1]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(items()[2]).toHaveFocus() // bouclage
    fireEvent.keyDown(menu, { key: 'Home' })
    expect(items()[0]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'End' })
    expect(items()[2]).toHaveFocus()
  })

  it('Échap ferme et rend le focus au bouton', () => {
    render(<RattacherAxeMenu action={{ source: 'MESURE', sourceId: 'm1' }} axes={AXES} onRattache={() => {}} />)
    fireEvent.click(bouton())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(bouton()).toHaveFocus()
  })

  it('clic à l’extérieur : fermeture', () => {
    render(<div><p>dehors</p><RattacherAxeMenu action={{ source: 'MESURE', sourceId: 'm1' }} axes={AXES} onRattache={() => {}} /></div>)
    fireEvent.click(bouton())
    fireEvent.mouseDown(screen.getByText('dehors'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('menu en position fixe sous le bouton (non rogné par le tableau défilant), aligné à droite, borné à la fenêtre', () => {
    render(<RattacherAxeMenu action={{ source: 'MESURE', sourceId: 'm1' }} axes={AXES} onRattache={() => {}} />)
    vi.spyOn(bouton(), 'getBoundingClientRect').mockReturnValue({ bottom: 500, right: 900 } as DOMRect)
    fireEvent.click(bouton())
    const menu = screen.getByRole('menu')
    expect(menu).toHaveClass('fixed', 'max-w-[min(24rem,90vw)]')
    expect(menu.style.top).toBe('504px')
    expect(menu.style.right).toBe(`${Math.max(8, window.innerWidth - 900)}px`)
    expect(items()[0]).toHaveClass('whitespace-normal')
  })

  it('défilement de la page : le menu se referme', () => {
    render(<RattacherAxeMenu action={{ source: 'MESURE', sourceId: 'm1' }} axes={AXES} onRattache={() => {}} />)
    fireEvent.click(bouton())
    fireEvent.scroll(window)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('après le dernier axe rattaché : le message de succès reste visible', async () => {
    const onRattache = vi.fn()
    const action = { source: 'MESURE' as const, sourceId: 'm1' }
    const { rerender } = render(<RattacherAxeMenu action={action} axes={[AXES[0]]} onRattache={onRattache} />)
    fireEvent.click(bouton())
    fireEvent.click(items()[0])
    await waitFor(() => expect(onRattache).toHaveBeenCalled())
    rerender(<RattacherAxeMenu action={{ ...action, axes: [AXES[0]] }} axes={[AXES[0]]} onRattache={onRattache} />)
    expect(screen.getByRole('status')).toHaveTextContent('Rattachée à « Identifier ».')
    expect(screen.queryByRole('button', { name: 'Rattacher à un axe' })).toBeNull()
  })
})
