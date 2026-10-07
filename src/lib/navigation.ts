/**
 * navigation.ts — modèle de navigation principal (logique pure, testable sans DB).
 *
 * DEUX modes, résolus selon les modules GRC actifs :
 *  - `cyber` : aucun module GRC de 2ᵉ/3ᵉ ligne actif → parcours EBIOS inline
 *    (dashboard + analyses/risques/tiers/actions) + un menu déroulant « GRC »
 *    regroupant gouvernance et incidents éventuels.
 *  - `grc`   : au moins un module GRC actif → la barre ÉVOLUE : le cyber est
 *    replié dans un sous-menu « Cyber », et les domaines GRC (cartographie,
 *    incidents, contrôle, audit, registre, gouvernance) passent en tête, groupés
 *    par domaine (menus déroulants).
 *
 * Le composant `Navbar` se contente de rendre les `entries` (liens ou groupes).
 *
 * ⚠️ Règle d'or : le GATING (qui voit quoi) reste identique au comportement
 * historique — on ne change que la DISPOSITION selon le mode, jamais les droits.
 */
import { isAdminRole, hasGlobalReadDispositif, canManageRopa, peutLireConformite, peutLireRegistreIa, type UserRole } from './permissions'

/** État effectif des modules GRC optionnels (renvoyé par /api/modules). */
export interface NavModules {
  registre: boolean
  incidents: boolean
  controles: boolean
  audit: boolean
  kri: boolean
  reglementaire: boolean
  profilsOperationnels: boolean
  /** Module « Projets 360 » (onglet Projets). */
  projets?: boolean
  /** Homologation de sécurité des systèmes d'information. */
  homologations?: boolean
  /** Revues d'habilitations (recertification). */
  recertification?: boolean
  /** Registre des algorithmes et systèmes d'IA. */
  registreIa?: boolean
  /** Campagnes RCSA (avec le registre des risques). */
  campagnesRcsa?: boolean
  /** Appétence au risque (RAS / RAD). */
  appetence?: boolean
  /** Rapports GRC (éditions figées). */
  rapportsGrc?: boolean
}

/** Clé d'un lien de navigation (dashboard, analyses, risques, actions…). */
export type NavKey =
  | 'dashboard' | 'analyses' | 'risques' | 'tiers' | 'actions' | 'plansActions'
  | 'conformite' | 'referentiels' | 'documents' | 'derogations'
  | 'registre' | 'campagnes' | 'cartographie' | 'pilotage' | 'processus'
  | 'incidents' | 'controles' | 'campagnesControle' | 'questionnaires' | 'audit' | 'kri'
  | 'reglementaire' | 'registreTic' | 'suiviRegulateur' | 'ropa' | 'profilsOperationnels' | 'appetence' | 'testsResilience' | 'projets' | 'rapports'
  | 'homologations' | 'recertification' | 'registreIa'

/** Identifiant d'un groupe déroulant (→ libellé i18n résolu par le composant). */
export type NavGroupId = 'grc' | 'cyber' | 'controle' | 'registre' | 'reglementaire' | 'gouvernance'
  | 'analyses' | 'controleAudit' | 'conformiteReglementaire' | 'conformite' | 'pilotage'

/** Une entrée de barre : soit un lien direct, soit un groupe déroulant. */
export type NavEntry =
  | { kind: 'link'; key: NavKey }
  | { kind: 'group'; id: NavGroupId; items: NavKey[] }

/** Modèle de navigation résolu : mode (cyber/grc) + groupes de liens visibles. */
export interface NavModel {
  mode: 'cyber' | 'grc'
  entries: NavEntry[]
}

/** Parcours EBIOS de base (cyber). */
const CORE: NavKey[] = ['analyses', 'risques', 'tiers', 'actions']
/** Cœur « gestion des risques » : analyses, puis Projets 360 si le module est actif. */
const core = (modules: NavModules): NavKey[] => (modules.projets ? ['analyses', 'projets', 'risques', 'tiers', 'actions'] : CORE)

/** Nb max d'items secondaires (gouvernance/incidents) étalés inline avant regroupement. */
export const SECONDARY_INLINE_MAX = 2

const link = (key: NavKey): NavEntry => ({ kind: 'link', key })

/** 1 item → lien direct ; 2+ → groupe déroulant. */
function groupOrLink(id: NavGroupId, items: NavKey[]): NavEntry {
  return items.length === 1 ? link(items[0]) : { kind: 'group', id, items }
}

