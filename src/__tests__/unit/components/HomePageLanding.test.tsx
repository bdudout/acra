/**
 * HomePageLanding.test.tsx — page de présentation publique (landing).
 *
 * Défaut corrigé : la FAQ et les libellés de statistiques étaient codés EN DUR en
 * français dans le composant → un visiteur EN/DE/ES/IT voyait une FAQ française sur
 * une page par ailleurs traduite (violation de la règle i18n absolue du projet).
 * Ce test verrouille le fait que ces contenus proviennent bien de l'i18n.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'
import { fr } from '@/lib/i18n'

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ demo: false }) } as Response),
  ) as unknown as typeof fetch
})

describe('Landing — FAQ et stats internationalisées', () => {
  it('rend la FAQ depuis l’i18n (titre + toutes les questions)', () => {
    render(<HomePage />)
    expect(screen.getByText(fr.landing.faq.title)).toBeInTheDocument()
    for (const item of fr.landing.faq.items) {
      expect(screen.getByText(item.q)).toBeInTheDocument()
    }
  })

  it('rend les libellés de statistiques depuis l’i18n', () => {
    render(<HomePage />)
    for (const label of fr.landing.statLabels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})
