/**
 * SocleToggle.test.tsx
 *
 * Tests du composant SocleToggle :
 *  - Rendu selon l'état isSocle
 *  - Affichage du nombre d'héritiers
 *  - Appel PATCH + refresh après clic
 *  - Désactivation du bouton pendant le chargement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SocleToggle from '@/components/SocleToggle'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupFetch(ok = true) {
  global.fetch = vi.fn().mockResolvedValue({ ok } as Response)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SocleToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupFetch()
  })

  // ─── Rendu ────────────────────────────────────────────────────────────────

  it('affiche "Activer" quand isSocle=false', () => {
    render(<SocleToggle analyseId="a1" isSocle={false} />)
    expect(screen.getByRole('button')).toHaveTextContent('Activer')
    expect(screen.getByText(/Marquer comme analyse socle/i)).toBeInTheDocument()
  })

  it('affiche "Désactiver" quand isSocle=true', () => {
    render(<SocleToggle analyseId="a1" isSocle={true} />)
    expect(screen.getByRole('button')).toHaveTextContent('Désactiver')
    expect(screen.getByText(/Analyse socle active/i)).toBeInTheDocument()
  })

  it('affiche le nombre d\'héritiers quand isSocle=true et heritiersCount>0', () => {
    render(<SocleToggle analyseId="a1" isSocle={true} heritiersCount={3} />)
    expect(screen.getByText(/par 3 analyse\(s\) héritière\(s\)/i)).toBeInTheDocument()
  })

  it('ne mentionne pas les héritiers quand heritiersCount=0', () => {
    render(<SocleToggle analyseId="a1" isSocle={true} heritiersCount={0} />)
    expect(screen.queryByText(/héritière/i)).not.toBeInTheDocument()
  })

  // ─── Interaction ──────────────────────────────────────────────────────────

  it('appelle PATCH /api/analyses/a1 avec { isSocle: true } quand on active', async () => {
    render(<SocleToggle analyseId="a1" isSocle={false} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/analyses/a1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSocle: true }),
      })
    })
  })

  it('appelle PATCH avec { isSocle: false } quand on désactive', async () => {
    render(<SocleToggle analyseId="a1" isSocle={true} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/analyses/a1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSocle: false }),
      })
    })
  })

  it('appelle router.refresh() après le toggle', async () => {
    render(<SocleToggle analyseId="a1" isSocle={false} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledOnce()
    })
  })

  it('désactive le bouton pendant le chargement', async () => {
    // fetch qui ne se résout pas tout de suite
    let resolve!: (v: unknown) => void
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(r => { resolve = r })
    )

    render(<SocleToggle analyseId="a1" isSocle={false} />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)

    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('…')

    // Résoudre la promesse
    resolve({ ok: true })
    await waitFor(() => expect(btn).not.toBeDisabled())
  })
})
