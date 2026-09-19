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
import { fr, getT, type Locale } from '@/lib/i18n'

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

let locale: Locale = 'fr'
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ locale, setLocale: vi.fn(), t: getT(locale) }),
}))

beforeEach(() => {
  locale = 'fr'
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ demo: false }) } as Response),
  ) as unknown as typeof fetch
})

describe('Landing — FAQ et stats internationalisées', () => {
  it('utilise la palette claire de l’application par défaut', () => {
    render(<HomePage />)
    expect(screen.getByTestId('landing-shell')).toHaveClass('bg-slate-50')
    expect(screen.getByTestId('landing-shell')).toHaveClass('text-slate-900')
  })

  it('réserve le drapeau français à la référence française et localise la méthode', () => {
    const { unmount } = render(<HomePage />)
    expect(screen.getByTestId('fr-method-flag')).toBeInTheDocument()
    expect(screen.getByTestId('method-badge')).toHaveTextContent('EBIOS Risk Manager')
    unmount()

    locale = 'en'
    render(<HomePage />)
    expect(screen.queryByTestId('fr-method-flag')).not.toBeInTheDocument()
    expect(screen.getByTestId('method-badge')).toHaveTextContent('ISO/IEC 27001')
  })

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

  it('rend la bande de chiffres réels avec leurs sources (pas de faux témoignages)', () => {
    render(<HomePage />)
    expect(screen.getByText(fr.landing.facts.title)).toBeInTheDocument()
    for (const fact of fr.landing.facts.items) {
      expect(screen.getByText(fact.value)).toBeInTheDocument()
      expect(screen.getByText(fact.label)).toBeInTheDocument()
    }
    // La note de sources doit être visible.
    expect(screen.getByText(fr.landing.facts.note)).toBeInTheDocument()
  })

  it('présente les exemples comme des scénarios illustratifs, pas des témoignages', () => {
    render(<HomePage />)
    // Le tag « Scénario illustratif » doit apparaître (une fois par exemple).
    expect(screen.getAllByText(fr.landing.examplesScenarioTag).length).toBe(fr.landing.examples.length)
  })

  it('affiche la 6e carte « évolutif vers le GRC »', () => {
    render(<HomePage />)
    expect(screen.getByText(fr.landing.features.grc.title)).toBeInTheDocument()
  })
})
