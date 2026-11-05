/**
 * Import CSV des points d'accès et de la qualification des usages TIC, sur base réelle : aperçu sans écriture, puis
 * application (qualification + points), doublons ignorés au second passage, aucun usage créé.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser, jsonRequest } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { POST } from '@/app/api/tier-registry/usages/import/route'

afterAll(async () => { await prisma.$disconnect() })

let usageId: string
beforeAll(async () => {
  const org = await makeOrg('Banque import')
  await prisma.organizationConfig.upsert({ where: { id: org.id }, create: { id: org.id, reglementaireActive: true }, update: { reglementaireActive: true } })
  const admin = await makeUser('ANALYSTE', [{ id: org.id, role: 'ADMIN' }])
  session.user = { id: admin.id, role: 'ANALYSTE' }; session.activeOrg = org.id
  const tier = await prisma.tier.create({ data: { rootOrganizationId: org.id, nom: 'PSP Import SA' } })
  await prisma.tierOrganization.create({ data: { tierId: tier.id, organizationId: org.id } }).catch(() => undefined)
  const service = await prisma.tierService.create({ data: { tierId: tier.id, nom: 'Passerelle', typeService: 'AUTRE' } })
  usageId = (await prisma.tierServiceUsage.create({ data: { organizationId: org.id, tierServiceId: service.id, useCase: 'Paiement carte' } })).id
})

const csv = [
  'Prestataire;Service;Cas d’usage;URL;Type;Env;PCI;Avec SI;Exposition;Interconnexion',
  'PSP Import;Passerelle;Paiement carte;https://api.psp-import.example/v1;API;prod;oui;oui;Internet;LS',
  'PSP Import;Passerelle;;sftp.psp-import.example;SFTP;recette;;;;',
  'Inconnu;X;;x.example;;;;;;',
].join('\n')
const envoi = (dryRun: boolean) => POST(jsonRequest({ filename: 'usages.csv', data: Buffer.from(csv, 'utf8').toString('base64'), dryRun }) as never, { params: Promise.resolve({}) } as never)

describe('import des usages TIC (base réelle)', () => {
  it('aperçu : statut par ligne, aucune écriture', async () => {
    const r = await envoi(true)
    const j = await r.json()
    expect(r.status, JSON.stringify(j)).toBe(200)
    expect(j.counts).toEqual({ ok: 2, ignorees: 0, erreurs: 1, points: 2, qualifications: 1 })
    expect(await prisma.tierUsageEndpoint.count({ where: { usageId } })).toBe(0)
  })
  it('application : qualification et points écrits ; second passage = doublons ignorés', async () => {
    const r = await envoi(false)
    expect(r.status).toBe(201)
    expect(await prisma.tierServiceUsage.findUnique({ where: { id: usageId }, select: { perimetrePci: true, avecSi: true, exposeInternet: true, interconnexion: true } }))
      .toEqual({ perimetrePci: true, avecSi: true, exposeInternet: true, interconnexion: 'LIGNE_SPECIALISEE' })
    expect((await prisma.tierUsageEndpoint.findMany({ where: { usageId }, select: { hote: true, type: true, environnement: true }, orderBy: { createdAt: 'asc' } })))
      .toEqual([{ hote: 'api.psp-import.example', type: 'API', environnement: 'PRODUCTION' }, { hote: 'sftp.psp-import.example', type: 'SFTP', environnement: 'RECETTE' }])
    const j2 = await (await envoi(false)).json()
    expect(j2.points).toBe(0)
    expect(await prisma.tierUsageEndpoint.count({ where: { usageId } })).toBe(2)
    expect(await prisma.tierServiceUsage.count({ where: { useCase: 'X' } })).toBe(0)
  })
})
