/** Données et services d'un projet 360 : lecture, enregistrement, import depuis une analyse cyber. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ cadrage: { findUnique: vi.fn(), upsert: vi.fn() }, analyse: { findFirst: vi.fn() } }))
const guards = vi.hoisted(() => ({
  lecture: vi.fn(async () => ({ ok: true, analyse: { id: 'p', organizationId: 'o' } })),
  edition: vi.fn(async () => ({ ok: true, analyse: { id: 'p', methode: 'PROJET_360', organizationId: 'o' } })),
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/analyse-direct-risk.server', () => ({ guardLectureProjet360: guards.lecture, guardDirectRisk: guards.edition }))
vi.mock('@/lib/org-context.server', () => ({ getEffectiveRoleForOrg: vi.fn(async () => 'ANALYSTE') }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))

import { GET, PUT, POST } from '@/app/api/analyses/[id]/actifs-projet/route'

const params = { params: Promise.resolve({ id: 'p' }) }
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never
beforeEach(() => { vi.clearAllMocks(); db.cadrage.findUnique.mockResolvedValue({ valeursMetier: [{ id: 'a', nom: 'Portail', type: 'SERVICE', criticite: 3 }] }); db.cadrage.upsert.mockResolvedValue({}) })

describe('données et services d’un projet', () => {
  it('GET : lecture selon l’accès au projet', async () => {
    const body = await (await GET({} as never, params)).json()
    expect(guards.lecture).toHaveBeenCalled()
    expect(body.actifs).toEqual([{ id: 'a', nom: 'Portail', type: 'SERVICE', criticite: 3 }])
  })
  it('PUT : édition requise, lignes assainies, enregistrées dans le cadrage du projet', async () => {
    const r = await PUT(req({ actifs: [{ nom: ' Annuaire ', type: 'DONNEE', criticite: 7 }, { nom: '' }] }), params)
    expect(r.status).toBe(200)
    const arg = db.cadrage.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ analyseId: 'p' })
    expect(arg.update.valeursMetier).toEqual([expect.objectContaining({ nom: 'Annuaire', type: 'DONNEE', criticite: 4 })])
    guards.edition.mockResolvedValueOnce({ ok: false, status: 403, error: 'x' } as never)
    expect((await PUT(req({ actifs: [] }), params)).status).toBe(403)
  })
  it('POST : import des valeurs métier d’une analyse cyber accessible, de la même organisation, sans écraser l’existant', async () => {
    db.analyse.findFirst.mockResolvedValueOnce({ id: 's', nom: 'Cyber — portail', cadrage: { valeursMetier: [{ id: 'v1', nom: 'portail', type: 'PROCESSUS' }, { id: 'v2', nom: 'Données clients', type: 'INFORMATION', confidentialite: 4 }], evenementsRedoutes: [] } })
    const body = await (await POST(req({ sourceAnalyseId: 's' }), params)).json()
    const where = db.analyse.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ id: 's', organizationId: 'o', deletedAt: null })
    expect(where.methode.in).toContain('EBIOS_RM')
    expect(body.ajoutes).toBe(1)
    expect(body.actifs.map((a: { nom: string }) => a.nom)).toEqual(['Portail', 'Données clients'])
    db.analyse.findFirst.mockResolvedValueOnce(null)
    expect((await POST(req({ sourceAnalyseId: 'x' }), params)).status).toBe(404)
  })
})
