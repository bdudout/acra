import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ImgHTMLAttributes, ReactNode } from 'react'

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: stableUser } }),
  signOut: vi.fn(),
}))
const stableUser = vi.hoisted(() => ({ id: 'u1', name: 'Auditeur', role: 'RISK_MANAGER' }))
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }))
vi.mock('next/image', () => ({ default: ({ priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => <img {...props} /> }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: {
      nav: new Proxy({}, { get: (_target, key) => String(key) }),
      roles: new Proxy({}, { get: (_target, key) => String(key) }),
    },
  }),
}))
vi.mock('@/components/BrandingProvider', () => ({ useBranding: () => ({ nom: 'ACRA', baseline: 'Cyber risk' }) }))
vi.mock('@/components/GlobalSearch', () => ({ default: () => <span>Recherche</span> }))
vi.mock('@/components/OrgSwitcher', () => ({ default: () => <span>Organisation</span> }))
vi.mock('@/lib/nav-modules-cache', () => ({
  peekNavModules: () => ({ registre: true, incidents: true, controles: true, audit: true, kri: true, reglementaire: true, profilsOperationnels: true }),
  loadNavModules: vi.fn(), setCachedNavModules: vi.fn(),
}))

import Navbar from '@/components/Navbar'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url === '/api/modules' ? {
      registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true,
      auditInterneActive: true, kriActive: true, reglementaireActive: true, campagnesRcsaActive: true, appetenceActive: true, rapportsGrcActive: true,
      profilsOperationnelsActive: true,
    } : { pending: 0 },
  })))
})

describe('Navbar mobile — groupes métier', () => {
  it('conserve les regroupements Pilotage et Registres sur mobile', async () => {
    await act(async () => { render(<Navbar />) })
    fireEvent.click(screen.getByRole('button', { name: 'mobileMenu' }))
    const mobile = document.getElementById('mobile-main-navigation')!
    const pilotage = within(mobile).getByRole('group', { name: 'grpPilotage' })
    expect(within(pilotage).getByRole('link', { name: /appetence/ })).toBeInTheDocument()
    expect(within(pilotage).getByRole('link', { name: /kri/ })).toBeInTheDocument()
    const registres = within(mobile).getByRole('group', { name: 'grpRegistre' })
    expect(within(registres).getByRole('link', { name: /registreTic/ })).toBeInTheDocument()
    expect(within(registres).getByRole('link', { name: /registre$/ })).toBeInTheDocument()
  })
})
