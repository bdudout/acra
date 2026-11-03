/**
 * Registre TIC, sur base réelle : la stratégie de sortie (DORA art. 28 § 8) est enregistrée ; et un PATCH qui ne fournit
 * pas le questionnaire ou la stratégie de sortie ne les EFFACE plus (défaut corrigé : modifier un contrat via le
 * formulaire principal vidait les réponses au questionnaire de qualification).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { PATCH } from '@/app/api/reglementaire/registre-tic/[id]/route'

afterAll(async () => { await prisma.$disconnect() })
let id: string
const patch = (body: unknown) => PATCH(new Request('http://test.local/api', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.6.0.1' }, body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id }) } as never)

beforeAll(async () => {
  const org = await makeOrg('Banque sortie')
  await prisma.organizationConfig.upsert({ where: { id: org.id }, create: { id: org.id, reglementaireActive: true }, update: { reglementaireActive: true } })
  const rssi = await makeUser('ANALYSTE', [{ id: org.id, role: 'RSSI' }])
  session.user = { id: rssi.id, role: 'ANALYSTE' }; session.activeOrg = org.id
  id = (await prisma.arrangementTic.create({ data: { organizationId: org.id, reference: 'C-1', prestataireNom: 'Cloud A', criticite: 'CRITIQUE', questionnaire: [{ id: 'iso27001', reponse: 'OUI' }] } })).id
})

describe('registre TIC : stratégie de sortie et PATCH partiel (base réelle)', () => {
  it('enregistre la stratégie de sortie sans effacer le questionnaire', async () => {
    const r = await patch({ reference: 'C-1', prestataireNom: 'Cloud A', criticite: 'CRITIQUE', strategieSortie: 'Bascule vers Cloud B sous 3 mois', prestataireAlternatif: 'Cloud B', strategieSortieTesteeLe: '2026-06-30' })
    expect(r.status, await r.clone().text()).toBe(200)
    const a = await prisma.arrangementTic.findUnique({ where: { id } })
    expect(a).toMatchObject({ strategieSortie: 'Bascule vers Cloud B sous 3 mois', prestataireAlternatif: 'Cloud B' })
    expect(a!.strategieSortieTesteeLe!.toISOString().slice(0, 10)).toBe('2026-06-30')
    expect(a!.questionnaire).toEqual([{ id: 'iso27001', reponse: 'OUI' }])
  })
  it('enregistrer le questionnaire seul ne vide pas la stratégie de sortie', async () => {
    expect((await patch({ reference: 'C-1', prestataireNom: 'Cloud A', criticite: 'CRITIQUE', questionnaire: [{ id: 'iso27001', reponse: 'NON' }] })).status).toBe(200)
    const a = await prisma.arrangementTic.findUnique({ where: { id } })
    expect(a).toMatchObject({ strategieSortie: 'Bascule vers Cloud B sous 3 mois', questionnaire: [{ id: 'iso27001', reponse: 'NON' }] })
  })
})
