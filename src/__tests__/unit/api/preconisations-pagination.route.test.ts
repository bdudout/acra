// Lot V1 : GET /api/preconisations — réponse historique sans `page`, liste paginée sinon (deep-link compris).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const precoFindMany = vi.hoisted(() => vi.fn())
const lienFindMany = vi.hoisted(() => vi.fn())
const ctx = vi.hoisted(() => ({ canDefine: true }))
vi.mock('@/lib/prisma', () => ({ prisma: { preconisation: { findMany: precoFindMany }, planActionLien: { findMany: lienFindMany } } }))
vi.mock('@/lib/questionnaire.server', () => ({
  questionnaireContext: vi.fn(async () => ({ ok: true, ctx: { userId: 'u1', orgId: 'o1', role: 'RSSI', canDefine: ctx.canDefine } })),
  refuse: vi.fn(),
  repondantsPossibles: vi.fn(async () => [{ id: 'r1', name: 'Resp', email: 'r@x' }]),
}))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn() }))

import { GET } from '@/app/api/preconisations/route'

const appel = (q = '') => GET(new NextRequest(`http://localhost/api/preconisations${q}`))
const legers = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, statut: i < 10 ? 'RESOLU' : 'OUVERT', intitule: i === 42 ? 'Chiffrement des postes' : `Préco ${i}`, recommandation: null, responsableAction: null }))

beforeEach(() => {
  vi.clearAllMocks()
  ctx.canDefine = true
  precoFindMany.mockImplementation(async (arg: { select?: unknown; where: { id?: { in: string[] } } }) =>
    arg.select ? legers : arg.where.id ? [...arg.where.id.in].reverse().map(id => ({ id, intitule: id })) : legers.map(l => ({ id: l.id, intitule: l.intitule })))
  lienFindMany.mockResolvedValue([{ targetId: 'p26', planAction: { id: 'pa', titre: 'Plan', statut: 'A_FAIRE', echeance: null } }])
})

describe('GET /api/preconisations (lot V1)', () => {
  it('sans `page` : forme historique complète, sans pagination', async () => {
    const j = await (await appel()).json()
    expect(Object.keys(j).sort()).toEqual(['canDefine', 'preconisations', 'responsables'])
    expect(j.preconisations).toHaveLength(60)
    expect(precoFindMany).toHaveBeenCalledTimes(1)
  })

  it('avec `page` : page demandée, détail et plans liés de la seule page, synthèse sur toute la liste', async () => {
    const j = await (await appel('?page=2&taille=25')).json()
    expect(j.pagination).toEqual({ page: 2, taille: 25, total: 60, pages: 3 })
    expect(j.preconisations.map((p: { id: string }) => p.id)).toEqual(Array.from({ length: 25 }, (_, i) => `p${25 + i}`))
    expect(precoFindMany.mock.calls[1][0].where.id.in).toHaveLength(25)
    expect(lienFindMany.mock.calls[0][0].where.targetId.in).toHaveLength(25)
    expect(j.preconisations.find((p: { id: string }) => p.id === 'p26').plansAction).toHaveLength(1)
    expect(j.synthese).toEqual({ total: 60, parStatut: { RESOLU: 10, OUVERT: 50 } })
    expect(j.canDefine).toBe(true)
  })

  it('métier : seules ses préconisations (filtre inchangé)', async () => {
    ctx.canDefine = false
    const j = await (await appel('?page=1')).json()
    expect(precoFindMany.mock.calls[0][0].where).toEqual({ organizationId: 'o1', responsableId: 'u1' })
    expect(j.responsables).toBeUndefined()
  })

  it('recherche côté serveur', async () => {
    const j = await (await appel('?page=1&q=chiffrement')).json()
    expect(j.pagination.total).toBe(1)
    expect(j.preconisations.map((p: { id: string }) => p.id)).toEqual(['p42'])
  })

  it('deep-link ?preconisation=<id> : la page renvoyée est celle qui la contient', async () => {
    const j = await (await appel('?page=1&taille=25&preconisation=p57')).json()
    expect(j.pagination.page).toBe(3)
    expect(j.preconisations.some((p: { id: string }) => p.id === 'p57')).toBe(true)
  })
})
