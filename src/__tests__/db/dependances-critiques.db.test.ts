/**
 * Cartographie des dépendances des fonctions critiques ou importantes, sur base réelle : seules les fonctions DORA
 * critiques / importantes de l'organisation active ; écarts (RTO au-delà de la tolérance, usage hors contrat) ;
 * concentration d'un prestataire et d'un hôte ; un LECTEUR est refusé.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { GET } from '@/app/api/resilience/dependances/route'
import { POST as creerScenario } from '@/app/api/resilience/scenarios/route'

afterAll(async () => { await prisma.$disconnect() })
const appel = () => GET(new NextRequest('http://test.local/api/resilience/dependances') as never, { params: Promise.resolve({}) } as never)
let rssi: { id: string }, lecteur: { id: string }, orgId: string

beforeAll(async () => {
  const org = await makeOrg('Banque dépendances'); orgId = org.id
  await prisma.organizationConfig.upsert({ where: { id: org.id }, create: { id: org.id, reglementaireActive: true }, update: { reglementaireActive: true } })
  rssi = await makeUser('ANALYSTE', [{ id: org.id, role: 'RSSI' }])
  lecteur = await makeUser('ANALYSTE', [{ id: org.id, role: 'LECTEUR' }])
  const paiements = await prisma.processus.create({ data: { organizationId: org.id, nom: 'Paiements', criticiteDora: 'CRITIQUE', proprietaire: 'DP', rtoMinutes: 480, rpoMinutes: 15, toleranceImpactMinutes: 240 } })
  const virements = await prisma.processus.create({ data: { organizationId: org.id, nom: 'Virements', criticiteDora: 'IMPORTANTE', proprietaire: 'DV', rtoMinutes: 60, rpoMinutes: 15, toleranceImpactMinutes: 240 } })
  await prisma.processus.create({ data: { organizationId: org.id, nom: 'Cantine', criticiteDora: 'NON_CRITIQUE' } })
  const tier = await prisma.tier.create({ data: { rootOrganizationId: org.id, nom: 'PSP' } })
  const svc = await prisma.tierService.create({ data: { tierId: tier.id, nom: 'Passerelle', typeService: 'AUTRE' } })
  for (const p of [paiements, virements]) {
    const u = await prisma.tierServiceUsage.create({ data: { organizationId: org.id, tierServiceId: svc.id, processusId: p.id, useCase: `Usage ${p.nom}`, criticite: 'CRITIQUE' } })
    await prisma.tierUsageEndpoint.create({ data: { usageId: u.id, organizationId: org.id, adresse: 'https://api.psp.example', hote: 'api.psp.example', type: 'API' } })
  }
})

describe('dépendances des fonctions critiques (base réelle)', () => {
  it('fonctions DORA seulement, écarts et concentration', async () => {
    session.user = { id: rssi.id, role: 'ANALYSTE' }; session.activeOrg = orgId
    const r = await appel()
    const j = await r.json()
    expect(r.status, JSON.stringify(j)).toBe(200)
    expect(j.fonctions.map((f: { nom: string }) => f.nom)).toEqual(['Paiements', 'Virements'])
    const paiements = j.fonctions[0]
    expect(paiements.ecarts.map((e: { code: string }) => e.code)).toEqual(expect.arrayContaining(['RTO_AU_DELA_TOLERANCE', 'USAGE_SANS_CONTRAT', 'USAGE_NON_EVALUE', 'AUCUN_CONTROLE']))
    expect(j.concentration.tiers).toEqual([expect.objectContaining({ tiersNom: 'PSP', fonctions: ['Paiements', 'Virements'] })])
    expect(j.concentration.hotes).toEqual([{ hote: 'api.psp.example', fonctions: ['Paiements', 'Virements'] }])
  })
  it('LECTEUR refusé', async () => {
    session.user = { id: lecteur.id, role: 'ANALYSTE' }; session.activeOrg = orgId
    expect((await appel()).status).toBe(403)
  })
  it('scénario créé par la route, test réalisé, contrat sans stratégie de sortie : écarts correspondants ; autre organisation refusée', async () => {
    session.user = { id: rssi.id, role: 'ANALYSTE' }; session.activeOrg = orgId
    const paiements = await prisma.processus.findFirstOrThrow({ where: { organizationId: orgId, nom: 'Paiements' } })
    const post = (body: unknown) => creerScenario(new Request('http://test.local/api', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.5.0.1' }, body: JSON.stringify(body) }) as never, { params: Promise.resolve({}) } as never)
    expect((await post({ processusId: paiements.id, intitule: 'Rançongiciel', dureeInterruptionMinutes: 2880 })).status).toBe(201)
    const autre = await makeOrg('Autre')
    const pAutre = await prisma.processus.create({ data: { organizationId: autre.id, nom: 'Autre', criticiteDora: 'CRITIQUE' } })
    expect((await post({ processusId: pAutre.id, intitule: 'x', dureeInterruptionMinutes: 10 })).status).toBe(404)
    await prisma.testResilience.create({ data: { organizationId: orgId, annee: 2026, intitule: 'Bascule PSP', type: 'SCENARIO', statut: 'REALISE', dateRealisation: new Date(), processusId: paiements.id, dureeRepriseMinutes: 300 } })
    const usage = await prisma.tierServiceUsage.findFirstOrThrow({ where: { organizationId: orgId, processusId: paiements.id } })
    const contrat = await prisma.arrangementTic.create({ data: { organizationId: orgId, reference: 'C-PSP', prestataireNom: 'PSP', criticite: 'CRITIQUE' } })
    const offre = await prisma.tierContractService.create({ data: { arrangementId: contrat.id, tierServiceId: usage.tierServiceId } })
    await prisma.tierServiceUsage.update({ where: { id: usage.id }, data: { contractServiceId: offre.id } })
    const j = await (await appel()).json()
    const codes = j.fonctions.find((f: { nom: string }) => f.nom === 'Paiements').ecarts.map((e: { code: string }) => e.code)
    expect(codes).toEqual(expect.arrayContaining(['SCENARIO_HORS_TOLERANCE', 'REPRISE_TESTEE_AU_DELA_TOLERANCE', 'SANS_STRATEGIE_SORTIE']))
    expect(codes).not.toContain('AUCUN_TEST_12_MOIS')
    expect(codes).not.toContain('USAGE_SANS_CONTRAT')
    expect(j.peutModifier).toBe(true)
  })
})
