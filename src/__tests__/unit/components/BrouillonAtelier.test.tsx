// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BrouillonAtelier from '@/components/BrouillonAtelier'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })
const garder = () => localStorage.setItem('acra:brouillon-atelier:an1:3', JSON.stringify({ data: { partiesPrenantes: [] }, revision: 4, date: '2026-10-16T10:00:00.000Z' }))

describe('BrouillonAtelier', () => {
  it('rien sans saisie non enregistrée', () => {
    const { container } = render(<BrouillonAtelier analyseId="an1" num={3} />)
    expect(container.textContent).toBe('')
  })
  it('signale la saisie gardée ; un renvoi en conflit est annoncé et la saisie conservée', async () => {
    garder()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"CONFLIT_EDITION"}', { status: 409 })))
    render(<BrouillonAtelier analyseId="an1" num={3} />)
    expect(screen.getByRole('alert').textContent).toContain("n'a pas été enregistrée")
    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer la saisie' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('modifié depuis par un autre utilisateur'))
    expect(localStorage.getItem('acra:brouillon-atelier:an1:3')).not.toBeNull()
  })
  it('ignorer après confirmation supprime la saisie', () => {
    garder()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<BrouillonAtelier analyseId="an1" num={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ignorer' }))
    expect(localStorage.getItem('acra:brouillon-atelier:an1:3')).toBeNull()
  })
})
