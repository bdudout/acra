/** GED — pagination côté serveur (lot V1) : sans `page` forme historique ; avec `page` page seule + pagination + synthèse. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Args = { where: Record<string, unknown>; select?: Record<string, unknown>; distinct?: string[] }
const db = vi.hoisted(() => ({ document: { findMany: vi.fn(async (_a: Args) => [] as unknown[]), count: vi.fn(async (_a: Args) => 0) } }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'RSSI' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ role: 'RSSI', activeOrgId: 'o' })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ conformiteActive: true })) }))
vi.mock('@/lib/document-storage', () => ({ getDocumentStorage: async () => ({ put: vi.fn(), delete: vi.fn() }) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))

import { GET } from '@/app/api/documents/route'

const leger = (i: number, titre = `Doc ${String(i).padStart(3, '0')}`) => ({ id: `d${i}`, titre, type: 'PREUVE', fichierNom: `f${i}.pdf`, description: null, dateRevue: null, taille: i, createdAt: new Date(2026, 0, 1 + i) })
const appel = (qs: string) => GET({ url: `http://x/api/documents${qs}` } as never)

beforeEach(() => {
  vi.clearAllMocks()
  db.document.count.mockResolvedValue(120)
  db.document.findMany.mockImplementation(async (a: Args) => {
    if (a.distinct) return [{ titre: 'Plan d’Assurance Sécurité (PAS)' }]
    const ids = (a.where.id as { in?: string[] } | undefined)?.in
    if (ids) return [...ids].reverse().map(id => ({ id, titre: id, detail: true }))
    return Array.from({ length: 120 }, (_, i) => leger(i, i === 7 ? 'Politique de sécurité' : undefined))
  })
})

describe('GET /api/documents paginé', () => {
  it('sans `page` : réponse historique (liste complète, ni pagination ni synthèse)', async () => {
    db.document.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
    const d = await (await appel('')).json()
    expect(d).toEqual({ active: true, documents: [{ id: 'a' }, { id: 'b' }], canManage: true })
    expect(db.document.findMany).toHaveBeenCalledTimes(1)
    expect(db.document.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'o', analyseId: null })
  })

  it('avec `page` : taille respectée, détail chargé pour la seule page (ordre conservé), synthèse sur toute la bibliothèque', async () => {
    const d = await (await appel('?page=2&taille=25')).json()
    expect(d.pagination).toEqual({ page: 2, taille: 25, total: 120, pages: 5 })
    expect(d.synthese).toEqual({ total: 120, titresModeles: ['Plan d’Assurance Sécurité (PAS)'] })
    expect(d.documents.map((x: { id: string }) => x.id)).toEqual(Array.from({ length: 25 }, (_, i) => `d${25 + i}`))
    const detail = db.document.findMany.mock.calls.find(c => (c[0].where.id as { in?: string[] } | undefined)?.in)!
    expect((detail[0].where.id as { in: string[] }).in).toHaveLength(25)
    expect(detail[0].where).toMatchObject({ organizationId: 'o', analyseId: null })
  })

  it('filtres côté serveur : type/portée en SQL, recherche sans casse ni accents', async () => {
    const d = await (await appel('?page=1&type=PREUVE&portee=ORG&q=securite')).json()
    const leg = db.document.findMany.mock.calls[0][0]
    expect(leg.where).toMatchObject({ organizationId: 'o', analyseId: null, type: 'PREUVE', portee: 'ORG' })
    expect(leg.select).not.toHaveProperty('mime')
    expect(d.pagination.total).toBe(1)
    expect(d.documents.map((x: { id: string }) => x.id)).toEqual(['d7'])
  })

  it('tri serveur', async () => {
    const d = await (await appel('?page=1&taille=25&tri=taille&ordre=desc')).json()
    expect(d.documents[0].id).toBe('d119')
  })
})
