/**
 * Relances étendues sur une vraie base, toutes dans l'e-mail de synthèse quotidien : contrat TIC à
 * 90 jours, test de résilience, KRI sans mesure, document à revoir (version en vigueur seulement),
 * campagne avec des contrôles non exécutés, mission d'audit non démarrée, échéance d'analyse,
 * invitation non acceptée, acceptation des risques résiduels — avec le bon destinataire.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const mail = vi.hoisted(() => ({ send: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/email', () => ({ sendEmail: mail.send }))

import { executerRelances } from '@/lib/relances.server'

const J = 86_400_000
const jour = (n: number) => new Date(Date.now() + n * J)
type Envoye = { to: string; subject: string; text: string }
let captures: Envoye[] = []
const texte = (u: { email: string }) => captures.filter(m => m.to === u.email).map(m => m.text).join('\n')

let rssi: { id: string; email: string }, dm: { email: string }, auditeur: { email: string }, controleur: { email: string }
let auteur: { id: string; email: string }, porteurKri: { email: string }

beforeAll(async () => {
  const org = await makeOrg('Relances étendues')
  await prisma.organizationConfig.create({ data: {
    id: org.id, reglementaireActive: true, kriActive: true, conformiteActive: true, controlePermanentActive: true,
    auditInterneActive: true, acceptationRisquesActive: true, secondeLigneActive: true,
  } })
  rssi = await makeUser('ANALYSTE', [{ id: org.id, role: 'RSSI' }])
  dm = await makeUser('ANALYSTE', [{ id: org.id, role: 'DIRECTION_METIER' }])
  auditeur = await makeUser('ANALYSTE', [{ id: org.id, role: 'AUDITEUR' }])
  controleur = await makeUser('ANALYSTE', [{ id: org.id, role: 'CONTROLEUR' }])
  auteur = await makeUser('ANALYSTE', [{ id: org.id }])
  porteurKri = await makeUser('ANALYSTE', [{ id: org.id }])
  const o = { organizationId: org.id }

  await prisma.arrangementTic.create({ data: { ...o, reference: 'C-042', prestataireNom: 'CloudCo', typeService: 'CLOUD', criticite: 'CRITIQUE', dateFin: jour(60) } as never })
  await prisma.arrangementTic.create({ data: { ...o, reference: 'C-100', prestataireNom: 'Lointain', typeService: 'CLOUD', criticite: 'CRITIQUE', dateFin: jour(200) } as never })
  await prisma.testResilience.create({ data: { ...o, annee: 2026, intitule: 'Test de bascule PCA', type: 'SCENARIO', testeur: 'Interne', datePrevue: jour(-3) } as never })
  await prisma.kri.create({ data: { ...o, intitule: 'Taux de phishing', frequence: 'MENSUEL', responsable: porteurKri.email, createdAt: jour(-90) } as never })
  const v1 = await prisma.document.create({ data: { ...o, titre: 'Politique v1', type: 'POLITIQUE', portee: 'ORG', fichierNom: 'a.pdf', mime: 'application/pdf', taille: 1, checksum: 'x', storageKey: 'k1', dateRevue: jour(-10), uploadedBy: auteur.id } as never })
  await prisma.document.create({ data: { ...o, titre: 'Politique v2', type: 'POLITIQUE', portee: 'ORG', fichierNom: 'b.pdf', mime: 'application/pdf', taille: 1, checksum: 'y', storageKey: 'k2', dateRevue: jour(5), uploadedBy: auteur.id, remplaceId: v1.id } as never })
  const c1 = await prisma.controle.create({ data: { ...o, intitule: 'Revue des accès' } })
  const c2 = await prisma.controle.create({ data: { ...o, intitule: 'Sauvegardes' } })
  await prisma.controleExecution.create({ data: { controleId: c1.id, organizationId: org.id, resultat: 'CONFORME', dateRealisation: jour(-5), executantId: 'x' } })
  await prisma.campagneControle.create({ data: { ...o, intitule: 'Campagne T4', statut: 'EN_COURS', dateDebut: jour(-20), dateFin: jour(4), controleIds: [c1.id, c2.id] } })
  await prisma.campagneControle.create({ data: { ...o, intitule: 'Campagne complète', statut: 'EN_COURS', dateDebut: jour(-20), dateFin: jour(4), controleIds: [c1.id] } })
  await prisma.auditMission.create({ data: { ...o, intitule: 'Audit IAM', statut: 'PLANIFIEE', dateDebut: jour(-7) } })
  await prisma.analyse.create({ data: { ...o, nom: 'Analyse paiements', userId: auteur.id, statut: 'EN_COURS', dateEcheance: jour(6) } })
  await prisma.analyse.create({ data: { ...o, nom: 'Analyse CRM', userId: auteur.id, statut: 'APPROUVE', approuveLe: jour(-10), risquesResiduelsStatut: 'EN_ATTENTE' } })
  await prisma.orgInvitation.create({ data: { ...o, email: 'nouveau@test.acra', role: 'ANALYSTE', scope: 'NODE', tokenHash: `h-${Date.now()}`, invitedById: rssi.id, expiresAt: jour(2) } })

  mail.send.mockClear()
  await executerRelances()
  captures = (mail.send.mock.calls as unknown as [Envoye][]).map(c => c[0])
})
afterAll(async () => { await prisma.$disconnect() })

describe('relances étendues (vraie base)', () => {
  it('gouvernance : contrat TIC à 90 jours (pas celui à 200 jours), test de résilience en retard, invitation à expirer', () => {
    const t = texte(rssi)
    expect(t).toContain('Contrat TIC arrivant à échéance — CloudCo — C-042 : échéance le')
    expect(t).not.toContain('Lointain')
    expect(t).toContain('Test de résilience planifié — Test de bascule PCA : en retard')
    expect(t).toContain('Invitation non acceptée — nouveau@test.acra : échéance le')
    expect(captures.filter(m => m.to === rssi.email)).toHaveLength(1)
  })
  it('KRI sans mesure → son responsable ; document en vigueur → son auteur ; échéance d’analyse → son auteur', () => {
    expect(texte(porteurKri)).toContain('KRI sans mesure récente — Taux de phishing : en retard')
    const a = texte(auteur)
    expect(a).toContain('Document à revoir — Politique v2 : échéance le')
    expect(a).not.toContain('Politique v1')
    expect(a).toContain('Analyse de risques — Analyse paiements : échéance le')
  })
  it('2ᵉ ligne : campagne avec un contrôle non exécuté seulement ; audit : mission non démarrée ; direction métier : risques à accepter', () => {
    expect(texte(controleur)).toContain('Campagne de contrôle avec des contrôles non exécutés — Campagne T4')
    expect(texte(controleur)).not.toContain('Campagne complète')
    expect(texte(auditeur)).toContain('Mission d’audit planifiée — Audit IAM : en retard')
    expect(texte(dm)).toContain('Risques résiduels à accepter — Analyse CRM : en attente depuis le')
  })
  it('anti-doublon : rien au second passage', async () => {
    mail.send.mockClear()
    await executerRelances()
    for (const u of [rssi, dm, auditeur, controleur, auteur, porteurKri]) expect((mail.send.mock.calls as unknown as [Envoye][]).filter(c => c[0].to === u.email)).toHaveLength(0)
  })
})
