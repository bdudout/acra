/**
 * Liste paginée des contrôles et menu ?vue=options, sur base réelle : les agrégats d'exécutions calculés par la base
 * (dernière réalisation, anomalies, efficacité) donnent les mêmes valeurs que l'ancien calcul sur les exécutions chargées.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { GET } from '@/app/api/controles/route'

afterAll(async () => { await prisma.$disconnect() })
const appel = (q: string) => GET(new NextRequest(`http://test.local/api/controles${q}`) as never, { params: Promise.resolve({}) } as never)

beforeAll(async () => {
  const org = await makeOrg('Contrôles agrégats')
  await prisma.organizationConfig.upsert({ where: { id: org.id }, create: { id: org.id, controlePermanentActive: true }, update: { controlePermanentActive: true } })
  const rssi = await makeUser('ANALYSTE', [{ id: org.id, role: 'RSSI' }])
  session.user = { id: rssi.id, role: 'ANALYSTE' }; session.activeOrg = org.id
  const mk = (intitule: string, periodicite: string) => prisma.controle.create({ data: { organizationId: org.id, intitule, periodicite, createdAt: new Date('2025-01-01') } })
  const a = await mk('Revue des accès', 'MENSUELLE')
  const b = await mk('Sauvegardes', 'ANNUELLE')
  await mk('Jamais exécuté', 'MENSUELLE')
  const ex = (controleId: string, resultat: string, date: string) => prisma.controleExecution.create({ data: { organizationId: org.id, controleId, resultat, dateRealisation: new Date(date), executantId: rssi.id } })
  for (let i = 0; i < 9; i++) await ex(a.id, 'CONFORME', `2025-0${i + 1}-15`)
  await ex(a.id, 'ANOMALIE', '2025-10-15')
  await ex(b.id, 'CONFORME', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
  await ex(b.id, 'NON_APPLICABLE', '2025-03-01')
})

describe('contrôles : agrégats d’exécutions par la base', () => {
  it('liste paginée : dernière réalisation, anomalies, synthèse', async () => {
    const r = await appel('?page=1&taille=50&tri=intitule&ordre=asc')
    const j = await r.json()
    expect(r.status, JSON.stringify(j).slice(0, 300)).toBe(200)
    expect(j.synthese).toMatchObject({ total: 3, actifs: 3, avecAnomalies: 1 })
    const revue = j.controles.find((c: { intitule: string }) => c.intitule === 'Revue des accès')
    expect(revue.efficacite).toMatchObject({ evaluees: 10, conformes: 9, anomalies: 1, tauxConformite: 90, efficacite: 'MOYENNE' })
    expect(await (await appel('?page=1&taille=50&vue=anomalies')).json()).toMatchObject({ pagination: { total: 1 } })
  })
  it('menu ?vue=options : efficacité depuis les comptes', async () => {
    const j = await (await appel('?vue=options')).json()
    const revue = j.controles.find((c: { intitule: string }) => c.intitule === 'Revue des accès')
    expect(revue.efficacite).toMatchObject({ evaluees: 10, anomalies: 1, efficacite: 'MOYENNE', etablie: true })
    expect(j.controles.find((c: { intitule: string }) => c.intitule === 'Jamais exécuté').efficacite).toMatchObject({ evaluees: 0, efficacite: null, etablie: false })
  })
})
