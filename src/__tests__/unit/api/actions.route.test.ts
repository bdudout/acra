// Lot V1 : GET /api/actions — vue unifiée des plans d'action paginée côté serveur.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const gather = vi.hoisted(() => vi.fn())
const entiteFindMany = vi.hoisted(() => vi.fn())
const scope = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ prisma: { entite: { findMany: entiteFindMany } } }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ incidentsActive: true, controlePermanentActive: false, auditInterneActive: true, registreRisquesActive: true, conformiteActive: false })) }))
vi.mock('@/lib/action-items.server', () => ({ gatherActionItems: gather }))

import { GET } from '@/app/api/actions/route'

const item = (id: string, o: Record<string, unknown> = {}) => ({ id, source: 'MESURE', origine: 'risque', sourceId: id, titre: `Action ${id}`, description: null, porteur: null, entite: null, entiteId: null, echeance: null, statut: 'A_FAIRE', priorite: 'MAJEUR', lien: null, riskItemId: null, ...o })
const appel = (q = '') => GET(new NextRequest(`http://localhost/api/actions${q}`))

beforeEach(() => {
  vi.clearAllMocks()
  scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ANALYSTE', scope: { visibleOrgIds: ['o1'], isSuperAdmin: false } })
  gather.mockResolvedValue([item('a', { origine: 'orpheline' }), ...Array.from({ length: 59 }, (_, i) => item(`n${i}`, { origine: i % 2 ? 'audit' : 'risque' }))])
})

describe('GET /api/actions', () => {
  it('même périmètre que la page : organisation active, modules et accès transmis à gatherActionItems', async () => {
    await appel()
    expect(gather).toHaveBeenCalledWith('o1', expect.objectContaining({ incidentsActive: true, controlePermanentActive: false }), { userId: 'u', role: 'ANALYSTE', scope: { visibleOrgIds: ['o1'], isSuperAdmin: false } })
  })

  it('sans organisation lisible : 400, aucune lecture', async () => {
    scope.mockResolvedValue({ activeOrgId: null, role: null, scope: { visibleOrgIds: ['o1'], isSuperAdmin: false } })
    expect((await appel('?page=1')).status).toBe(400)
    expect(gather).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN sans organisation focalisée : bilan consolidé de toutes les organisations visibles', async () => {
    scope.mockResolvedValue({ activeOrgId: null, role: 'SUPER_ADMIN', scope: { visibleOrgIds: ['o1', 'o2'], isSuperAdmin: true } })
    const j = await (await appel()).json()
    expect(gather).toHaveBeenCalledTimes(2)
    expect(j.items).toHaveLength(120)
  })

  it('sans `page` : toutes les actions { items }', async () => {
    const j = await (await appel()).json()
    expect(Object.keys(j)).toEqual(['items'])
    expect(j.items).toHaveLength(60)
  })

  it('avec `page` : page, filtre serveur, synthèse sur toutes les actions, valeurs de colonnes', async () => {
    const j = await (await appel('?page=2&taille=25&origine=risque')).json()
    expect(j.pagination).toEqual({ page: 2, taille: 25, total: 30, pages: 2 })
    expect(j.items).toHaveLength(5)
    expect(j.items.every((i: { origine: string }) => i.origine === 'risque')).toBe(true)
    expect(j.synthese).toMatchObject({ total: 60, orphelines: 1 })
    expect(j.valeurs.origine).toEqual(['risque'])
    expect(entiteFindMany).not.toHaveBeenCalled()
  })

  it('filtre par entité : référentiel chargé pour les organisations lues, sous-entités comprises', async () => {
    gather.mockResolvedValue([item('x', { entiteId: 'ret' }), item('y', { entite: 'Achats' })])
    entiteFindMany.mockResolvedValue([
      { id: 'dsi', nom: 'DSI', type: 'DIRECTION', alias: null, codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null },
      { id: 'ret', nom: 'Réseaux', type: 'SERVICE', alias: [], codeExterne: null, parentId: 'dsi', source: 'MANUEL', valideAu: null },
    ])
    const j = await (await appel('?page=1&entite=dsi')).json()
    expect(entiteFindMany.mock.calls[0][0].where).toEqual({ organizationId: { in: ['o1'] } })
    expect(j.items.map((i: { id: string }) => i.id)).toEqual(['x'])
  })
})
