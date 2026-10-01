/**
 * Relances automatiques sur une vraie base : questionnaires à répondre, préconisations et plans
 * d'action ouverts ; un e-mail par personne ; responsable du plan résolu par la préconisation liée,
 * le porteur reconnu ou, à défaut, la gouvernance ; anti-doublon par `rappelLe` ; désactivation.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const mail = vi.hoisted(() => ({ send: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/email', () => ({ sendEmail: mail.send }))

import { POST as cron } from '@/app/api/cron/relances/route'

const J = 86_400_000
const jour = (n: number) => new Date(Date.now() + n * J)
const req = () => new Request('http://test.local/api/cron/relances', { method: 'POST', headers: { authorization: 'Bearer s3cret-s3cret-s3cret' } }) as never
type Envoye = { to: string; subject: string; text: string }
const envoyesA = (email: string) => (mail.send.mock.calls as unknown as [Envoye][]).map(c => c[0]).filter(m => m.to === email)

let org: { id: string }, inactive: { id: string }
let metier: { id: string; email: string }, autre: { id: string; email: string }, rssi: { id: string; email: string }, horsOrg: { id: string; email: string }
const ids = { reponse: '', preco: '', paPreco: '', paPorteur: '', paOrphelin: '', paFait: '', paInactive: '' }

beforeAll(async () => {
  process.env.CRON_SECRET = 's3cret-s3cret-s3cret'
  org = await makeOrg('Relances')
  inactive = await makeOrg('Relances off')
  await prisma.organizationConfig.create({ data: { id: org.id, controlePermanentActive: true } })
  await prisma.organizationConfig.create({ data: { id: inactive.id, relancesConfig: { actives: false } } })
  metier = await makeUser('ANALYSTE', [{ id: org.id }])
  autre = await makeUser('ANALYSTE', [{ id: org.id }])
  rssi = await makeUser('ANALYSTE', [{ id: org.id, role: 'RSSI' }])
  horsOrg = await makeUser('ANALYSTE', [{ id: inactive.id, role: 'RSSI' }])

  const envoi = await prisma.questionnaireEnvoi.create({ data: { organizationId: org.id, titre: 'Justification accès', questions: [], echeance: jour(5), reponses: { create: { organizationId: org.id, repondantId: metier.id } } }, include: { reponses: true } })
  ids.reponse = envoi.reponses[0].id
  ids.preco = (await prisma.preconisation.create({ data: { organizationId: org.id, intitule: 'Tenir le registre', echeance: jour(-3), responsableId: metier.id } })).id
  const pa = (data: object) => prisma.planAction.create({ data: { organizationId: org.id, titre: 'PA', ...data } }).then(p => p.id)
  ids.paPreco = await pa({ titre: 'Registre à jour', echeance: jour(3), liens: { create: { type: 'PRECONISATION', targetId: ids.preco } } })
  ids.paPorteur = await pa({ titre: 'MFA partout', porteur: autre.email.toUpperCase(), createdAt: jour(-40) })
  ids.paOrphelin = await pa({ titre: 'Chiffrement', porteur: 'Prestataire externe', echeance: jour(-1) })
  ids.paFait = await pa({ titre: 'Terminé', statut: 'FAIT', echeance: jour(-10) })
  ids.paInactive = (await prisma.planAction.create({ data: { organizationId: inactive.id, titre: 'Hors relances', echeance: jour(-5) } })).id
})
beforeEach(() => { mail.send.mockClear() })
afterAll(async () => { await prisma.$disconnect() })

describe('cron des relances (vraie base)', () => {
  it('un seul e-mail par personne, regroupant questionnaire, préconisation et plan lié', async () => {
    expect((await cron(req())).status).toBe(200)
    const m = envoyesA(metier.email)
    expect(m).toHaveLength(1)
    expect(m[0].subject).toContain('3 élément(s)')
    expect(m[0].text).toContain('Questionnaire à répondre — Justification accès : échéance le')
    expect(m[0].text).toContain('Préconisation — Tenir le registre : en retard')
    expect(m[0].text).toContain('Plan d’action — Registre à jour : échéance le')
  })

  it('plan sans préconisation : porteur reconnu parmi les membres (e-mail), sinon la gouvernance ; jamais un plan terminé', async () => {
    // Relancé au premier passage (mock vidé) : on vérifie l'état persistant.
    const rows = await prisma.planAction.findMany({ where: { id: { in: [ids.paPorteur, ids.paOrphelin, ids.paFait, ids.paInactive] } }, select: { id: true, rappelLe: true } })
    const rappel = new Map(rows.map(r => [r.id, r.rappelLe]))
    expect(rappel.get(ids.paPorteur)).not.toBeNull()
    expect(rappel.get(ids.paOrphelin)).not.toBeNull()
    expect(rappel.get(ids.paFait)).toBeNull()
    expect(rappel.get(ids.paInactive)).toBeNull()
    // Rejouer sur un plan remis à zéro pour lire les destinataires.
    await prisma.planAction.updateMany({ where: { id: { in: [ids.paPorteur, ids.paOrphelin] } }, data: { rappelLe: null } })
    await cron(req())
    expect(envoyesA(autre.email).map(m => m.text).join()).toContain('MFA partout : toujours ouvert')
    expect(envoyesA(rssi.email).map(m => m.text).join()).toContain('Chiffrement : en retard')
    expect(envoyesA(horsOrg.email)).toHaveLength(0)
  })

  it('anti-doublon : un second passage le même jour ne relance plus', async () => {
    await cron(req())
    for (const u of [metier, autre, rssi]) expect(envoyesA(u.email)).toHaveLength(0)
    expect((await prisma.questionnaireReponse.findUniqueOrThrow({ where: { id: ids.reponse } })).rappelLe).not.toBeNull()
  })

  it('un questionnaire soumis n’est plus relancé', async () => {
    await prisma.questionnaireReponse.update({ where: { id: ids.reponse }, data: { statut: 'SOUMISE', rappelLe: null } })
    await cron(req())
    expect(envoyesA(metier.email)).toHaveLength(0)
    expect((await prisma.questionnaireReponse.findUniqueOrThrow({ where: { id: ids.reponse } })).rappelLe).toBeNull()
  })
})
