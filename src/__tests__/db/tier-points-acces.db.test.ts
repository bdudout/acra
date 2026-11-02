/**
 * Points d'accès des usages TIC, sur base réelle : création par la route (gestionnaire du registre), isolation (autre
 * organisation → 404), suppression en cascade avec l'usage, qualification PCI / SI / interconnexion enregistrée.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser, jsonRequest } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { POST } from '@/app/api/tier-registry/usages/[usageId]/points-acces/route'
import { PATCH } from '@/app/api/tier-registry/usages/[usageId]/route'

afterAll(async () => { await prisma.$disconnect() })

let usageId: string, usageAutreId: string, orgId: string
beforeAll(async () => {
  const org = await makeOrg('Banque PA'); orgId = org.id
  const autre = await makeOrg('Autre PA')
  await prisma.organizationConfig.upsert({ where: { id: org.id }, create: { id: org.id, reglementaireActive: true }, update: { reglementaireActive: true } })
  const admin = await makeUser('ANALYSTE', [{ id: org.id, role: 'ADMIN' }])
  session.user = { id: admin.id, role: 'ANALYSTE' }; session.activeOrg = org.id
  const tier = await prisma.tier.create({ data: { rootOrganizationId: org.id, nom: 'PSP Exemple' } })
  const service = await prisma.tierService.create({ data: { tierId: tier.id, nom: 'Passerelle de paiement', typeService: 'AUTRE' } })
  usageId = (await prisma.tierServiceUsage.create({ data: { organizationId: org.id, tierServiceId: service.id, useCase: 'Paiement carte' } })).id
  usageAutreId = (await prisma.tierServiceUsage.create({ data: { organizationId: autre.id, tierServiceId: service.id, useCase: 'Autre' } })).id
})

describe('points d’accès des usages TIC (base réelle)', () => {
  it('création, isolation et cascade', async () => {
    const r = await POST(jsonRequest({ adresse: 'https://API.psp.example/v2', type: 'API', environnement: 'PRODUCTION' }), { params: Promise.resolve({ usageId }) })
    expect(r.status, await r.clone().text()).toBe(201)
    expect(await prisma.tierUsageEndpoint.findMany({ where: { usageId }, select: { hote: true, organizationId: true } })).toEqual([{ hote: 'api.psp.example', organizationId: orgId }])

    const r2 = await POST(jsonRequest({ adresse: 'x.example', type: 'WEB' }), { params: Promise.resolve({ usageId: usageAutreId }) })
    expect(r2.status).toBe(404)
    expect(await prisma.tierUsageEndpoint.count({ where: { usageId: usageAutreId } })).toBe(0)
  })

  it('qualification PCI / SI / interconnexion enregistrée', async () => {
    const r = await PATCH(jsonRequest({ perimetrePci: true, interconnexion: 'LIGNE_SPECIALISEE', exposeInternet: false }), { params: Promise.resolve({ usageId }) })
    expect(r.status, await r.clone().text()).toBe(200)
    expect(await prisma.tierServiceUsage.findUnique({ where: { id: usageId }, select: { perimetrePci: true, avecSi: true, interconnexion: true, exposeInternet: true } }))
      .toEqual({ perimetrePci: true, avecSi: true, interconnexion: 'LIGNE_SPECIALISEE', exposeInternet: false })
  })

  it('supprimer l’usage supprime ses points d’accès', async () => {
    await prisma.tierServiceUsage.delete({ where: { id: usageId } })
    expect(await prisma.tierUsageEndpoint.count({ where: { usageId } })).toBe(0)
  })
})
