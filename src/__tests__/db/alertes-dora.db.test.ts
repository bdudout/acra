/**
 * Alertes DORA sur une vraie base : incident majeur classé il y a 1 h ⇒ alerte « notification
 * initiale » aux RSSI et gestionnaires des risques (pas aux autres), une seule fois ; module
 * Réglementaire inactif ⇒ aucune alerte ; incident non majeur ⇒ aucune alerte.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const mail = vi.hoisted(() => ({ send: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/email', () => ({ sendEmail: mail.send }))

import { POST as cron } from '@/app/api/cron/alertes-dora/route'

const H = 3_600_000
const h = (n: number) => new Date(Date.now() + n * H)
const req = () => new Request('http://t/api/cron/alertes-dora', { method: 'POST', headers: { authorization: 'Bearer s3cret-s3cret-s3cret' } }) as never
type Envoye = { to: string; subject: string; text: string }
const envoyes = (u: { email: string }) => (mail.send.mock.calls as unknown as [Envoye][]).map(c => c[0]).filter(m => m.to === u.email)
const majeur = { serviceCritique: true, clientsAffectes: 5000 }

let rssi: { email: string }, rm: { email: string }, analyste: { email: string }, rssiInactif: { email: string }, incidentId = ''

beforeAll(async () => {
  process.env.CRON_SECRET = 's3cret-s3cret-s3cret'
  const banque = await makeOrg('Banque DORA'), inactive = await makeOrg('Sans réglementaire')
  await prisma.organizationConfig.create({ data: { id: banque.id, incidentsActive: true, reglementaireActive: true } })
  await prisma.organizationConfig.create({ data: { id: inactive.id, incidentsActive: true, reglementaireActive: false } })
  rssi = await makeUser('ANALYSTE', [{ id: banque.id, role: 'RSSI' }])
  rm = await makeUser('ANALYSTE', [{ id: banque.id, role: 'RISK_MANAGER' }])
  analyste = await makeUser('ANALYSTE', [{ id: banque.id }])
  rssiInactif = await makeUser('ANALYSTE', [{ id: inactive.id, role: 'RSSI' }])
  const inc = (organizationId: string, intitule: string, doraCriteres: object) => prisma.incident.create({ data: { organizationId, intitule, declarantId: 'x', statut: 'QUALIFIE', dateDetection: h(-2), doraClasseMajeurLe: h(-1), doraCriteres } })
  incidentId = (await inc(banque.id, 'Panne du SI de paiement', majeur)).id
  await inc(banque.id, 'Lenteur mineure', { clientsAffectes: 10 })
  await inc(inactive.id, 'Hors module', majeur)
})
afterAll(async () => { await prisma.$disconnect() })

describe('alertes DORA (vraie base)', () => {
  it('incident majeur : alerte urgente aux RSSI et gestionnaires des risques, pas à l’analyste', async () => {
    const res = await (await cron(req())).json()
    expect(res.ok).toBe(true)
    for (const u of [rssi, rm]) {
      const m = envoyes(u)
      expect(m).toHaveLength(1)
      expect(m[0].subject).toBe('[ACRA] URGENT — déclaration DORA : 1 échéance(s)')
      expect(m[0].text).toMatch(/Notification initiale — Panne du SI de paiement : à soumettre avant le \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/)
      expect(m[0].text).not.toContain('Lenteur mineure')
    }
    expect(envoyes(analyste)).toHaveLength(0)
    expect(envoyes(rssiInactif)).toHaveLength(0)
    const i = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } })
    expect(Object.keys(i.alertesDora as object)).toEqual(['INITIALE:A_FAIRE'])
  })
  it('une seule alerte par phase : rien au passage suivant ; le retard déclenche une nouvelle alerte', async () => {
    mail.send.mockClear()
    await cron(req())
    expect(envoyes(rssi)).toHaveLength(0)
    await prisma.incident.update({ where: { id: incidentId }, data: { dateDetection: h(-40), doraClasseMajeurLe: h(-30) } })
    await cron(req())
    expect(envoyes(rssi)[0].text).toContain('Notification initiale — Panne du SI de paiement : EN RETARD')
  })
})

describe('alertes des régimes de notification (NIS2, CRA) sur vraie base', () => {
  it('régimes activés dans la configuration : alerte à l’approche de l’échéance, une seule fois ; régime désactivé ⇒ rien', async () => {
    const org = await makeOrg('Entreprise NIS2/CRA')
    await prisma.organizationConfig.create({ data: { id: org.id, incidentsActive: true, reglementaireActive: false,
      incidentsConfig: { regimes: [{ code: 'NIS2', actif: true }, { code: 'CRA_14', actif: false }] } } })
    const resp = await makeUser('ANALYSTE', [{ id: org.id, role: 'RSSI' }])
    // détecté il y a 20 h : l'alerte précoce NIS2 (24 h) n'a plus que 4 h ; le CRA désactivé ne produit rien
    const inc = await prisma.incident.create({ data: { organizationId: org.id, intitule: 'Compromission de messagerie', declarantId: 'x', statut: 'QUALIFIE', dateDetection: h(-20), attributs: { significatif: true, regimes: ['CRA_14'] } } })
    mail.send.mockClear()
    await cron(req())
    const m = envoyes(resp)
    expect(m).toHaveLength(1)
    expect(m[0].subject).toBe('[ACRA] URGENT — déclarations d’incident : 1 échéance(s)')
    expect(m[0].text).toContain('NIS2'); expect(m[0].text).toContain('Alerte précoce'); expect(m[0].text).not.toContain('CRA —')
    const i = await prisma.incident.findUniqueOrThrow({ where: { id: inc.id } })
    expect(Object.keys(i.alertesDora as object)).toEqual(['NIS2:ALERTE_PRECOCE:A_FAIRE'])
    mail.send.mockClear(); await cron(req())
    expect(envoyes(resp)).toHaveLength(0) // une seule alerte par phase
    // la phase est formalisée en interne : plus de retard à signaler
    await prisma.incident.update({ where: { id: inc.id }, data: { dateDetection: h(-40), notifications: [{ regime: 'NIS2', phase: 'ALERTE_PRECOCE', soumisLe: h(-30).toISOString() }] } })
    mail.send.mockClear(); await cron(req())
    expect(envoyes(resp).filter(x => x.text.includes('EN RETARD') && x.text.includes('Alerte précoce'))).toHaveLength(0)
  })
})
