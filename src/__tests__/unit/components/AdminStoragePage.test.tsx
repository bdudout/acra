import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import AdminStoragePage from '@/app/admin/storage/page'

const auth = vi.hoisted(() => ({ role: 'SUPER_ADMIN' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { role: auth.role } }, status: 'authenticated' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/components/Navbar', () => ({ default: () => null }))
vi.mock('@/components/StorageUsagePanel', () => ({ default: () => <div>Mesures de stockage</div> }))
vi.mock('@/components/BackupManagementPanel', () => ({ default: () => <div>Gestion des sauvegardes</div> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

beforeEach(() => {
  auth.role = 'SUPER_ADMIN'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ demo: false }) }))
})

describe('administration — stockage et sauvegardes', () => {
  it('a son propre onglet actif et les deux sections pour le super-admin', () => {
    render(<AdminStoragePage />)
    expect(screen.getByRole('link', { name: /Stockage et sauvegardes/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Mesures de stockage')).toBeInTheDocument()
    expect(screen.getByText('Gestion des sauvegardes')).toBeInTheDocument()
  })

  it('montre les mesures à un admin d’organisation sans lui exposer la gestion des sauvegardes', () => {
    auth.role = 'ADMIN'
    render(<AdminStoragePage />)
    expect(screen.getByText('Mesures de stockage')).toBeInTheDocument()
    expect(screen.queryByText('Gestion des sauvegardes')).not.toBeInTheDocument()
  })

  it('ne conserve pas les panneaux de stockage sur le tableau de bord admin', () => {
    const dashboard = readFileSync('src/app/admin/page.tsx', 'utf8')
    const version = readFileSync('src/components/VersionCard.tsx', 'utf8')
    expect(dashboard).not.toContain('<StorageUsagePanel')
    expect(version).not.toContain('<BackupSchedulePanel')
    expect(version).not.toContain('<BackupPrunePanel')
  })
})
