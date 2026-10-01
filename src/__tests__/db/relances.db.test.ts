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

describe('relances des décisions en attente (vraie base)', () => {
  let groupe: { id: string }, filiale: { id: string }, sansDerog: { id: string }
  let rm: { id: string; email: string }, rssiA: { id: string; email: string }, rssiB: { id: string; email: string }, rssiGroupe: { id: string; email: string }
  let dm: { id: string; email: string }, ctrl: { id: string; email: string }, analyste: { id: string; email: string }, restreint: { id: string; email: string }
  // Le beforeEach du fichier vide le mock : on capture les e-mails du passage initial.
  let captures: Envoye[] = []
  const textes = (u: { email: string }) => captures.filter(m => m.to === u.email).map(m => m.text).join('\n')

  beforeAll(async () => {
    groupe = await makeOrg('Groupe')
    const f = await makeOrg('Filiale')
    filiale = await prisma.organization.update({ where: { id: f.id }, data: { path: `/${groupe.id}/${f.id}/`, parentId: groupe.id } })
    sansDerog = await makeOrg('Sans dérogations')
    await prisma.organizationConfig.create({ data: { id: filiale.id, controlePermanentActive: true, derogationsActive: true, secondeLigneActive: true } })
    await prisma.organizationConfig.create({ data: { id: sansDerog.id, derogationsActive: false } })
    rm = await makeUser('ANALYSTE', [{ id: filiale.id, role: 'RISK_MANAGER' }])
    rssiA = await makeUser('ANALYSTE', [{ id: filiale.id, role: 'RSSI' }])
    rssiB = await makeUser('ANALYSTE', [{ id: filiale.id, role: 'RSSI' }])
    rssiGroupe = await prisma.user.create({ data: { email: `rssi-groupe-${Date.now()}@test.acra`, name: 'RSSI groupe', role: 'ANALYSTE', memberships: { create: { organizationId: groupe.id, role: 'RSSI', scope: 'SUBTREE' } } } })
    dm = await makeUser('ANALYSTE', [{ id: filiale.id, role: 'DIRECTION_METIER' }])
    ctrl = await makeUser('ANALYSTE', [{ id: filiale.id, role: 'CONTROLEUR' }])
    analyste = await makeUser('ANALYSTE', [{ id: filiale.id }, { id: sansDerog.id, role: 'RSSI' }])
    restreint = await makeUser('ANALYSTE', [{ id: filiale.id, role: 'RISK_MANAGER' }])

    await prisma.preconisation.create({ data: { organizationId: filiale.id, intitule: 'Revue des comptes faite', statut: 'RESOLU', realiseeLe: jour(-8), responsableId: analyste.id, createdById: ctrl.id } })
    await prisma.preconisation.create({ data: { organizationId: filiale.id, intitule: 'Trop récente', statut: 'RESOLU', realiseeLe: jour(-2), responsableId: analyste.id, createdById: ctrl.id } })
    const a = await prisma.analyse.create({ data: { nom: 'Analyse paiements', userId: analyste.id, organizationId: filiale.id, statut: 'SOUMIS', soumisLe: jour(-8) } })
    await prisma.analyseAcces.create({ data: { analyseId: a.id, userId: restreint.id, permission: 'LECTURE' } })
    await prisma.analyse.create({ data: { nom: 'Projet CRM', userId: analyste.id, organizationId: filiale.id, statut: 'SOUMIS', methode: 'PROJET_360', soumisLe: jour(-9), approbations: [{ role: 'RISK_MANAGER', userId: rm.id, le: jour(-5).toISOString() }] } })
    const derog = (data: object) => prisma.derogation.create({ data: { organizationId: filiale.id, portee: 'SOCLE', motif: 'm', mesuresCompensatoires: 'c', demandeurId: analyste.id, createdAt: jour(-20), ...data } as never })
    await derog({ intitule: 'TLS 1.0 legacy', statut: 'DEMANDEE', demandeurId: rssiA.id })
    await derog({ intitule: 'Mots de passe partagés', statut: 'DOUBLE_REGARD', avisRssiPar: rssiB.id, avisRssiLe: jour(-10) })
    await derog({ intitule: 'Sauvegarde hors site', statut: 'VALIDATION_METIER', avisRssiPar: rssiB.id, avisRssiLe: jour(-15), doubleRegardLe: jour(-9) })
    await derog({ intitule: 'Avis tout récent', statut: 'DOUBLE_REGARD', avisRssiPar: rssiB.id, avisRssiLe: jour(-1) })
    await prisma.derogation.create({ data: { organizationId: sansDerog.id, portee: 'SOCLE', intitule: 'Module inactif', motif: 'm', mesuresCompensatoires: 'c', demandeurId: rm.id, statut: 'DEMANDEE', createdAt: jour(-30) } })
    mail.send.mockClear()
    await cron(req())
    captures = (mail.send.mock.calls as unknown as [Envoye][]).map(c => c[0])
  })

  it('préconisation réalisée à vérifier → le contrôleur qui l’a posée, jamais le responsable ; pas avant 7 jours', () => {
    expect(textes(ctrl)).toContain('Préconisation réalisée à vérifier — Revue des comptes faite : en attente depuis le')
    expect(textes(ctrl)).not.toContain('Trop récente')
    expect(textes(analyste)).not.toContain('Revue des comptes faite')
  })
  it('analyse soumise → RSSI et Risk Manager, sauf l’auteur et un accès restreint ; projet 360 → rôle manquant (RSSI)', () => {
    for (const u of [rm, rssiA, rssiB]) expect(textes(u)).toContain('Analyse à approuver — Analyse paiements')
    expect(textes(restreint)).not.toContain('Analyse paiements')
    expect(textes(analyste)).not.toContain('Analyse paiements')
    expect(textes(rssiA)).toContain('Projet 360 à approuver — Projet CRM')
    expect(textes(rm)).not.toContain('Projet CRM')
  })
  it('dérogations : avis RSSI (≠ demandeur), double regard (RSSI groupe inclus, ≠ premier avis), validation métier ; module inactif ignoré', () => {
    expect(textes(rssiB)).toContain('Dérogation : avis RSSI attendu — TLS 1.0 legacy')
    expect(textes(rssiA)).not.toContain('TLS 1.0 legacy')
    expect(textes(rssiGroupe)).toContain('Dérogation : double regard attendu — Mots de passe partagés')
    expect(textes(rssiB)).not.toContain('Mots de passe partagés')
    expect(textes(dm)).toContain('Dérogation : validation métier attendue — Sauvegarde hors site : en attente depuis le')
    expect(textes(rssiGroupe)).not.toContain('Avis tout récent')
    expect(textes(analyste)).not.toContain('Module inactif')
  })
  it('anti-doublon : rien au second passage', async () => {
    mail.send.mockClear()
    await cron(req())
    for (const u of [ctrl, rm, rssiA, rssiB, rssiGroupe, dm]) expect(envoyesA(u.email)).toHaveLength(0)
  })
})

