import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccessPanel from '@/components/AccessPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

const base = {
  analyseId: 'a1', statut: 'SOUMIS', ownerId: 'auteur', currentUserId: 'rm1', currentUserRole: 'RISK_MANAGER' as const,
  canManage: false, canSubmit: false, canApprove: true,
}

describe('AccessPanel — double approbation (analyse projet 360)', () => {
  it('affiche l’avis déjà rendu et l’avis attendu', () => {
    render(<AccessPanel {...base} approbations={[{ role: 'RSSI', userId: 'rssi1', le: '2026-09-29T09:00:00.000Z', commentaire: 'ok cyber' }]} />)
    expect(screen.getByText('Validation RSSI et Risk Manager')).toBeTruthy()
    expect(screen.getByText(/Approuvée par RSSI le/)).toBeTruthy()
    expect(screen.getByText('En attente de l’avis : Risk Manager')).toBeTruthy()
  })

  it('traduit un refus (second avis du même rôle)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'ROLE_DEJA_APPROUVE' }) })
    render(<AccessPanel {...base} currentUserRole="RSSI" approbations={[{ role: 'RSSI', userId: 'rssi1', le: '2026-09-29T09:00:00.000Z' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Approuver/ }))
    expect(await screen.findByText(/Ce rôle a déjà donné son avis/)).toBeTruthy()
  })

  it('approbation simple (autres méthodes) : pas de bloc double approbation', () => {
    render(<AccessPanel {...base} />)
    expect(screen.queryByText('Validation RSSI et Risk Manager')).toBeNull()
  })
})