/** Construit le modèle de navigation (groupes/liens visibles) selon le rôle et les modules GRC actifs de l'organisation. */
export function buildNav(role: UserRole, modules: NavModules): NavModel {
  const isAdmin = isAdminRole(role)
  // 1ʳᵉ ligne « pure » : LECTEUR (lecture seule) et METIER (opérationnel) ne gèrent
  // pas les modules 2ᵉ/3ᵉ ligne — ils ne voient que la déclaration d'incident.
  const firstLineOnly = role === 'LECTEUR' || role === 'METIER'
  const canGovern = isAdmin || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'CONFORMITE' || role === 'DPO'
  const canDerog = canGovern || role === 'DIRECTION_METIER'
  // Pilotage (cockpit de lecture consolidée) : tous les rôles à lecture globale du
  // dispositif — dont CONTROLEUR et AUDITEUR, que l'API /grc/rollup sert déjà (#126).
  const canPilotage = hasGlobalReadDispositif(role)

  // Gouvernance (disponible dans les deux modes).
  const gouvernance: NavKey[] = []
  // Conformité : gouvernance et analyste (lecture du tableau de bord) ; référentiels et documents : gouvernance.
  if (peutLireConformite(role)) gouvernance.push('conformite')
  if (canGovern) gouvernance.push('referentiels', 'documents')
  if (modules.profilsOperationnels && canGovern) gouvernance.push('profilsOperationnels')
  if (canDerog) gouvernance.push('derogations')
  // Homologation : préparée par la gouvernance, décidée par l'autorité (direction métier).
  if (modules.homologations && (canGovern || role === 'DIRECTION_METIER')) gouvernance.push('homologations')
  // Registre IA : dans « Gouvernance » en mode cyber, dans « Registres » en mode GRC.
  // Lecture aussi pour le contrôle permanent et l'audit interne (peutLireRegistreIa).
  const registreIa = !!modules.registreIa && peutLireRegistreIa(role)
  // Recertification : chaque responsable revoit les droits qui lui sont confiés (tous rôles sauf lecture seule).
  // Revues d'habilitations (recertification) : masquées tant que le module n'a pas d'écran (lot P5 non livré).
  // Registre RoPA (RGPD art. 30) — réservé au DPO (+ ADMIN).
  if (canManageRopa(role)) gouvernance.push('ropa')

  // Le mode GRC est déclenché par un module de 2ᵉ/3ᵉ ligne (le registre étant le
  // pivot GRC). Les incidents SEULS (1ʳᵉ ligne) ne basculent pas en mode GRC.
  const grcMode = modules.registre || modules.controles || modules.audit || modules.kri || modules.reglementaire || modules.profilsOperationnels

  // ─── MODE CYBER ────────────────────────────────────────────────────────────
  // La barre s'ADAPTE au nombre d'items : dashboard + le cœur EBIOS restent étalés ;
  // les items secondaires (gouvernance, incidents) sont ÉTALÉS tant qu'ils sont peu
  // nombreux (≤ SECONDARY_INLINE_MAX), sinon REGROUPÉS dans le menu « GRC ». Un seul
  // item ne fait donc jamais un menu déroulant pour rien.
  if (!grcMode) {
    const secondary: NavKey[] = [...gouvernance, ...(registreIa ? ['registreIa' as const] : [])]
    if (modules.incidents) secondary.push('incidents')
    // Sans mode GRC, les rapports d'incidents/pertes restent accessibles (module incidents actif).
    if (modules.incidents && canPilotage && modules.rapportsGrc) secondary.push('rapports')
    const entries: NavEntry[] = [link('dashboard'), ...core(modules).map(link)]
    if (secondary.length > 0) {
      if (secondary.length <= SECONDARY_INLINE_MAX) entries.push(...secondary.map(link))
      else entries.push({ kind: 'group', id: 'grc', items: secondary })
    }
    return { mode: 'cyber', entries }
  }

  // ─── MODE GRC ──────────────────────────────────────────────────────────────
  // Découpage « pilotage en tête » : max ~6 entrées de haut niveau, granularité
  // homogène (que des menus déroulants thématiques + les 2 liens directs clés).
  const entries: NavEntry[] = []

  // 1. Pilotage : tableau de bord cyber + cockpit GRC consolidé + plans d'action
  //    unifiés (transverse). Toutes les vues de pilotage/suivi réunies. Si le rôle
  //    n'a pas la lecture globale, le groupe se réduit au tableau de bord (lien direct).
  const pilotage: NavKey[] = ['dashboard']
  // Le plan d'action unifié est un lien cœur (« actions ») → plus de doublon ici.
  if (canPilotage) pilotage.push('pilotage')
  // Appétence (RAS / RAD) : dès qu'une de ses sources existe (registre, KRI, maturité).
  if (canPilotage && modules.appetence && (modules.registre || modules.kri || modules.profilsOperationnels)) pilotage.push('appetence')
  // Même parcours métier : les KRI alimentent le RAD. Le droit reste identique
  // à celui qu'ils avaient dans Contrôle & audit (module actif, hors 1ʳᵉ ligne).
  if (modules.kri && !firstLineOnly) pilotage.push('kri')
  entries.push(groupOrLink('pilotage', pilotage))

  // 2. Analyse cyber (cœur EBIOS) : analyses, risques, tiers, actions.
  const analyses: NavKey[] = [...core(modules)]
  entries.push(groupOrLink('analyses', analyses))

  // 3. Registres : risques, incidents, arrangements TIC et systèmes d'IA restent des objets distincts, rapprochés seulement
  // dans la navigation. Le module réglementaire peut être actif seul : son lien doit rester atteignable sans registre de
  // risques. Les incidents restent ouverts à tous (déclaration par la 1ʳᵉ ligne : lien direct s'il est seul).
  const registres: NavKey[] = []
  if (!firstLineOnly && modules.registre) {
    // La cartographie des risques est une vue du registre (onglets Liste / Cartographie) : pas d'entrée propre.
    // Processus : visibles par tous ceux qui voient les registres (page en lecture ; modification réservée à l'ADMIN).
    registres.push('registre', ...(modules.campagnesRcsa ? ['campagnes' as const] : []), 'processus')
  }
  if (modules.incidents) registres.push('incidents')
  if (!firstLineOnly && modules.reglementaire) registres.push('registreTic')
  // Registre des traitements (RGPD art. 30) : DPO et ADMIN.
  if (gouvernance.includes('ropa')) registres.push('ropa')
  if (registreIa) registres.push('registreIa')
  if (registres.length) entries.push(groupOrLink('registre', registres))

  // 4. Contrôle & audit (les 3 lignes de défense) : contrôle permanent + campagnes (2ᵉ ligne), audit interne (3ᵉ ligne).
  const controleAudit: NavKey[] = []
  if (modules.controles && !firstLineOnly) controleAudit.push('controles', 'campagnesControle')
  // Questionnaires de contrôle : les métiers (1ʳᵉ ligne) y répondent, la 2ᵉ ligne les gère.
  if (modules.controles && role !== 'LECTEUR') controleAudit.push('questionnaires')
  if (modules.audit && !firstLineOnly) controleAudit.push('audit')
  if (controleAudit.length) entries.push(groupOrLink('controleAudit', controleAudit))

  // 5. Conformité (gouvernance) : conformité, référentiels, documents, profils, dérogations, homologations.
  // 6. Réglementaire : DORA, tests de résilience et reporting (éditions figées, lot L2 ; mêmes rôles que le cockpit).
  //    Les registres TIC et RGPD sont dans Registres.
  const conformite: NavKey[] = gouvernance.filter(k => k !== 'ropa')
  if (conformite.length) entries.push(groupOrLink('conformite', conformite))
  const reglementaire: NavKey[] = []
  // Tests de résilience (DORA art. 24-26) : rôles à lecture globale du dispositif.
  // Suivi régulateur (constats du superviseur et plans de remédiation) : avec le réglementaire.
  if (modules.reglementaire && !firstLineOnly) reglementaire.push('reglementaire', 'suiviRegulateur', ...(canPilotage ? ['testsResilience' as const] : []))
  if (canPilotage && modules.rapportsGrc) reglementaire.push('rapports')
  if (reglementaire.length) entries.push(groupOrLink('reglementaire', reglementaire))

  return { mode: 'grc', entries }
}

/**
 * Lien actif = la correspondance la PLUS précise (la plus longue) parmi les liens affichés : « /reglementaire/suivi-regulateur »
 * n'active pas aussi « /reglementaire » (sinon deux menus sont en surbrillance). null si aucun lien ne correspond.
 */
export function activeNavHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null
  for (const href of hrefs) {
    if ((pathname === href || pathname.startsWith(href + '/')) && (best === null || href.length > best.length)) best = href
  }
  return best
}

/** Chemin servant à allumer l'entrée de menu : la cartographie est une vue du registre des risques. */
export function navPathFor(pathname: string): string {
  return pathname === '/cartographie' ? '/registre' : pathname
}
