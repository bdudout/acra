/**
 * RegisterPage.test.tsx — page publique d'inscription (chemin de la démo publique).
 *
 * Régression UX ciblée : tant que l'état « inscription ouverte ? » n'est pas connu
 * (fetch en cours), la page NE DOIT PAS afficher le formulaire complet — sinon un
 * visiteur d'une instance où l'inscription est fermée voit le formulaire, commence
 * à le remplir, puis le voit disparaître (flash déroutant). On attend un état de
 * chargement neutre, puis soit le formulaire, soit le message « fermé ».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RegisterPage from '@/app/auth/register/page'

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

/** Fabrique une réponse fetch minimale (ok + json). */
function jsonResponse(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response)
}

/** Installe un mock de fetch routé par URL ; `openValue` pilote registration-open. */
function mockFetch(openValue: boolean | 'pending') {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/auth/registration-open')) {
      return openValue === 'pending'
        ? new Promise<Response>(() => {}) // ne se résout jamais → état de chargement
        : jsonResponse({ open: openValue })
    }
    if (url.includes('/api/demo/status')) return jsonResponse({ demo: false })
    if (url.includes('/api/auth/password-policy')) return jsonResponse(null)
    return jsonResponse({})
  }) as unknown as typeof fetch
}

const submitButton = () => screen.queryByRole('button', { name: /Créer mon compte/i })

describe('RegisterPage — chemin public', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche un état de chargement (pas le formulaire) tant que le statut d’inscription est inconnu', () => {
    mockFetch('pending')
    render(<RegisterPage />)
    // Aucun formulaire ne doit clignoter avant de connaître l’état.
    expect(submitButton()).not.toBeInTheDocument()
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })

  it('affiche le formulaire quand l’inscription est ouverte', async () => {
    mockFetch(true)
    render(<RegisterPage />)
    expect(await screen.findByRole('button', { name: /Créer mon compte/i })).toBeInTheDocument()
  })

  it('affiche le message « fermé » et aucun formulaire quand l’inscription est fermée', async () => {
    mockFetch(false)
    render(<RegisterPage />)
    expect(await screen.findByText(/inscription n’est pas ouverte|inscription n'est pas ouverte/i)).toBeInTheDocument()
    expect(submitButton()).not.toBeInTheDocument()
  })
})
