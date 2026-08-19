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
import { isAdminRole, type UserRole } from './permissions'

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
  | 'conformite' | 'derogations'
  | 'registre' | 'campagnes' | 'cartographie' | 'pilotage' | 'processus'
  | 'incidents' | 'controles' | 'audit' | 'kri' | 'reglementaire' | 'registreTic'

/** Identifiant d'un groupe déroulant (→ libellé i18n résolu par le composant). */
export type NavGroupId = 'grc' | 'cyber' | 'controle' | 'registre' | 'gouvernance'

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
  const canPilotage = canGovern || role === 'DIRECTION_METIER'

  // Gouvernance (disponible dans les deux modes).
  const gouvernance: NavKey[] = []
  if (canGovern) gouvernance.push('conformite')
  if (canDerog) gouvernance.push('derogations')

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
  const entries: NavEntry[] = [link('dashboard')]

  // Cyber replié en sous-menu.
  entries.push({ kind: 'group', id: 'cyber', items: [...CORE] })

  // Cartographie (pivot GRC) + registre.
  if (modules.registre && !firstLineOnly) {
    entries.push(link('cartographie'))
    const registre: NavKey[] = ['registre', 'campagnes']
    if (canPilotage) registre.push('processus', 'pilotage')
    entries.push(groupOrLink('registre', registre))
  }

  // Incidents (1ʳᵉ ligne, ouvert à tous).
  if (modules.incidents) entries.push(link('incidents'))

  // Contrôle permanent + KRI (2ᵉ ligne).
  const controle: NavKey[] = []
  if (modules.controles && !firstLineOnly) controle.push('controles')
  if (modules.kri && !firstLineOnly) controle.push('kri')
  if (controle.length) entries.push(groupOrLink('controle', controle))

  // Audit (3ᵉ ligne).
  if (modules.audit && !firstLineOnly) entries.push(link('audit'))

  // Reporting réglementaire + registre d'information des tiers TIC (DORA art. 28).
  if (modules.reglementaire && !firstLineOnly) entries.push(link('reglementaire'))
  if (modules.reglementaire && !firstLineOnly) entries.push(link('registreTic'))

  // Gouvernance.
  if (gouvernance.length) entries.push(groupOrLink('gouvernance', gouvernance))

  return { mode: 'grc', entries }
}
