// Signalement des erreurs serveur des appels d'API : bandeau sur une réponse 5xx d'une API d'ACRA (même origine),
// issue GitHub pré-remplie (méthode + chemin anonymisés, version installée) ; rien pour une 4xx ou un autre site.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SignalementErreursApi from '@/components/SignalementErreursApi'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const reponses: Record<string, number> = {}
const original = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url === '/api/health') return { ok: true, status: 200, json: async () => ({ version: 'v1.0.5', revision: 'abc1234', issuesRepo: 'bdudout/acra' }) } as Response
  return { ok: false, status: reponses[url] ?? 200, json: async () => ({}) } as Response
})
beforeEach(() => { original.mockClear(); vi.stubGlobal('fetch', original) })
afterEach(() => vi.unstubAllGlobals())

describe('SignalementErreursApi', () => {
  it('réponse 5xx d’une API d’ACRA : bandeau avec lien vers une issue pré-remplie ; fermeture', async () => {
    reponses['/api/plans/cmuz72j4n0004c5te5ep9644d/lignes?annee=2027'] = 500
    render(<SignalementErreursApi />)
    await act(async () => { await window.fetch('/api/plans/cmuz72j4n0004c5te5ep9644d/lignes?annee=2027', { method: 'POST' }) })
    const lien = await screen.findByRole('link', { name: 'Signaler le problème sur GitHub' })
    const url = new URL(lien.getAttribute('href')!)
    expect(url.searchParams.get('title')).toBe('[Erreur 500] POST /api/plans/:id/lignes')
    expect(url.searchParams.get('body')).toContain('| Version | v1.0.5 |')
    expect(screen.getByRole('status')).toHaveTextContent('Une erreur serveur est survenue (500).')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('erreur 4xx, réponse correcte ou autre site : aucun bandeau', async () => {
    reponses['/api/plans'] = 400
    reponses['https://autre.example/api/x'] = 500
    render(<SignalementErreursApi />)
    await act(async () => {
      await window.fetch('/api/plans', { method: 'POST' })
      await window.fetch('/api/ok')
      await window.fetch('https://autre.example/api/x')
    })
    await waitFor(() => expect(original).toHaveBeenCalledTimes(3))
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('démontage : le fetch d’origine est rétabli', () => {
    const { unmount } = render(<SignalementErreursApi />)
    expect(window.fetch).not.toBe(original)
    unmount()
    expect(window.fetch).toBe(original)
  })
})
