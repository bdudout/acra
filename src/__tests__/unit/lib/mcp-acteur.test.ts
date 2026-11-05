// Rôle porté par une clé MCP : celui de son créateur dans l'organisation de la clé (rôle EFFECTIF, getEffectiveRoleForOrg).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ apiKey: { findFirst: vi.fn() }, user: { findUnique: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const roleOrg = vi.hoisted(() => vi.fn())
vi.mock('@/lib/org-context.server', () => ({ getEffectiveRoleForOrg: roleOrg }))

import { acteurMcp } from '@/lib/mcp/acteur.server'

const ctx = { organizationId: 'orgA', keyId: 'k1' }
beforeEach(() => { vi.clearAllMocks() })

describe('acteurMcp', () => {
  it('clé de l’organisation → rôle effectif de son créateur dans cette organisation', async () => {
    db.apiKey.findFirst.mockResolvedValue({ createdBy: 'u1' })
    db.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ANALYSTE', isActive: true })
    roleOrg.mockResolvedValue('RSSI')
    expect(await acteurMcp(ctx)).toEqual({ userId: 'u1', role: 'RSSI' })
    expect(db.apiKey.findFirst.mock.calls[0][0].where).toEqual({ id: 'k1', organizationId: 'orgA' })
    expect(roleOrg).toHaveBeenCalledWith('u1', 'ANALYSTE', 'orgA')
  })
  it('clé sans créateur, créateur désactivé ou plus membre : aucun acteur', async () => {
    db.apiKey.findFirst.mockResolvedValue({ createdBy: null })
    expect(await acteurMcp(ctx)).toBeNull()
    db.apiKey.findFirst.mockResolvedValue({ createdBy: 'u1' })
    db.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ANALYSTE', isActive: false })
    expect(await acteurMcp(ctx)).toBeNull()
    db.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ANALYSTE', isActive: true })
    roleOrg.mockResolvedValue(null)
    expect(await acteurMcp(ctx)).toBeNull()
  })
})
