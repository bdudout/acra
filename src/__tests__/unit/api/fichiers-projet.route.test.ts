// @vitest-environment node
/** Fichiers d'un projet 360 : rattachés au projet, accès selon le projet, exclus de la bibliothèque documentaire. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ document: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() } }))
const store = vi.hoisted(() => ({ put: vi.fn(async () => {}), get: vi.fn(async () => Buffer.from('%PDF-1.7')), delete: vi.fn(async () => {}) }))
const guards = vi.hoisted(() => ({
  lecture: vi.fn(async () => ({ ok: true, analyse: { id: 'p', organizationId: 'o' } })),
  edition: vi.fn(async () => ({ ok: true, analyse: { id: 'p', methode: 'PROJET_360', organizationId: 'o' } })),
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/document-storage', () => ({ getDocumentStorage: async () => store }))
vi.mock('@/lib/analyse-direct-risk.server', () => ({ guardLectureProjet360: guards.lecture, guardDirectRisk: guards.edition }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ allowed: true })), rateLimitHeaders: () => ({}), LIMIT_API_WRITE: { limit: 1, windowMs: 1 } }))

import { GET, POST } from '@/app/api/analyses/[id]/fichiers/route'
import { GET as DOWNLOAD, DELETE } from '@/app/api/analyses/[id]/fichiers/[docId]/route'

const params = { params: Promise.resolve({ id: 'p' }) }
const docParams = { params: Promise.resolve({ id: 'p', docId: 'd1' }) }
const upload = (file: File, extra: Record<string, string> = {}) => {
  const fd = new FormData(); fd.set('file', file); for (const [k, v] of Object.entries(extra)) fd.set(k, v)
  return { formData: async () => fd, headers: new Headers() } as never
}
beforeEach(() => { vi.clearAllMocks(); db.document.findMany.mockResolvedValue([]); db.document.create.mockImplementation(async (a: { data: unknown }) => a.data) })

describe('fichiers d’un projet 360', () => {
  it('liste : seulement les fichiers de CE projet, lecture selon l’accès au projet', async () => {
    await GET({} as never, params)
    expect(guards.lecture).toHaveBeenCalledWith('p', 'u', 'ANALYSTE')
    expect(db.document.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'o', analyseId: 'p' })
  })
  it('dépôt : édition du projet requise, MIME et signature contrôlés, rattaché au projet', async () => {
    const ok = await POST(upload(new File(['%PDF-1.7 schéma'], 'archi.pdf', { type: 'application/pdf' }), { type: 'ARCHITECTURE', titre: 'Dossier d’architecture' }), params)
    expect(ok.status).toBe(201)
    expect(guards.edition).toHaveBeenCalled()
    expect(db.document.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'o', analyseId: 'p', type: 'ARCHITECTURE', titre: 'Dossier d’architecture', portee: 'PROJET', fichierNom: 'archi.pdf' })
    const exe = await POST(upload(new File(['MZ'], 'x.exe', { type: 'application/x-msdownload' })), params)
    expect(exe.status).toBe(400)
    const faux = await POST(upload(new File(['MZ pas un pdf'], 'faux.pdf', { type: 'application/pdf' })), params)
    expect(faux.status).toBe(400)
  })
  it('dépôt refusé sans droit d’édition', async () => {
    guards.edition.mockResolvedValueOnce({ ok: false, status: 403, error: 'Édition non autorisée' } as never)
    const r = await POST(upload(new File(['%PDF-1.7'], 'a.pdf', { type: 'application/pdf' })), params)
    expect(r.status).toBe(403)
    expect(db.document.create).not.toHaveBeenCalled()
  })
  it('téléchargement et suppression : le fichier doit appartenir au projet (sinon 404)', async () => {
    db.document.findFirst.mockResolvedValueOnce(null)
    expect((await DOWNLOAD({} as never, docParams)).status).toBe(404)
    expect(db.document.findFirst.mock.calls[0][0].where).toEqual({ id: 'd1', organizationId: 'o', analyseId: 'p' })
    db.document.findFirst.mockResolvedValueOnce({ id: 'd1', storageKey: 'k', mime: 'application/pdf', fichierNom: 'a.pdf', taille: 8 })
    const dl = await DOWNLOAD({} as never, docParams)
    expect(dl.status).toBe(200)
    expect(dl.headers.get('Content-Disposition')).toMatch(/attachment/)
    db.document.findFirst.mockResolvedValueOnce({ id: 'd1', storageKey: 'k' })
    expect((await DELETE({ headers: new Headers() } as never, docParams)).status).toBe(200)
    expect(store.delete).toHaveBeenCalledWith('k')
  })
})