describe('un seul e-mail de synthèse par personne, toutes sources et organisations confondues (vraie base)', () => {
  it('questionnaire, recommandation d’audit, contrôle à exécuter et dérogation qui expire, sur deux organisations ⇒ un e-mail', async () => {
    const banque = await makeOrg('Banque'), assurance = await makeOrg('Assurance')
    await prisma.organizationConfig.create({ data: { id: banque.id, controlePermanentActive: true, auditInterneActive: true } })
    await prisma.organizationConfig.create({ data: { id: assurance.id, controlePermanentActive: true, derogationsActive: true } })
    const rssi = await makeUser('ANALYSTE', [{ id: banque.id, role: 'RSSI' }, { id: assurance.id, role: 'RSSI' }])
    const demandeur = await makeUser('ANALYSTE', [{ id: assurance.id }])
    await prisma.questionnaireEnvoi.create({ data: { organizationId: banque.id, titre: 'Habilitations', questions: [], echeance: jour(3), reponses: { create: { organizationId: banque.id, repondantId: rssi.id } } } })
    const mission = await prisma.auditMission.create({ data: { organizationId: banque.id, intitule: 'Audit IAM' } })
    await prisma.auditConstat.create({ data: { missionId: mission.id, organizationId: banque.id, intitule: 'MFA absent', statut: 'OUVERT', echeance: jour(-4) } })
    await prisma.controle.create({ data: { organizationId: assurance.id, intitule: 'Revue des sauvegardes', periodicite: 'MENSUEL', createdAt: jour(-60) } })
    await prisma.derogation.create({ data: { organizationId: assurance.id, portee: 'SOCLE', intitule: 'TLS 1.0', motif: 'm', mesuresCompensatoires: 'c', demandeurId: demandeur.id, statut: 'ACTIVE', dateDebut: jour(-80), dateFin: jour(10) } })

    mail.send.mockClear()
    const res = await (await cron(req())).json()
    const mails = envoyesA(rssi.email)
    expect(mails).toHaveLength(1)
    expect(mails[0].subject).toBe('[ACRA] 4 élément(s) à traiter')
    for (const ligne of ['· Questionnaire à répondre — Habilitations', '· Recommandation d’audit — MFA absent (Audit IAM) : en retard', '· Contrôle à exécuter — Revue des sauvegardes', '· Dérogation arrivant à expiration — TLS 1.0']) expect(mails[0].text).toContain(ligne)
    // Le plus urgent d'abord (retards en tête).
    expect(mails[0].text.indexOf('MFA absent')).toBeLessThan(mails[0].text.indexOf('Habilitations'))
    // Le demandeur de la dérogation la reçoit aussi, dans son propre e-mail de synthèse.
    expect(envoyesA(demandeur.email)).toHaveLength(1)
    expect(res.reminded).toMatchObject({ constatsAudit: expect.any(Number), controles: expect.any(Number), derogationsExpiration: expect.any(Number) })

    // Les anciennes tâches sont des alias du même passage, idempotent : aucun second e-mail.
    mail.send.mockClear()
    const { POST: ancienne } = await import('@/app/api/cron/audit-rappels/route')
    expect(await (await ancienne(req())).json()).toMatchObject({ fusionneDans: 'relances' })
    expect(envoyesA(rssi.email)).toHaveLength(0)
  })
})

