import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DemoBanner from '@/components/DemoBanner'
import { fr } from '@/lib/i18n'

vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ t: fr }) }))

describe('DemoBanner', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ demo: true, daysUntilPurge: 30 }) } as Response)) as unknown as typeof fetch
  })

  it('garde les informations et actions centrées, même sur petit écran', () => {
    render(<DemoBanner />)
    expect(screen.getByTestId('demo-banner')).toHaveClass('bg-gradient-to-r')
    expect(screen.getByTestId('demo-banner-content')).toHaveClass('justify-center')
    expect(screen.getByTestId('demo-banner-actions')).toHaveClass('justify-center')
  })
})
