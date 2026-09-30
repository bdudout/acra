import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ update: vi.fn(), findUnique: vi.fn() }))
const auth = vi.hoisted(() => ({ scope: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'user1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { organization: db } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: auth.scope }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))

import { GET, PUT } from '@/app/api/catalogue-suggestions/sectors/route'
const request = (body: object) => ({ json: async () => body }) as never

beforeEach(() => {
  vi.clearAllMocks()
  auth.scope.mockResolvedValue({ activeOrgId: 'sub1', role: 'ADMIN' })
  db.update.mockImplementation(async ({ data }: { data: object }) => ({ id: 'sub1', ...data }))
})

describe('secteurs d’activité d’une organisation', () => {
  it('permet à l’ADMIN local de mémoriser plusieurs secteurs sans créer de risque', async () => {
    const res = await PUT(request({ sectors: ['SANTE', 'SAAS'] }))
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sub1' }, data: { secteursActivite: ['SANTE', 'SAAS'] },
    }))
  })
  it('refuse un rôle non admin et un secteur inconnu', async () => {
    auth.scope.mockResolvedValue({ activeOrgId: 'sub1', role: 'ANALYSTE' })
    expect((await PUT(request({ sectors: ['SANTE'] }))).status).toBe(403)
    auth.scope.mockResolvedValue({ activeOrgId: 'sub1', role: 'ADMIN' })
    expect((await PUT(request({ sectors: ['INCONNU'] }))).status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe('lecture des secteurs (écran de configuration)', () => {
  it('renvoie les secteurs déclarés (ordre conservé) et la liste des secteurs disponibles à l’ADMIN, même module registre inactif', async () => {
    db.findUnique.mockResolvedValue({ secteursActivite: ['SAAS', 'SANTE', 'INCONNU'] })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sectors).toEqual(['SAAS', 'SANTE']) // valeur invalide écartée
    expect(body.available).toContain('FINANCE')
    expect(db.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sub1' } }))
  })
  it('refuse un non-admin (403) et l’absence d’organisation active', async () => {
    auth.scope.mockResolvedValue({ activeOrgId: 'sub1', role: 'LECTEUR' })
    expect((await GET()).status).toBe(403)
    auth.scope.mockResolvedValue({ activeOrgId: null, role: 'ADMIN' })
    expect((await GET()).status).toBe(403)
  })
})
