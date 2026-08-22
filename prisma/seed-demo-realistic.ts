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
  console.log('\nAnalyses EBIOS RM complètes (5 ateliers) :')
  for (const spec of ANALYSES_EBIOS) await creerAnalyseEbios(spec)

  console.log(`\nComptes de démonstration : rssi.<org>@demo.acra / controleur.<org>@demo.acra / auditeur.<org>@demo.acra — mot de passe ${PWD}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

// ─── Analyses EBIOS RM complètes par secteur (5 ateliers) ────────────────────
// Contenu réaliste ancré sur les menaces sectorielles (ENISA / panoramas ANSSI).
// Chaque analyse couvre : cadrage + valeurs métier (DICT) + biens supports +
// événements redoutés (A1) ; sources de risque + objectifs visés (A2) ; parties
// prenantes + scénarios stratégiques (A3) ; scénarios opérationnels (A4) ;
// risques + mesures (A5).

interface VM { cle: string; nom: string; type: string; description: string; responsable: string; d: number; i: number; c: number }
interface BS { cle: string; nom: string; type: string; description: string; vm: string[] }
interface ER { cle: string; vm: string; description: string; impacts: string[]; gravite: number }
interface SR { cle: string; nom: string; categorie: string; description: string; m: number; r: number; a: number; pertinence: number; objectifs: { nom: string; description: string; priorite: string; pertinenceOV: number }[] }
interface PP { cle: string; nom: string; type: string; description: string; dep: number; pen: number; mat: number; conf: number; critique?: boolean }
interface SS { cle: string; nom: string; sr: string; objectifVise: string; description: string; er: string; chemin: { etape: number; partiePrenante: string; action: string; evenementIntermediaire: string }[]; v: number; g: number }
interface SO { cle: string; nom: string; ss: string; description: string; actions: { nom: string; type: string; bienSupport: string; vulnerabilite: string; description: string }[]; v: number; g: number }
interface RQ { cle: string; nom: string; so: string; description: string; g: number; v: number; strategie: string; erRef: string; gr: number; vr: number; justif: string }
interface MS { nom: string; rq: string; description: string; type: string; priorite: number; statut: string; responsable: string; entite: string; cat: string; efficacite: number }
interface AnalyseSpec {
  orgNom: string; nom: string; secteur: string; referentielMesures: string; perimetre: string; missions: string
  vms: VM[]; bss: BS[]; ers: ER[]; referentiels: { nom: string; version: string; applicable: boolean; ecarts: string }[]
  socle: { mesure: string; source: string; statut: string }[]
  srs: SR[]; pps: PP[]; sss: SS[]; sos: SO[]; rqs: RQ[]; mss: MS[]
}

const rid = () => Math.random().toString(36).slice(2, 10)

async function creerAnalyseEbios(spec: AnalyseSpec) {
  const org = await prisma.organization.findFirst({ where: { nom: spec.orgNom }, select: { id: true } })
  if (!org) return
  const orgId = org.id
  const rssi = await prisma.user.findUnique({ where: { email: `rssi.${spec.orgNom.toLowerCase()}@demo.acra` }, select: { id: true } })
  if (!rssi) return
  const exist = await prisma.analyse.findFirst({ where: { organizationId: orgId, nom: spec.nom }, select: { id: true } })
  if (exist) { console.log(`  = analyse « ${spec.nom} » déjà présente`); return }

  const analyse = await prisma.analyse.create({ data: {
    userId: rssi.id, organizationId: orgId, nom: spec.nom, secteur: spec.secteur,
    description: `Analyse EBIOS RM — ${spec.secteur}`, statut: 'SOUMIS', atelierCourant: 5,
    referentielMesures: spec.referentielMesures, mentionProtection: 'RESTREINTE',
  } })

  // ids stables (cle → id JSON)
  const vmId: Record<string, string> = {}; spec.vms.forEach(v => vmId[v.cle] = rid())
  const bsId: Record<string, string> = {}; spec.bss.forEach(b => bsId[b.cle] = rid())
  const erId: Record<string, string> = {}; spec.ers.forEach(e => erId[e.cle] = rid())

  await prisma.cadrage.create({ data: {
    analyseId: analyse.id, perimetre: spec.perimetre, missions: spec.missions, tailleAnalyse: 'ETI_GE',
    valeursMetier: spec.vms.map(v => ({ id: vmId[v.cle], nom: v.nom, type: v.type, description: v.description, responsable: v.responsable, missionRef: spec.secteur, disponibilite: v.d, integrite: v.i, confidentialite: v.c })),
    biensSupports: spec.bss.map(b => ({ id: bsId[b.cle], nom: b.nom, type: b.type, description: b.description, valeurMetierIds: b.vm.map(c => vmId[c]) })),
    evenementsRedoutes: spec.ers.map(e => ({ id: erId[e.cle], valeurMetierId: vmId[e.vm], description: e.description, impacts: e.impacts, gravite: e.gravite })),
    referentiels: spec.referentiels,
    socleSecurite: spec.socle.map(s => ({ id: rid(), mesure: s.mesure, source: s.source, statut: s.statut })),
  } })

  const srId: Record<string, string> = {}
  for (const s of spec.srs) {
    srId[s.cle] = rid()
    await prisma.sourceRisque.create({ data: {
      id: srId[s.cle], analyseId: analyse.id, nom: s.nom, categorie: s.categorie as never, description: s.description,
      motivationScore: s.m, ressourcesScore: s.r, activiteScore: s.a, pertinence: s.pertinence, retenu: true,
      objectifsVises: s.objectifs.map(o => ({ id: rid(), nom: o.nom, description: o.description, priorite: o.priorite, pertinenceOV: o.pertinenceOV })),
    } })
  }

  for (const p of spec.pps) {
    await prisma.partiePrenante.create({ data: {
      analyseId: analyse.id, nom: p.nom, type: p.type as never, description: p.description,
      dependance: p.dep, penetration: p.pen, maturite: p.mat, confiance: p.conf,
      exposition: p.dep * p.pen, fiabilite: p.mat * p.conf, critique: !!p.critique,
    } })
  }

  const ssId: Record<string, string> = {}
  for (const s of spec.sss) {
    ssId[s.cle] = rid()
    await prisma.scenarioStrategique.create({ data: {
      id: ssId[s.cle], analyseId: analyse.id, nom: s.nom, sourceRisqueId: srId[s.sr], objectifVise: s.objectifVise,
      description: s.description, evenementRedouteRef: erId[s.er], cheminAttaque: s.chemin,
      vraisemblance: s.v, gravite: s.g, niveauRisque: s.v * s.g, retenu: true,
    } })
  }

  const soId: Record<string, string> = {}
  for (const o of spec.sos) {
    soId[o.cle] = rid()
    await prisma.scenarioOperationnel.create({ data: {
      id: soId[o.cle], analyseId: analyse.id, nom: o.nom, scenarioStrategiqueId: ssId[o.ss], description: o.description,
      actionsElementaires: o.actions.map(a => ({ id: rid(), nom: a.nom, type: a.type, bienSupport: a.bienSupport, vulnerabilite: a.vulnerabilite, description: a.description })),
      vraisemblance: o.v, gravite: o.g,
    } })
  }

  const rqId: Record<string, string> = {}
  for (const r of spec.rqs) {
    rqId[r.cle] = rid()
    await prisma.risque.create({ data: {
      id: rqId[r.cle], analyseId: analyse.id, nom: r.nom, scenarioOpId: soId[r.so], description: r.description,
      gravite: r.g, vraisemblance: r.v, niveauRisque: r.g * r.v, strategie: r.strategie as never, evenementRedouteRef: r.erRef,
      graviteResiduelle: r.gr, vraisemblanceResiduelle: r.vr, niveauResiduel: r.gr * r.vr, justificationResiduelle: r.justif,
    } })
  }

  for (const m of spec.mss) {
    await prisma.mesure.create({ data: {
      analyseId: analyse.id, risqueId: rqId[m.rq], nom: m.nom, description: m.description, type: m.type as never,
      priorite: m.priorite, statut: m.statut as never, responsable: m.responsable, entite: m.entite, categorieEbios: m.cat, efficacite: m.efficacite,
    } })
  }
  console.log(`  ✓ analyse EBIOS « ${spec.nom} » (${spec.vms.length} VM · ${spec.srs.length} SR · ${spec.sss.length} SS · ${spec.rqs.length} risques · ${spec.mss.length} mesures)`)
}

const ANALYSES_EBIOS: AnalyseSpec[] = [
  // ══════════════ BANQUE (StarBank) ══════════════
  {
    orgNom: 'StarBank', nom: 'Analyse EBIOS RM — Banque en ligne & paiements', secteur: 'Banque / Finance', referentielMesures: 'DORA',
    perimetre: 'Services de banque en ligne, application mobile, système de paiement et cœur bancaire ; prestataires TIC critiques.',
    missions: 'Fournir des services bancaires et de paiement disponibles, intègres et confidentiels à ses clients particuliers et entreprises.',
    vms: [
      { cle: 'paiement', nom: 'Système de paiement et virements', type: 'PROCESSUS', description: 'Exécution des virements SEPA/instantanés et opérations de paiement carte.', responsable: 'Direction des Paiements', d: 4, i: 4, c: 3 },
      { cle: 'banqueligne', nom: 'Banque en ligne et application mobile', type: 'SERVICE', description: 'Canaux digitaux d\'accès aux comptes clients (web + mobile).', responsable: 'Direction Digitale', d: 4, i: 3, c: 4 },
      { cle: 'donneesclients', nom: 'Données clients et KYC', type: 'INFORMATION', description: 'Données personnelles, comptes, historique de transactions, dossiers KYC/LCB-FT.', responsable: 'DPO / Conformité', d: 3, i: 4, c: 4 },
    ],
    bss: [
      { cle: 'corebank', nom: 'Cœur bancaire (core banking)', type: 'LOGICIEL', description: 'Progiciel de gestion des comptes et transactions.', vm: ['paiement', 'donneesclients'] },
      { cle: 'portail', nom: 'Portail web & API mobile', type: 'LOGICIEL', description: 'Front-end client + API exposées sur Internet.', vm: ['banqueligne'] },
      { cle: 'cloud', nom: 'Hébergement cloud (prestataire TIC)', type: 'RESEAU', description: 'Infrastructure cloud d\'un tiers TIC critique (DORA).', vm: ['banqueligne', 'paiement'] },
      { cle: 'iam', nom: 'Gestion des identités et accès', type: 'LOGICIEL', description: 'IAM / MFA des clients et des collaborateurs.', vm: ['banqueligne', 'donneesclients'] },
    ],
    ers: [
      { cle: 'indispo', vm: 'banqueligne', description: 'Indisponibilité prolongée de la banque en ligne et des paiements', impacts: ['Clients privés d\'accès à leurs comptes', 'Perte de revenus et pénalités', 'Atteinte à la réputation et couverture médiatique', 'Notification DORA (incident majeur)'], gravite: 4 },
      { cle: 'fuite', vm: 'donneesclients', description: 'Fuite de données personnelles et bancaires de clients', impacts: ['Violation RGPD (sanction CNIL)', 'Usurpation d\'identité et fraude', 'Perte de confiance durable'], gravite: 4 },
      { cle: 'fraude', vm: 'paiement', description: 'Exécution de virements frauduleux à grande échelle', impacts: ['Pertes financières directes', 'Litiges clients', 'Contrôle renforcé du superviseur'], gravite: 3 },
    ],
    referentiels: [
      { nom: 'DORA', version: 'UE 2022/2554', applicable: true, ecarts: 'Registre des tiers TIC à compléter' },
      { nom: 'ISO/IEC 27001', version: '2022', applicable: true, ecarts: 'SMSI en cours de certification' },
      { nom: 'PCI-DSS', version: 'v4.0', applicable: true, ecarts: 'Segmentation de l\'environnement carte à renforcer' },
      { nom: 'RGPD', version: 'Règl. 2016/679', applicable: true, ecarts: 'DPIA paiements à actualiser' },
    ],
    socle: [
      { mesure: 'MFA forte sur les accès clients et collaborateurs', source: 'DORA', statut: 'REALISE' },
      { mesure: 'Anti-DDoS et WAF devant les services exposés', source: 'ISO 27001', statut: 'EN_COURS' },
      { mesure: 'Contrôle des tiers TIC (registre + clauses DORA)', source: 'DORA', statut: 'A_FAIRE' },
      { mesure: 'Détection de fraude sur les virements (scoring temps réel)', source: 'Interne', statut: 'EN_COURS' },
    ],
    srs: [
      { cle: 'ransomware', nom: 'Groupe cybercriminel (rançongiciel + double extorsion)', categorie: 'CYBERCRIMINEL', description: 'Groupes RaaS ciblant les banques pour extorsion et vol de données (ENISA : secteur bancaire cible prioritaire).', m: 4, r: 4, a: 4, pertinence: 4, objectifs: [{ nom: 'Chiffrement du SI et extorsion', description: 'Indisponibilité des services + rançon', priorite: 'P1', pertinenceOV: 4 }, { nom: 'Exfiltration de données clients', description: 'Revente / double extorsion', priorite: 'P1', pertinenceOV: 3 }] },
      { cle: 'hacktiviste', nom: 'Hacktivistes (DDoS)', categorie: 'ACTIVISTE', description: 'Collectifs menant des campagnes DDoS contre les institutions financières (ENISA : DDoS = majorité des incidents).', m: 3, r: 2, a: 4, pertinence: 3, objectifs: [{ nom: 'Indisponibilité des services en ligne', description: 'Nuisance médiatique par saturation', priorite: 'P1', pertinenceOV: 3 }] },
    ],
    pps: [
      { cle: 'cloud', nom: 'Hébergeur cloud critique', type: 'PRESTATAIRE', description: 'Fournisseur cloud supportant les services digitaux (tiers TIC critique DORA).', dep: 4, pen: 4, mat: 3, conf: 3, critique: true },
      { cle: 'paiement', nom: 'Réseau interbancaire / prestataire de paiement', type: 'PARTENAIRE', description: 'Opérateur de compensation et de paiement.', dep: 4, pen: 3, mat: 4, conf: 3, critique: true },
      { cle: 'acpr', nom: 'Superviseur (ACPR/BCE)', type: 'ORGANISME_REGULATION', description: 'Autorité de supervision prudentielle.', dep: 2, pen: 1, mat: 4, conf: 4 },
    ],
    sss: [
      { cle: 'ss_ranso', nom: 'Rançongiciel via prestataire cloud compromis', sr: 'ransomware', objectifVise: 'Chiffrement du SI et extorsion', description: 'Compromission d\'un accès du prestataire cloud, pivot vers le SI bancaire, chiffrement du cœur bancaire et des sauvegardes.', er: 'indispo', chemin: [
        { etape: 1, partiePrenante: 'Hébergeur cloud', action: 'Compromission d\'un compte d\'exploitation', evenementIntermediaire: 'Accès à la console cloud' },
        { etape: 2, partiePrenante: 'Cœur bancaire', action: 'Mouvement latéral + élévation de privilèges', evenementIntermediaire: 'Contrôle des serveurs critiques' },
        { etape: 3, partiePrenante: 'Sauvegardes', action: 'Chiffrement et suppression des sauvegardes', evenementIntermediaire: 'Indisponibilité durable' },
      ], v: 3, g: 4 },
      { cle: 'ss_ddos', nom: 'Campagne DDoS sur la banque en ligne', sr: 'hacktiviste', objectifVise: 'Indisponibilité des services en ligne', description: 'Saturation volumétrique des services exposés rendant la banque en ligne inaccessible.', er: 'indispo', chemin: [
        { etape: 1, partiePrenante: 'Internet', action: 'Location d\'un botnet DDoS', evenementIntermediaire: 'Trafic malveillant massif' },
        { etape: 2, partiePrenante: 'Portail web & API', action: 'Saturation de la bande passante et des serveurs', evenementIntermediaire: 'Indisponibilité du portail et de l\'app' },
      ], v: 3, g: 3 },
    ],
    sos: [
      { cle: 'so_ranso', nom: 'Phishing exploitant → chiffrement du core banking', ss: 'ss_ranso', description: 'Hameçonnage d\'un administrateur du prestataire, réutilisation d\'accès, déploiement du rançongiciel.', actions: [
        { nom: 'Spear-phishing administrateur prestataire', type: 'SOCIAL_ENGINEERING', bienSupport: 'Hébergement cloud (prestataire TIC)', vulnerabilite: 'MFA non imposée aux comptes d\'exploitation du tiers', description: 'Vol des identifiants d\'un compte à privilèges' },
        { nom: 'Élévation de privilèges dans le SI', type: 'ELEVATION_PRIVILEGES', bienSupport: 'Cœur bancaire (core banking)', vulnerabilite: 'Comptes de service surprivilégiés', description: 'Prise de contrôle des serveurs critiques' },
        { nom: 'Déploiement du rançongiciel', type: 'IMPACT', bienSupport: 'Cœur bancaire (core banking)', vulnerabilite: 'Sauvegardes non immuables', description: 'Chiffrement du cœur bancaire et des sauvegardes' },
      ], v: 3, g: 4 },
      { cle: 'so_ddos', nom: 'Saturation volumétrique des services exposés', ss: 'ss_ddos', description: 'Attaque DDoS L7 ciblant les API mobiles.', actions: [
        { nom: 'Reconnaissance des points d\'entrée', type: 'RECONNAISSANCE', bienSupport: 'Portail web & API mobile', vulnerabilite: 'Endpoints non protégés par un anti-DDoS', description: 'Identification des API les plus coûteuses' },
        { nom: 'Flood applicatif L7', type: 'IMPACT', bienSupport: 'Portail web & API mobile', vulnerabilite: 'Absence de rate-limiting', description: 'Saturation des serveurs applicatifs' },
      ], v: 3, g: 3 },
    ],
    rqs: [
      { cle: 'r_ranso', nom: 'Indisponibilité du cœur bancaire par rançongiciel', so: 'so_ranso', description: 'Chiffrement du SI via un tiers TIC entraînant l\'arrêt des services bancaires.', g: 4, v: 3, strategie: 'REDUIRE', erRef: 'Indisponibilité prolongée de la banque en ligne et des paiements', gr: 4, vr: 2, justif: 'Après MFA tiers, PAM/bastion et sauvegardes immuables, la vraisemblance passe de 3 à 2 ; gravité maintenue (impact clients).' },
      { cle: 'r_ddos', nom: 'Indisponibilité de la banque en ligne par DDoS', so: 'so_ddos', description: 'Saturation des services digitaux rendant les canaux inaccessibles.', g: 3, v: 3, strategie: 'REDUIRE', erRef: 'Indisponibilité prolongée de la banque en ligne et des paiements', gr: 3, vr: 2, justif: 'Avec anti-DDoS managé + rate-limiting, la vraisemblance baisse à 2.' },
    ],
    mss: [
      { nom: 'Contractualisation et surveillance des tiers TIC (DORA)', rq: 'r_ranso', description: 'Registre d\'information, clauses de sécurité, audits et tests des prestataires critiques.', type: 'PREVENTIVE', priorite: 4, statut: 'A_FAIRE', responsable: 'RSSI', entite: 'Risques', cat: 'GOUVERNANCE', efficacite: 3 },
      { nom: 'Bastion PAM + MFA sur les accès prestataires', rq: 'r_ranso', description: 'Accès distants via bastion, enregistrement de session, MFA obligatoire.', type: 'PREVENTIVE', priorite: 4, statut: 'EN_COURS', responsable: 'DSI Sécurité', entite: 'DSI', cat: 'PROTECTION', efficacite: 4 },
      { nom: 'Sauvegardes immuables 3-2-1-1 + test de restauration', rq: 'r_ranso', description: 'Sauvegardes hors-ligne immuables, tests de restauration mensuels.', type: 'CORRECTIVE', priorite: 4, statut: 'EN_COURS', responsable: 'DSI Production', entite: 'DSI', cat: 'RESILIENCE', efficacite: 4 },
      { nom: 'Protection anti-DDoS managée + rate-limiting API', rq: 'r_ddos', description: 'Service anti-DDoS en amont, WAF et limitation de débit sur les API.', type: 'PREVENTIVE', priorite: 3, statut: 'EN_COURS', responsable: 'DSI Réseau', entite: 'DSI', cat: 'DEFENSE', efficacite: 3 },
    ],
  },
  // ══════════════ ASSURANCE (GalaxyInsurance) ══════════════
  {
    orgNom: 'GalaxyInsurance', nom: 'Analyse EBIOS RM — Gestion des sinistres & données assurés', secteur: 'Assurance', referentielMesures: 'DORA',
    perimetre: 'Plateforme de gestion des contrats et des sinistres, espace assuré en ligne, données de santé des assurés ; prestataires (tarification, expertise).',
    missions: 'Assurer la souscription, la gestion des contrats et l\'indemnisation des sinistres en protégeant les données sensibles des assurés.',
    vms: [
      { cle: 'sinistres', nom: 'Gestion des sinistres et indemnisation', type: 'PROCESSUS', description: 'Traitement des déclarations, expertise et paiement des indemnités.', responsable: 'Direction Indemnisation', d: 4, i: 4, c: 3 },
      { cle: 'donneesassures', nom: 'Données des assurés (dont santé)', type: 'INFORMATION', description: 'Contrats, sinistres et données de santé (art. 9 RGPD).', responsable: 'DPO', d: 3, i: 4, c: 4 },
    ],
    bss: [
      { cle: 'plateforme', nom: 'Plateforme de gestion des sinistres', type: 'LOGICIEL', description: 'Application métier centrale.', vm: ['sinistres', 'donneesassures'] },
      { cle: 'espace', nom: 'Espace assuré en ligne', type: 'LOGICIEL', description: 'Portail client web et mobile.', vm: ['sinistres'] },
      { cle: 'tarif', nom: 'Service de scoring/tarification (tiers)', type: 'RESEAU', description: 'API externe de tarification (prestataire TIC).', vm: ['sinistres'] },
    ],
    ers: [
      { cle: 'fuitesante', vm: 'donneesassures', description: 'Fuite de données de santé et de sinistres des assurés', impacts: ['Violation RGPD art. 9 (données sensibles)', 'Préjudice grave pour les assurés', 'Sanction CNIL et perte de confiance'], gravite: 4 },
      { cle: 'indispo', vm: 'sinistres', description: 'Indisponibilité de la plateforme de gestion des sinistres', impacts: ['Retard d\'indemnisation', 'Insatisfaction et litiges', 'Reporting DORA'], gravite: 3 },
    ],
    referentiels: [
      { nom: 'DORA', version: 'UE 2022/2554', applicable: true, ecarts: 'Tests de résilience à planifier' },
      { nom: 'ISO/IEC 27001', version: '2022', applicable: true, ecarts: 'Analyse des écarts en cours' },
      { nom: 'RGPD', version: 'Règl. 2016/679', applicable: true, ecarts: 'Chiffrement des données de santé à généraliser' },
    ],
    socle: [
      { mesure: 'Chiffrement des données de santé au repos et en transit', source: 'RGPD', statut: 'EN_COURS' },
      { mesure: 'MFA sur l\'espace assuré et les accès internes', source: 'ISO 27001', statut: 'REALISE' },
      { mesure: 'Surveillance des prestataires TIC (DORA)', source: 'DORA', statut: 'A_FAIRE' },
    ],
    srs: [
      { cle: 'cyber', nom: 'Cybercriminel (vol et revente de données)', categorie: 'CYBERCRIMINEL', description: 'Acteurs ciblant les données de santé, très valorisées sur les marchés criminels.', m: 4, r: 3, a: 3, pertinence: 4, objectifs: [{ nom: 'Exfiltration de données de santé', description: 'Vol massif pour revente / extorsion', priorite: 'P1', pertinenceOV: 4 }] },
      { cle: 'ransomware', nom: 'Rançongiciel', categorie: 'CYBERCRIMINEL', description: 'Chiffrement de la plateforme métier pour extorsion.', m: 4, r: 3, a: 4, pertinence: 3, objectifs: [{ nom: 'Chiffrement de la plateforme sinistres', description: 'Indisponibilité + rançon', priorite: 'P1', pertinenceOV: 3 }] },
    ],
    pps: [
      { cle: 'tarif', nom: 'Prestataire de tarification/scoring', type: 'PRESTATAIRE', description: 'Fournit un service de scoring via API (tiers TIC).', dep: 3, pen: 3, mat: 3, conf: 3, critique: true },
      { cle: 'experts', nom: 'Réseau d\'experts et de réparateurs', type: 'PARTENAIRE', description: 'Partenaires accédant aux dossiers de sinistres.', dep: 3, pen: 2, mat: 2, conf: 2 },
    ],
    sss: [
      { cle: 'ss_exfil', nom: 'Exfiltration de données de santé des assurés', sr: 'cyber', objectifVise: 'Exfiltration de données de santé', description: 'Compromission d\'un compte à privilèges permettant l\'exfiltration progressive des dossiers sinistres/santé.', er: 'fuitesante', chemin: [
        { etape: 1, partiePrenante: 'Réseau d\'experts', action: 'Phishing d\'un expert partenaire', evenementIntermediaire: 'Compromission d\'un compte à accès dossiers' },
        { etape: 2, partiePrenante: 'Plateforme sinistres', action: 'Accès aux dossiers via compte légitime', evenementIntermediaire: 'Exfiltration progressive' },
      ], v: 3, g: 4 },
      { cle: 'ss_ranso', nom: 'Rançongiciel sur la plateforme sinistres', sr: 'ransomware', objectifVise: 'Chiffrement de la plateforme sinistres', description: 'Chiffrement de la plateforme métier et arrêt de l\'indemnisation.', er: 'indispo', chemin: [
        { etape: 1, partiePrenante: 'Poste interne', action: 'Pièce jointe malveillante', evenementIntermediaire: 'Exécution du loader' },
        { etape: 2, partiePrenante: 'Plateforme sinistres', action: 'Chiffrement des serveurs', evenementIntermediaire: 'Indisponibilité' },
      ], v: 2, g: 3 },
    ],
    sos: [
      { cle: 'so_exfil', nom: 'Compromission compte expert → exfiltration', ss: 'ss_exfil', description: 'Vol d\'identifiants d\'un partenaire et exfiltration lente.', actions: [
        { nom: 'Phishing expert partenaire', type: 'SOCIAL_ENGINEERING', bienSupport: 'Plateforme de gestion des sinistres', vulnerabilite: 'Pas de MFA sur les comptes partenaires', description: 'Vol d\'identifiants' },
        { nom: 'Exfiltration progressive des dossiers', type: 'IMPACT', bienSupport: 'Plateforme de gestion des sinistres', vulnerabilite: 'Absence de DLP et de journalisation des extractions', description: 'Extraction lente non détectée' },
      ], v: 3, g: 4 },
      { cle: 'so_ranso', nom: 'Chiffrement de la plateforme sinistres', ss: 'ss_ranso', description: 'Déploiement d\'un rançongiciel après accès initial.', actions: [
        { nom: 'Exécution d\'un loader via e-mail', type: 'ACCES_INITIAL', bienSupport: 'Plateforme de gestion des sinistres', vulnerabilite: 'Filtrage e-mail insuffisant', description: 'Compromission d\'un poste' },
        { nom: 'Chiffrement des serveurs métier', type: 'IMPACT', bienSupport: 'Plateforme de gestion des sinistres', vulnerabilite: 'Sauvegardes non isolées', description: 'Arrêt de l\'indemnisation' },
      ], v: 2, g: 3 },
    ],
    rqs: [
      { cle: 'r_exfil', nom: 'Fuite de données de santé des assurés', so: 'so_exfil', description: 'Exfiltration de dossiers sinistres incluant des données de santé.', g: 4, v: 3, strategie: 'REDUIRE', erRef: 'Fuite de données de santé et de sinistres des assurés', gr: 4, vr: 2, justif: 'Avec MFA partenaires + DLP + journalisation, la vraisemblance passe de 3 à 2.' },
      { cle: 'r_ranso', nom: 'Indisponibilité de l\'indemnisation par rançongiciel', so: 'so_ranso', description: 'Chiffrement de la plateforme sinistres.', g: 3, v: 2, strategie: 'REDUIRE', erRef: 'Indisponibilité de la plateforme de gestion des sinistres', gr: 3, vr: 1, justif: 'Sauvegardes isolées + EDR ramènent la vraisemblance à 1.' },
    ],
    mss: [
      { nom: 'MFA sur les comptes partenaires et internes', rq: 'r_exfil', description: 'Authentification forte pour tous les accès aux dossiers.', type: 'PREVENTIVE', priorite: 4, statut: 'EN_COURS', responsable: 'RSSI', entite: 'DSI', cat: 'PROTECTION', efficacite: 4 },
      { nom: 'DLP + journalisation des extractions de données', rq: 'r_exfil', description: 'Prévention des fuites et traçabilité des accès aux données sensibles.', type: 'DETECTIVE', priorite: 3, statut: 'A_FAIRE', responsable: 'RSSI', entite: 'DSI', cat: 'DEFENSE', efficacite: 3 },
      { nom: 'Sauvegardes isolées + EDR sur les serveurs métier', rq: 'r_ranso', description: 'Sauvegardes hors-ligne et détection comportementale.', type: 'CORRECTIVE', priorite: 3, statut: 'EN_COURS', responsable: 'DSI Production', entite: 'DSI', cat: 'RESILIENCE', efficacite: 4 },
    ],
  },
  // ══════════════ SANTÉ (Hydroclinical) ══════════════
  {
    orgNom: 'Hydroclinical', nom: 'Analyse EBIOS RM — Système d\'information hospitalier', secteur: 'Santé', referentielMesures: 'HDS',
    perimetre: 'Système d\'information hospitalier (dossier patient informatisé), imagerie, portail patient ; équipements biomédicaux connectés.',
    missions: 'Assurer la continuité et la sécurité des soins en protégeant la disponibilité et la confidentialité des données de santé.',
    vms: [
      { cle: 'dpi', nom: 'Dossier patient informatisé (DPI)', type: 'PROCESSUS', description: 'Antécédents, prescriptions, comptes-rendus, résultats.', responsable: 'DSI', d: 4, i: 4, c: 4 },
      { cle: 'portail', nom: 'Portail patient (RDV en ligne)', type: 'SERVICE', description: 'Prise de rendez-vous et téléservices patients.', responsable: 'Direction des Usagers', d: 3, i: 3, c: 3 },
    ],
    bss: [
      { cle: 'sih', nom: 'Système d\'information hospitalier (SIH)', type: 'LOGICIEL', description: 'Application centrale DPI.', vm: ['dpi'] },
      { cle: 'portailweb', nom: 'Portail patient web', type: 'LOGICIEL', description: 'Front-end exposé sur Internet.', vm: ['portail'] },
      { cle: 'biomed', nom: 'Équipements biomédicaux connectés', type: 'MATERIEL', description: 'Dispositifs médicaux en réseau.', vm: ['dpi'] },
    ],
    ers: [
      { cle: 'indispo', vm: 'dpi', description: 'Indisponibilité du SIH et bascule en mode dégradé', impacts: ['Retard et erreurs de prise en charge', 'Mise en danger des patients', 'Passage au papier prolongé'], gravite: 4 },
      { cle: 'fuite', vm: 'dpi', description: 'Vol de dossiers médicaux de patients', impacts: ['Violation du secret médical', 'Préjudice grave pour les patients', 'Sanction CNIL'], gravite: 4 },
    ],
    referentiels: [
      { nom: 'HDS', version: '2018', applicable: true, ecarts: 'Certification en cours' },
      { nom: 'PGSSI-S', version: '2023', applicable: true, ecarts: 'MFA à généraliser' },
      { nom: 'ISO/IEC 27001', version: '2022', applicable: true, ecarts: 'SMSI partiel' },
      { nom: 'RGPD', version: 'Règl. 2016/679', applicable: true, ecarts: 'Registre des traitements à compléter' },
    ],
    socle: [
      { mesure: 'Sauvegardes immuables + PRA testé', source: 'PGSSI-S', statut: 'EN_COURS' },
      { mesure: 'Segmentation du réseau biomédical', source: 'ISO 27001', statut: 'A_FAIRE' },
      { mesure: 'MFA sur les accès distants', source: 'PGSSI-S', statut: 'EN_COURS' },
    ],
    srs: [
      { cle: 'ransomware', nom: 'Cybercriminel (rançongiciel hospitalier)', categorie: 'CYBERCRIMINEL', description: 'Rançongiciel = 54 % des menaces santé (ENISA) ; nombreux hôpitaux touchés.', m: 4, r: 3, a: 4, pertinence: 4, objectifs: [{ nom: 'Chiffrement du SIH et extorsion', description: 'Blocage des soins + rançon', priorite: 'P1', pertinenceOV: 4 }, { nom: 'Vol de dossiers patients', description: 'Double extorsion', priorite: 'P1', pertinenceOV: 3 }] },
      { cle: 'hacktiviste', nom: 'Hacktivistes (DDoS)', categorie: 'ACTIVISTE', description: 'Attaques DDoS revendiquées contre les hôpitaux.', m: 2, r: 2, a: 3, pertinence: 2, objectifs: [{ nom: 'Indisponibilité du portail patient', description: 'Nuisance médiatique', priorite: 'P2', pertinenceOV: 2 }] },
    ],
    pps: [
      { cle: 'editeur', nom: 'Éditeur du SIH', type: 'FOURNISSEUR', description: 'Télémaintenance à distance du DPI.', dep: 4, pen: 4, mat: 3, conf: 2, critique: true },
      { cle: 'biomed', nom: 'Prestataire de maintenance biomédicale', type: 'PRESTATAIRE', description: 'Maintenance des équipements connectés.', dep: 3, pen: 3, mat: 2, conf: 2, critique: true },
    ],
    sss: [
      { cle: 'ss_ranso', nom: 'Rançongiciel via éditeur SIH compromis', sr: 'ransomware', objectifVise: 'Chiffrement du SIH et extorsion', description: 'Compromission de l\'accès de télémaintenance de l\'éditeur, pivot et chiffrement du SIH.', er: 'indispo', chemin: [
        { etape: 1, partiePrenante: 'Éditeur du SIH', action: 'Compromission du compte de télémaintenance', evenementIntermediaire: 'Accès au SIH' },
        { etape: 2, partiePrenante: 'SIH', action: 'Déploiement du rançongiciel', evenementIntermediaire: 'Chiffrement et bascule dégradée' },
      ], v: 3, g: 4 },
      { cle: 'ss_exfil', nom: 'Vol de dossiers patients', sr: 'ransomware', objectifVise: 'Vol de dossiers patients', description: 'Exfiltration des dossiers avant chiffrement (double extorsion).', er: 'fuite', chemin: [
        { etape: 1, partiePrenante: 'SIH', action: 'Accès aux bases patients', evenementIntermediaire: 'Copie des dossiers' },
        { etape: 2, partiePrenante: 'Infrastructure externe', action: 'Exfiltration chiffrée', evenementIntermediaire: 'Fuite des données de santé' },
      ], v: 2, g: 4 },
    ],
    sos: [
      { cle: 'so_ranso', nom: 'Télémaintenance compromise → chiffrement du SIH', ss: 'ss_ranso', description: 'Réutilisation de l\'accès éditeur pour déployer le rançongiciel.', actions: [
        { nom: 'Compromission du canal de télémaintenance', type: 'ACCES_INITIAL', bienSupport: 'Système d\'information hospitalier (SIH)', vulnerabilite: 'Accès éditeur sans bastion ni MFA', description: 'Accès distant au SIH' },
        { nom: 'Chiffrement du SIH', type: 'IMPACT', bienSupport: 'Système d\'information hospitalier (SIH)', vulnerabilite: 'Sauvegardes en ligne accessibles', description: 'Indisponibilité du dossier patient' },
      ], v: 3, g: 4 },
      { cle: 'so_exfil', nom: 'Exfiltration des dossiers patients', ss: 'ss_exfil', description: 'Copie et exfiltration des bases avant chiffrement.', actions: [
        { nom: 'Extraction des bases patients', type: 'IMPACT', bienSupport: 'Système d\'information hospitalier (SIH)', vulnerabilite: 'Absence de DLP', description: 'Copie massive des dossiers' },
      ], v: 2, g: 4 },
    ],
    rqs: [
      { cle: 'r_ranso', nom: 'Indisponibilité du SIH par rançongiciel', so: 'so_ranso', description: 'Chiffrement du SIH et bascule en mode dégradé.', g: 4, v: 3, strategie: 'REDUIRE', erRef: 'Indisponibilité du SIH et bascule en mode dégradé', gr: 4, vr: 2, justif: 'Bastion + MFA éditeur + sauvegardes immuables ramènent la vraisemblance à 2.' },
      { cle: 'r_fuite', nom: 'Vol de dossiers médicaux', so: 'so_exfil', description: 'Exfiltration de données de santé de patients.', g: 4, v: 2, strategie: 'REDUIRE', erRef: 'Vol de dossiers médicaux de patients', gr: 4, vr: 1, justif: 'DLP + SIEM + segmentation réduisent la vraisemblance à 1.' },
    ],
    mss: [
      { nom: 'Bastion PAM + MFA pour la télémaintenance éditeur', rq: 'r_ranso', description: 'Accès éditeur via bastion, MFA, enregistrement de session.', type: 'PREVENTIVE', priorite: 4, statut: 'A_FAIRE', responsable: 'RSSI', entite: 'DSI', cat: 'PROTECTION', efficacite: 4 },
      { nom: 'Sauvegardes immuables + PRA testé (mode dégradé)', rq: 'r_ranso', description: 'Sauvegardes hors-ligne, procédures de mode dégradé et tests de restauration.', type: 'CORRECTIVE', priorite: 4, statut: 'EN_COURS', responsable: 'DSI Production', entite: 'DSI', cat: 'RESILIENCE', efficacite: 4 },
      { nom: 'DLP + SIEM sur les accès aux dossiers patients', rq: 'r_fuite', description: 'Détection des exfiltrations et supervision des accès sensibles.', type: 'DETECTIVE', priorite: 3, statut: 'A_FAIRE', responsable: 'RSSI', entite: 'DSI', cat: 'DEFENSE', efficacite: 3 },
    ],
  },
]
