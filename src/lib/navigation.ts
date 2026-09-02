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
import { isAdminRole, hasGlobalReadDispositif, canManageRopa, type UserRole } from './permissions'

/** État effectif des modules GRC optionnels (renvoyé par /api/modules). */
export interface NavModules {
  registre: boolean
  incidents: boolean
  controles: boolean
  audit: boolean
  kri: boolean
  reglementaire: boolean
}

export type NavKey =
  | 'dashboard' | 'analyses' | 'risques' | 'tiers' | 'actions'
  | 'conformite' | 'referentiels' | 'documents' | 'derogations'
  | 'registre' | 'campagnes' | 'cartographie' | 'pilotage' | 'processus'
  | 'incidents' | 'controles' | 'campagnesControle' | 'audit' | 'kri'
  | 'reglementaire' | 'registreTic' | 'suiviRegulateur' | 'ropa'

/** Identifiant d'un groupe déroulant (→ libellé i18n résolu par le composant). */
export type NavGroupId = 'grc' | 'cyber' | 'controle' | 'registre' | 'reglementaire' | 'gouvernance'
  | 'analyses' | 'controleAudit' | 'conformiteReglementaire'

/** Une entrée de barre : soit un lien direct, soit un groupe déroulant. */
export type NavEntry =
  | { kind: 'link'; key: NavKey }
  | { kind: 'group'; id: NavGroupId; items: NavKey[] }

export interface NavModel {
  mode: 'cyber' | 'grc'
  entries: NavEntry[]
}

/** Parcours EBIOS de base (cyber). */
const CORE: NavKey[] = ['analyses', 'risques', 'tiers', 'actions']

const link = (key: NavKey): NavEntry => ({ kind: 'link', key })

/** 1 item → lien direct ; 2+ → groupe déroulant. */
function groupOrLink(id: NavGroupId, items: NavKey[]): NavEntry {
  return items.length === 1 ? link(items[0]) : { kind: 'group', id, items }
}

export function buildNav(role: UserRole, modules: NavModules): NavModel {
  const isAdmin = isAdminRole(role)
  // 1ʳᵉ ligne « pure » : LECTEUR (lecture seule) et METIER (opérationnel) ne gèrent
  // pas les modules 2ᵉ/3ᵉ ligne — ils ne voient que la déclaration d'incident.
  const firstLineOnly = role === 'LECTEUR' || role === 'METIER'
  const canGovern = isAdmin || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'CONFORMITE' || role === 'DPO'
  const canDerog = canGovern || role === 'DIRECTION_METIER'
  // Processus (données de cartographie) = gouvernance.
  const canGererProcessus = canGovern || role === 'DIRECTION_METIER'
  // Pilotage (cockpit de lecture consolidée) : tous les rôles à lecture globale du
  // dispositif — dont CONTROLEUR et AUDITEUR, que l'API /grc/rollup sert déjà (#126).
  const canPilotage = hasGlobalReadDispositif(role)

  // Gouvernance (disponible dans les deux modes).
  const gouvernance: NavKey[] = []
  if (canGovern) gouvernance.push('conformite', 'referentiels', 'documents')
  if (canDerog) gouvernance.push('derogations')
  // Registre RoPA (RGPD art. 30) — réservé au DPO (+ ADMIN).
  if (canManageRopa(role)) gouvernance.push('ropa')

  // Le mode GRC est déclenché par un module de 2ᵉ/3ᵉ ligne (le registre étant le
  // pivot GRC). Les incidents SEULS (1ʳᵉ ligne) ne basculent pas en mode GRC.
  const grcMode = modules.registre || modules.controles || modules.audit || modules.kri || modules.reglementaire

  // ─── MODE CYBER ────────────────────────────────────────────────────────────
  if (!grcMode) {
    const grc: NavKey[] = [...gouvernance]
    if (modules.incidents) grc.push('incidents')
    const entries: NavEntry[] = [link('dashboard'), ...CORE.map(link)]
    if (grc.length) entries.push({ kind: 'group', id: 'grc', items: grc })
    return { mode: 'cyber', entries }
  }

  // ─── MODE GRC ──────────────────────────────────────────────────────────────
  // Découpage « pilotage en tête » : max ~6 entrées de haut niveau, granularité
  // homogène (que des menus déroulants thématiques + les 2 liens directs clés).
  const entries: NavEntry[] = [link('dashboard')]

  // 1. Pilotage (cockpit consolidé) — la vue direction, promue en lien direct.
  if (canPilotage) entries.push(link('pilotage'))

  // 2. Analyse cyber (cœur EBIOS) : analyses, risques, tiers, actions + cartographie.
  const analyses: NavKey[] = [...CORE]
  if (modules.registre && !firstLineOnly) analyses.push('cartographie')
  entries.push(groupOrLink('analyses', analyses))

  // 3. Registre de risques (cartographie GRC) : registre, campagnes RCSA, processus.
  if (modules.registre && !firstLineOnly) {
    const registre: NavKey[] = ['registre', 'campagnes']
    if (canGererProcessus) registre.push('processus')
    entries.push(groupOrLink('registre', registre))
  }

  // 4. Contrôle & audit (les 3 lignes de défense) : incidents (1ʳᵉ ligne, ouvert à
  //    tous), contrôle permanent + campagnes + KRI (2ᵉ ligne), audit interne (3ᵉ ligne).
  const controleAudit: NavKey[] = []
  if (modules.incidents) controleAudit.push('incidents')
  if (modules.controles && !firstLineOnly) controleAudit.push('controles', 'campagnesControle')
  if (modules.kri && !firstLineOnly) controleAudit.push('kri')
  if (modules.audit && !firstLineOnly) controleAudit.push('audit')
  if (controleAudit.length) entries.push(groupOrLink('controleAudit', controleAudit))

  // 5. Conformité & réglementaire : conformité, référentiels, documents, dérogations,
  //    RGPD + reporting DORA (art. 19), registre TIC (art. 28), suivi régulateur.
  const confReg: NavKey[] = [...gouvernance]
  if (modules.reglementaire && !firstLineOnly) confReg.push('reglementaire', 'registreTic', 'suiviRegulateur')
  if (confReg.length) entries.push(groupOrLink('conformiteReglementaire', confReg))

  return { mode: 'grc', entries }
}
