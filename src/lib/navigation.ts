/**
 * navigation.ts — modèle de navigation principal (logique pure, testable sans DB).
 *
 * La barre de navigation empilait jusqu'à ~16 liens en défilement horizontal.
 * On sépare désormais :
 *  - `primary` : le parcours EBIOS de tous les jours (toujours inline, 5 liens) ;
 *  - `grc`     : gouvernance + modules GRC, repliés dans un menu déroulant « GRC ».
 *
 * ⚠️ Règle d'or : le GATING (quels liens sont visibles selon le rôle et les modules
 * actifs) est repris À L'IDENTIQUE de l'ancienne barre — cette refonte ne change que
 * la disposition, jamais les droits. Le composant `Navbar` se contente de rendre ce
 * modèle (icônes + libellés i18n).
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
  | 'incidents' | 'controles' | 'audit' | 'kri' | 'reglementaire'

export interface NavModel {
  /** Toujours inline — les 5 liens du parcours EBIOS de base. */
  primary: NavKey[]
  /** Repliés dans le menu « GRC » — gouvernance + modules, filtrés par droits. */
  grc: NavKey[]
}

/** Liens toujours présents pour tout utilisateur connecté. */
const PRIMARY: NavKey[] = ['dashboard', 'analyses', 'risques', 'tiers', 'actions']

export function buildNav(role: UserRole, modules: NavModules): NavModel {
  const isAdmin = isAdminRole(role)
  // 1ʳᵉ ligne « pure » : LECTEUR (lecture seule) et METIER (opérationnel) ne gèrent
  // pas les modules 2ᵉ/3ᵉ ligne — ils ne voient que la déclaration d'incident.
  const firstLineOnly = role === 'LECTEUR' || role === 'METIER'
  const canGovern = isAdmin || role === 'RSSI' || role === 'RISK_MANAGER'
  const canDerog = canGovern || role === 'DIRECTION_METIER'
  const canPilotage = canGovern || role === 'DIRECTION_METIER'

  const grc: NavKey[] = []

  // Gouvernance
  if (canGovern) grc.push('conformite')
  if (canDerog) grc.push('derogations')

  // Socle GRC — module Registre de risques
  if (modules.registre && !firstLineOnly) grc.push('registre', 'campagnes', 'cartographie')
  if (modules.registre && canPilotage) grc.push('pilotage', 'processus')

  // Modules — la DÉCLARATION d'incident reste ouverte à tous les rôles (1ʳᵉ ligne).
  if (modules.incidents) grc.push('incidents')
  if (modules.controles && !firstLineOnly) grc.push('controles')
  if (modules.audit && !firstLineOnly) grc.push('audit')
  if (modules.kri && !firstLineOnly) grc.push('kri')
  if (modules.reglementaire && !firstLineOnly) grc.push('reglementaire')

  return { primary: [...PRIMARY], grc }
}
