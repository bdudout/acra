import { resolveDemoSeedPasswords } from '../src/lib/demo-seed-policy'
/**
 * Jeu de démonstration CLUSIR 23/09/2026.
 *
 * Usage : npx tsx prisma/seed-demo-clusir.ts
 * Purge ciblée : npx tsx prisma/seed-demo-clusir.ts --purge
 *
 * Crée exclusivement l'organisation fictive « Novera Services — Démo CLUSIR »
 * et ses données. Ne pas utiliser sur une organisation client.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const ORG = { slug: 'demo-clusir-novera', nom: 'Novera Services — Démo CLUSIR' }
const ANALYSE = "Accès d'administration externalisés — données de facturation"
const passwords = resolveDemoSeedPasswords(process.env)

const users = [
  { email: 'analyste.novera@demo.acra', name: 'Alex Martin — Analyste', role: 'ANALYSTE' },
  { email: 'rssi.novera@demo.acra', name: 'Camille Leroy — RSSI', role: 'RSSI' },
  { email: 'direction.novera@demo.acra', name: 'Morgan Petit — Direction métier', role: 'DIRECTION_METIER' },
] as const

async function purge() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG.slug }, select: { id: true } })
  if (!org) return console.log('Aucun jeu CLUSIR à purger.')
  const marker = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { instanceMode: true } })
  if (marker?.instanceMode !== 'DEMO') throw new Error('Purge refusée hors DEMO.')
  await prisma.analyse.deleteMany({ where: { organizationId: org.id } })
  await prisma.organization.delete({ where: { id: org.id } })
  await prisma.user.deleteMany({ where: { email: { in: users.map(u => u.email) } } })
  console.log('Jeu CLUSIR purgé : organisation et comptes fictifs supprimés.')
}

async function main() {
  const marker = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { instanceMode: true } })
  if (marker?.instanceMode !== 'DEMO') throw new Error('Instance non marquée DEMO : seed refusé.')
  await prisma.configuration.update({ where: { id: 'global' }, data: { modulesPolicy: {
    registreRisques: 'FORCE_OFF', incidents: 'FORCE_OFF', controlePermanent: 'FORCE_OFF',
    auditInterne: 'FORCE_OFF', kri: 'FORCE_OFF', reglementaire: 'FORCE_OFF',
  } } })
  const org = await prisma.organization.upsert({
    where: { slug: ORG.slug },
    // Le chemin matérialisé contient des identifiants d'organisation, jamais le slug.
    // `getOrgConfig` s'en sert pour retrouver la chaîne de configuration héritée.
    create: { ...ORG, path: '/' },
    update: { nom: ORG.nom, actif: true },
  })
  await prisma.organization.update({ where: { id: org.id }, data: { path: `/${org.id}/` } })
  await prisma.organizationConfig.upsert({
    where: { id: org.id },
    create: { id: org.id, conformiteActive: true, controlePermanentActive: false, acceptationRisquesActive: true, derogationsActive: true },
    update: { conformiteActive: true, controlePermanentActive: false, acceptationRisquesActive: true, derogationsActive: true },
  })

  const ids: Record<string, string> = {}
  for (const u of users) {
    const passwordHash = await bcrypt.hash(passwords[u.role], 12)
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, role: u.role, passwordHash, isActive: true, emailVerified: new Date(), locale: 'fr' },
      update: { name: u.name, role: u.role, passwordHash, isActive: true, emailVerified: new Date(), mustChangePassword: false },
    })
    ids[u.role] = user.id
    {
      await prisma.orgMembership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        create: { userId: user.id, organizationId: org.id, role: u.role, scope: 'NODE' },
        update: { role: u.role, scope: 'NODE' },
      })
    }
  }

  const previous = await prisma.analyse.findFirst({ where: { organizationId: org.id, nom: ANALYSE }, select: { id: true } })
  if (previous) await prisma.analyse.delete({ where: { id: previous.id } })
  await prisma.controle.deleteMany({ where: { organizationId: org.id, intitule: 'Revue mensuelle des accès d’administration du prestataire' } })
  await prisma.referentiel.deleteMany({ where: { organizationId: org.id, code: 'PSSI-NOVERA' } })

  const analyse = await prisma.analyse.create({ data: {
    userId: ids.ANALYSTE, organizationId: org.id, nom: ANALYSE,
    description: "Analyse EBIOS RM d'un accès d'administration externalisé sur la plateforme de gestion commerciale et de facturation.",
    organisation: 'Novera Services', secteur: 'Services B2B', statut: 'SOUMIS', atelierCourant: 5,
    referentielMesures: 'ISO27001', mentionProtection: 'RESTREINTE', methodeVraisemblance: 'STANDARD',
  } })

  const vmId = 'clusir-vm-facturation'
  const erId = 'clusir-er-alteration'
  await prisma.cadrage.create({ data: {
    analyseId: analyse.id,
    perimetre: "Plateforme de gestion commerciale et de facturation, accès administrateur du prestataire Orion Admin, bastion d'administration, sauvegardes et restauration.",
    missions: "Émettre des factures fiables, suivre les commandes et assurer la continuité du service aux clients B2B.",
    tailleAnalyse: 'PME',
    valeursMetier: [{ id: vmId, nom: 'Production et facturation des services B2B', type: 'PROCESSUS', description: 'Création des commandes, calcul des prestations, émission et suivi des factures.', responsable: 'Direction des opérations', disponibilite: 3, integrite: 4, confidentialite: 3, tracabilite: 4 }],
    biensSupports: [
      { id: 'clusir-bs-erp', nom: 'Plateforme de gestion commerciale et de facturation', type: 'APPLICATION', description: 'Application métier hébergeant les commandes, référentiels clients et factures.', valeurMetierIds: [vmId] },
      { id: 'clusir-bs-bastion', nom: "Bastion d'administration et VPN prestataire", type: 'INFRASTRUCTURE', description: "Point d'accès privilégié utilisé par Orion Admin pour l'administration de la plateforme.", valeurMetierIds: [vmId] },
      { id: 'clusir-bs-backup', nom: 'Sauvegardes de la plateforme de facturation', type: 'SERVICE', description: 'Sauvegardes chiffrées et mécanisme de restauration des données métier.', valeurMetierIds: [vmId] },
    ],
    evenementsRedoutes: [{ id: erId, valeurMetierId: vmId, description: "Altération non détectée de données de commandes et de facturation nécessaires à l'activité.", impacts: ['Factures erronées', 'Fraude ou litige client', 'Interruption de la facturation', 'Reprise manuelle coûteuse'], gravite: 4 }],
    referentiels: [{ nom: 'ISO/IEC 27001', version: '2022', applicable: true, ecarts: "Accès d'administration externalisés à renforcer." }, { nom: 'NIST CSF', version: '2.0', applicable: true, ecarts: 'Gouvernance des accès privilégiés à formaliser.' }],
    socleSecurite: [
      { id: 'clusir-socle-1', mesure: 'Comptes administrateurs nominatifs', source: 'PSSI de démonstration', statut: 'PARTIEL' },
      { id: 'clusir-socle-2', mesure: 'Authentification multifacteur sur les accès distants', source: 'ISO/IEC 27001:2022', statut: 'PARTIEL' },
      { id: 'clusir-socle-3', mesure: 'Test de restauration des sauvegardes', source: 'PSSI de démonstration', statut: 'REALISE' },
    ],
  } })

  const source = await prisma.sourceRisque.create({ data: {
    analyseId: analyse.id, nom: 'Cybercriminel opportuniste', categorie: 'CYBERCRIMINEL',
    description: 'Groupe cherchant un accès privilégié réutilisable pour altérer des données, commettre une fraude ou exercer une extorsion.',
    motivationScore: 4, ressourcesScore: 3, activiteScore: 4, pertinence: 4, retenu: true,
    justification: "Les accès d'administration externalisés concentrent une capacité technique élevée et une forte valeur pour un attaquant.",
    objectifsVises: [{ id: 'clusir-ov-1', nom: 'Obtenir un accès privilégié pour altérer les données de facturation', description: 'Utiliser un accès administrateur compromis pour modifier des données métier sans détection immédiate.', priorite: 'P1', pertinenceOV: 4 }],
  } })

  await prisma.partiePrenante.createMany({ data: [
    { analyseId: analyse.id, nom: 'Orion Admin', nomCourt: 'ORION', type: 'PRESTATAIRE', description: "Prestataire fictif d'administration d'infrastructure avec accès à privilèges sur la plateforme métier.", dependance: 4, penetration: 3, maturite: 2, confiance: 2, exposition: 12, fiabilite: 4, critique: true },
    { analyseId: analyse.id, nom: 'Hébergeur de sauvegardes', nomCourt: 'BACKUP', type: 'FOURNISSEUR', description: 'Fournisseur fictif du stockage de sauvegarde chiffré.', dependance: 3, penetration: 2, maturite: 3, confiance: 3, exposition: 6, fiabilite: 9, critique: false },
  ] })
  const strategic = await prisma.scenarioStrategique.create({ data: {
    analyseId: analyse.id, nom: "Compromission d'un accès d'administration du prestataire Orion Admin", sourceRisqueId: source.id,
    objectifVise: 'Obtenir un accès privilégié pour altérer les données de facturation', evenementRedouteRef: erId, evenementsRedoutesIds: [erId],
    description: "Un cybercriminel compromet l'accès d'un intervenant Orion Admin, puis exploite les privilèges pour modifier des données de facturation.",
    cheminAttaque: [
      { etape: 1, partiePrenante: 'Orion Admin', action: "Hameçonnage ciblé d'un intervenant disposant d'un accès administrateur.", evenementIntermediaire: "Vol d'identifiants ou de jeton de session." },
      { etape: 2, partiePrenante: 'Orion Admin', action: 'Connexion au bastion ou au VPN avec un compte insuffisamment protégé.', evenementIntermediaire: 'Accès privilégié à la plateforme métier.' },
      { etape: 3, partiePrenante: 'Novera Services', action: 'Modification de paramètres ou de données de facturation sans détection immédiate.', evenementIntermediaire: 'Altération des données de commandes et de facturation.' },
    ],
    mesuresEcosysteme: [{ id: 'clusir-eco-1', partiePrenante: 'Orion Admin', mesure: "Accès nominatif, MFA et restriction d'origine réseau", type: 'PREVENTIVE', statut: 'EN_COURS' }, { id: 'clusir-eco-2', partiePrenante: 'Orion Admin', mesure: 'Revue mensuelle des accès du prestataire', type: 'DETECTIVE', statut: 'A_FAIRE' }],
    vraisemblance: 3, gravite: 4, niveauRisque: 12, retenu: true,
  } })
  const operational = await prisma.scenarioOperationnel.create({ data: {
    analyseId: analyse.id, scenarioStrategiqueId: strategic.id, nom: 'Altération de la base de facturation après compromission du bastion',
    description: 'Le compte compromis est utilisé pendant une fenêtre de maintenance pour modifier des enregistrements de facturation et masquer les traces immédiates.',
    actionsElementaires: [
      { id: 'clusir-ae-1', nom: "Vol d'identifiants d'un intervenant prestataire", type: 'HAMECONNAGE', bienSupport: "Bastion d'administration et VPN prestataire", vulnerabilite: 'MFA non systématique et comptes de secours insuffisamment revus.', description: "Obtention d'un compte ou d'un jeton de session utilisable à distance." },
      { id: 'clusir-ae-2', nom: "Ouverture d'une session privilégiée", type: 'ACCES', bienSupport: "Bastion d'administration et VPN prestataire", vulnerabilite: 'Sessions non enregistrées et droits trop larges.', description: "Connexion avec un compte ayant accès à l'administration de l'application." },
      { id: 'clusir-ae-3', nom: 'Modification des données de facturation', type: 'ALTERATION', bienSupport: 'Plateforme de gestion commerciale et de facturation', vulnerabilite: "Absence de contrôle d'intégrité et de rapprochement quotidien sur les opérations sensibles.", description: 'Modification ciblée de données avant détection par les équipes métier.' },
    ], vraisemblance: 3, gravite: 4,
  } })
  const risk = await prisma.risque.create({ data: {
    analyseId: analyse.id, scenarioOpId: operational.id, nom: 'Altération frauduleuse des données de facturation via un accès prestataire compromis',
    description: "Risque de fraude, de litige et d'interruption du processus de facturation après compromission d'un accès d'administration externe.",
    gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', evenementRedouteRef: erId,
    graviteResiduelle: 4, vraisemblanceResiduelle: 1, niveauResiduel: 4,
    justificationResiduelle: 'La gravité métier reste élevée. La vraisemblance cible diminue seulement après généralisation du MFA, maîtrise des sessions privilégiées, revue des accès et test de restauration.',
  } })
  await prisma.mesure.createMany({ data: [
    { analyseId: analyse.id, risqueId: risk.id, nom: 'Imposer des accès administrateurs nominatifs avec MFA', description: 'Supprimer les comptes partagés, appliquer le MFA et limiter les origines réseau autorisées.', type: 'TECHNIQUE', priorite: 1, statut: 'EN_COURS', responsable: 'Responsable infrastructure', entite: 'DSI', echeance: new Date('2026-10-15'), categorieEbios: 'PROTECTION', efficacite: 3 },
    { analyseId: analyse.id, risqueId: risk.id, nom: "Enregistrer et approuver les sessions d'administration du prestataire", description: "Passage obligatoire par le bastion, journalisation des sessions et validation préalable des opérations sensibles.", type: 'ORGANISATIONNELLE', priorite: 1, statut: 'A_FAIRE', responsable: 'RSSI', entite: 'Sécurité', echeance: new Date('2026-11-15'), categorieEbios: 'GOUVERNANCE', efficacite: 3 },
    { analyseId: analyse.id, risqueId: risk.id, nom: "Tester la restauration et le rapprochement d'intégrité des factures", description: 'Tester mensuellement la restauration et vérifier les opérations sensibles avant clôture de facturation.', type: 'CORRECTIVE', priorite: 2, statut: 'REALISE', responsable: 'Responsable applications', entite: 'DSI', echeance: new Date('2026-09-15'), categorieEbios: 'RESILIENCE', efficacite: 2 },
  ] })

  await prisma.referentiel.create({ data: { organizationId: org.id, code: 'PSSI-NOVERA', nom: 'PSSI de démonstration — Novera Services', type: 'PSSI', domaine: 'SECURITE_SI', version: '2026.1', createdBy: ids.RSSI, exigences: [{ ref: 'PSSI-ACC-01', nom: "Maîtrise des accès d'administration externes", description: "Les accès d'administration externes sont nominatifs, authentifiés fortement, revus périodiquement et tracés." }] } })
  await prisma.conformite.upsert({
    where: { organizationId_referentiel_entite: { organizationId: org.id, referentiel: 'PSSI-NOVERA', entite: '' } },
    create: { organizationId: org.id, referentiel: 'PSSI-NOVERA', entite: '', entries: [{ ref: 'PSSI-ACC-01', statut: 'partiel', commentaire: 'MFA à généraliser ; compte de secours partagé à supprimer.', traitement: 'plan_action' }] },
    update: { entries: [{ ref: 'PSSI-ACC-01', statut: 'partiel', commentaire: 'MFA à généraliser ; compte de secours partagé à supprimer.', traitement: 'plan_action' }] },
  })

  console.log(`Jeu CLUSIR prêt : ${ORG.nom}`)
  console.log(`Analyse : ${ANALYSE}`)
  console.log(`Comptes : ${users.map(u => u.email).join(', ')}`)

}

;(process.argv.includes('--purge') ? purge() : main())
  .catch(error => { console.error(error); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
