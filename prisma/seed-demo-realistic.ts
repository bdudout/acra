/**
 * seed-demo-realistic.ts — Jeu de démonstration RÉALISTE, ancré sur des données
 * PUBLIQUES (ENISA Threat Landscape 2025) pour trois organisations sectorielles :
 *   • StarBank (banque)          — DDoS (>75 % des incidents), fuites de données
 *     (64 %), rançongiciel, chevaux de Troie bancaires mobiles, tiers TIC (DORA).
 *   • GalaxyInsurance (assurance)— fuite de données assurés, rançongiciel, fraude,
 *     dépendance prestataires.
 *   • Hydroclinical (santé)      — rançongiciel (54 % des menaces santé), vol de
 *     dossiers patients (données #1 ciblées), DDoS hacktiviste, vulnérabilités.
 *
 * Idempotent. Lancement : `npm run db:seed:demo` (tsx). Ne crée QUE de la donnée de
 * démonstration (incidents, politique socle, contrôles, comptes de test sectoriels).
 * Sources : ENISA Threat Landscape 2025 (finance & santé).
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { buildPolitiqueDefaut } from '../src/lib/politique-defaut'
import { cleanReferentielInput } from '../src/lib/referentiel'
import { classifierIncident, type DoraCriteres } from '../src/lib/dora'

const prisma = new PrismaClient()
const PWD = 'Demo@Acra2026!'

interface IncidentSeed {
  intitule: string; description: string; joursAvant: number; detectionJours: number
  montantBrut: number; criteres: DoraCriteres
}

interface SectorSeed {
  nom: string; codePol: string; incidents: IncidentSeed[]
}

const SECTEURS: SectorSeed[] = [
  {
    nom: 'StarBank', codePol: 'PSSI-STARBANK',
    incidents: [
      { intitule: 'Attaque DDoS sur la banque en ligne', description: 'Indisponibilité du portail et de l\'application mobile pendant 4 h — vague DDoS volumétrique (source : mode opératoire ENISA, DDoS = majorité des incidents du secteur).', joursAvant: 12, detectionJours: 0, montantBrut: 80000, criteres: { serviceCritique: true, clientsAffectes: 50000, dureeIndispoMinutes: 240, reputation: true } },
      { intitule: 'Fuite de données clients (base CRM)', description: 'Exfiltration de données personnelles de clients suite à un accès non autorisé — les fuites de données concernent ~64 % des incidents bancaires (ENISA). Notification RGPD engagée.', joursAvant: 34, detectionJours: 3, montantBrut: 450000, criteres: { pertesDonnees: true, clientsAffectes: 120000, reputation: true } },
      { intitule: 'Rançongiciel sur un serveur de fichiers interne', description: 'Chiffrement d\'un serveur de partage bureautique, restauration depuis sauvegardes. Aucune donnée client compromise.', joursAvant: 58, detectionJours: 1, montantBrut: 120000, criteres: { pertesDonnees: true, dureeIndispoMinutes: 600 } },
      { intitule: 'Fraude au virement par hameçonnage (BEC)', description: 'Compromission d\'une boîte mail comptable, tentative de virement frauduleux détectée et bloquée par le contrôle 4-yeux.', joursAvant: 20, detectionJours: 0, montantBrut: 60000, criteres: { impactEconomique: 60000 } },
      { intitule: 'Cheval de Troie bancaire mobile détecté', description: 'Campagne de malware mobile visant les clients (type Medusa/BingoMod, cf. ENISA). Alerte clients et durcissement de l\'app.', joursAvant: 7, detectionJours: 0, montantBrut: 5000, criteres: {} },
      { intitule: 'Incident chez un prestataire cloud critique (tiers TIC)', description: 'Interruption de service chez un hébergeur cloud supportant une fonction critique — dépendance tiers TIC (DORA art. 28/chapitre V).', joursAvant: 45, detectionJours: 0, montantBrut: 30000, criteres: { serviceCritique: true, dureeIndispoMinutes: 90 } },
    ],
  },
  {
    nom: 'GalaxyInsurance', codePol: 'PSSI-GALAXY',
    incidents: [
      { intitule: 'Vol de données d\'assurés (sinistres et santé)', description: 'Exfiltration de dossiers de sinistres incluant des données de santé — actif le plus ciblé du secteur. Notification RGPD (données sensibles art. 9).', joursAvant: 28, detectionJours: 5, montantBrut: 380000, criteres: { pertesDonnees: true, clientsAffectes: 40000, reputation: true } },
      { intitule: 'Rançongiciel sur la plateforme de gestion des sinistres', description: 'Chiffrement de la plateforme métier, indisponibilité 8 h, activation du PRA.', joursAvant: 40, detectionJours: 1, montantBrut: 260000, criteres: { serviceCritique: true, dureeIndispoMinutes: 480 } },
      { intitule: 'Hameçonnage ciblé des gestionnaires', description: 'Campagne de spear-phishing visant les gestionnaires de contrats, une compromission de compte, fraude limitée.', joursAvant: 15, detectionJours: 2, montantBrut: 25000, criteres: { impactEconomique: 25000 } },
      { intitule: 'Panne d\'un prestataire de tarification (tiers TIC)', description: 'Indisponibilité d\'un service de scoring externe, dégradation temporaire de la souscription en ligne.', joursAvant: 9, detectionJours: 0, montantBrut: 12000, criteres: { dureeIndispoMinutes: 120 } },
    ],
  },
  {
    nom: 'Hydroclinical', codePol: 'PSSI-HYDRO',
    incidents: [
      { intitule: 'Rançongiciel bloquant le SIH (dossier patient informatisé)', description: 'Chiffrement du système d\'information hospitalier, bascule en mode dégradé papier pendant 24 h — le rançongiciel représente 54 % des menaces santé (ENISA).', joursAvant: 30, detectionJours: 0, montantBrut: 300000, criteres: { serviceCritique: true, pertesDonnees: true, dureeIndispoMinutes: 1440, reputation: true } },
      { intitule: 'Vol de dossiers patients (exfiltration)', description: 'Exfiltration de dossiers médicaux — les données patients sont l\'actif #1 ciblé (30 %). Notification RGPD + information des patients.', joursAvant: 52, detectionJours: 7, montantBrut: 220000, criteres: { pertesDonnees: true, clientsAffectes: 25000, reputation: true } },
      { intitule: 'Attaque DDoS hacktiviste sur le portail patient', description: 'Indisponibilité du portail de prise de rendez-vous suite à une attaque revendiquée par un groupe hacktiviste.', joursAvant: 11, detectionJours: 0, montantBrut: 15000, criteres: { dureeIndispoMinutes: 180 } },
      { intitule: 'Vulnérabilité critique sur un équipement biomédical', description: 'CVE critique non corrigée sur un dispositif connecté (80 % des incidents santé liés à des vulnérabilités logicielles/matérielles). Correctif appliqué avant exploitation.', joursAvant: 5, detectionJours: 0, montantBrut: 3000, criteres: {} },
    ],
  },
]

async function main() {
  const hash = await bcrypt.hash(PWD, 10)
  const now = Date.now()

  for (const sec of SECTEURS) {
    const org = await prisma.organization.findFirst({ where: { nom: sec.nom }, select: { id: true } })
    if (!org) { console.log(`⤫ organisation absente: ${sec.nom} (ignorée)`); continue }
    const orgId = org.id

    // 1) Modules activés + seuils DORA par défaut
    await prisma.organizationConfig.upsert({
      where: { id: orgId },
      update: { registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true, auditInterneActive: true, kriActive: true, reglementaireActive: true, conformiteActive: true },
      create: { id: orgId, registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true, auditInterneActive: true, kriActive: true, reglementaireActive: true, conformiteActive: true },
    })

    // 2) Comptes de démonstration sectoriels (RSSI, CONTROLEUR, AUDITEUR)
    const slug = sec.nom.toLowerCase()
    for (const role of ['RSSI', 'CONTROLEUR', 'AUDITEUR'] as const) {
      const email = `${role.toLowerCase()}.${slug}@demo.acra`
      const u = await prisma.user.upsert({
        where: { email },
        update: { role, passwordHash: hash, isActive: true, mustChangePassword: false },
        create: { email, name: `${role} ${sec.nom}`, role, passwordHash: hash, isActive: true, mustChangePassword: false, locale: 'fr' },
      })
      const ex = await prisma.orgMembership.findFirst({ where: { userId: u.id, organizationId: orgId } })
      if (ex) await prisma.orgMembership.update({ where: { id: ex.id }, data: { role } })
      else await prisma.orgMembership.create({ data: { userId: u.id, organizationId: orgId, role, scope: 'NODE' } })
    }
    const rssi = await prisma.user.findUnique({ where: { email: `rssi.${slug}@demo.acra` }, select: { id: true } })

    // 3) Politique de sécurité par défaut (socle DORA + ISO), code sectoriel
    const pol = cleanReferentielInput({ ...buildPolitiqueDefaut(), code: sec.codePol, nom: `Politique de sécurité — ${sec.nom}` })
    const existePol = await prisma.referentiel.findFirst({ where: { organizationId: orgId, code: pol.code }, select: { id: true } })
    if (!existePol) {
      await prisma.referentiel.create({ data: {
        organizationId: orgId, createdBy: rssi?.id ?? null,
        code: pol.code, nom: pol.nom, type: pol.type, version: pol.version, description: pol.description,
        exigences: pol.exigences as unknown as object, missions: pol.missions as unknown as object,
      } })
    }

    // 4) Incidents réalistes (idempotents par intitulé), classés DORA
    let created = 0
    for (const inc of sec.incidents) {
      const dup = await prisma.incident.findFirst({ where: { organizationId: orgId, intitule: inc.intitule }, select: { id: true } })
      if (dup) continue
      const evalDora = classifierIncident(inc.criteres)
      const dateSurv = new Date(now - inc.joursAvant * 86_400_000)
      const dateDet = new Date(dateSurv.getTime() + inc.detectionJours * 86_400_000)
      if (!rssi) break // le déclarant est requis
      await prisma.incident.create({ data: {
        organizationId: orgId, declarantId: rssi.id,
        intitule: inc.intitule, description: inc.description,
        dateSurvenance: dateSurv, dateDetection: dateDet,
        montantBrut: inc.montantBrut, statut: 'QUALIFIE',
        qualifiePar: rssi?.id ?? null, qualifieLe: new Date(),
        doraCriteres: inc.criteres as unknown as object,
        doraClasseMajeurLe: evalDora.classe === 'MAJEUR' ? dateDet : null,
      } })
      created++
    }
    console.log(`✓ ${sec.nom} : modules ON · 3 comptes · politique ${pol.code} · ${created} incidents (dont majeurs DORA)`)
  }
  console.log(`\nComptes de démonstration : rssi.<org>@demo.acra / controleur.<org>@demo.acra / auditeur.<org>@demo.acra — mot de passe ${PWD}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
