// @vitest-environment node
// Cron mensuel des photos d'indicateurs du dossier de comité : secret obligatoire, une organisation en échec ne bloque pas
// les autres, aucune donnée métier renvoyée.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const m = vi.hoisted(() => ({ auth: vi.fn(), orgs: vi.fn(), capturer: vi.fn() }))
// Bail d'exécution des tâches planifiées : passant (testé sur base réelle, cron-verrou.db.test.ts).
vi.mock('@/lib/cron-verrou.server', () => ({ avecVerrouCron: async (_t: string, fn: () => Promise<unknown>) => ({ execute: true, resultat: await fn() }) }))
vi.mock('@/lib/cron-auth', () => ({ assertCronAuth: m.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: { organization: { findMany: m.orgs } } }))
vi.mock('@/lib/comite-historique.server', () => ({ capturerPhotoComite: m.capturer }))
import { POST } from '@/app/api/cron/comite-snapshots/route'

beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockReturnValue(null)
  m.orgs.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }])
  m.capturer.mockImplementation(async (id: string) => { if (id === 'o2') throw new Error('panne'); return id === 'o1' ? { cree: true } : null })
})

describe('POST /api/cron/comite-snapshots', () => {
  it('photographie chaque organisation ; échec isolé ; compteurs seulement', async () => {
    const j = await (await POST(new NextRequest('http://x', { method: 'POST' }))).json()
    expect(j).toEqual({ ok: true, organisations: 3, crees: 1 })
    expect(m.capturer).toHaveBeenCalledTimes(3)
  })
  it('secret invalide : refusé, rien n’est photographié', async () => {
    m.auth.mockReturnValue(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))
    expect((await POST(new NextRequest('http://x', { method: 'POST' }))).status).toBe(401)
    expect(m.capturer).not.toHaveBeenCalled()
  })
})
