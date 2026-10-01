import { describe, it, expect, vi, beforeEach } from 'vitest'

const session = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.value) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { requireSession, requireInstanceAdmin, sessionUser } from '@/lib/route-guard.server'

beforeEach(() => { session.value = null })

describe('route-guard (T3)', () => {
  it('sans session : 401', async () => {
    expect((await requireSession()).error?.status).toBe(401)
    expect((await requireInstanceAdmin()).error?.status).toBe(401)
  })
  it('session sans identifiant : 401 (jamais un utilisateur anonyme typé)', async () => {
    session.value = { user: { role: 'SUPER_ADMIN' } }
    expect((await requireInstanceAdmin()).error?.status).toBe(401)
  })
  it.each(['ADMIN', 'RSSI', 'ANALYSTE', undefined])('rôle %s : 403 pour un réglage d\'instance', async role => {
    session.value = { user: { id: 'u1', role } }
    const g = await requireInstanceAdmin()
    expect(g.error?.status).toBe(403)
    expect(await g.error?.json()).toEqual({ error: 'Réservé au super-administrateur' })
  })
  it('SUPER_ADMIN : accès, utilisateur typé', async () => {
    session.value = { user: { id: 'sa', role: 'SUPER_ADMIN', email: 'sa@x.io' } }
    const g = await requireInstanceAdmin()
    expect(g.error).toBeNull()
    expect(g.user).toEqual({ id: 'sa', role: 'SUPER_ADMIN', email: 'sa@x.io', name: null })
  })
  it('sessionUser : rôle par défaut ANALYSTE, null sans id', () => {
    expect(sessionUser({ user: { id: 'u' } } as never)?.role).toBe('ANALYSTE')
    expect(sessionUser(null)).toBeNull()
  })
})
