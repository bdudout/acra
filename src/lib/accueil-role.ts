// ─── Accueil selon le rôle (recette n° 32) — PUR ──────────────────────────────
// Les rôles qui ne mènent pas d'analyse au quotidien (Métier, Contrôleur, Auditeur, Direction métier, DPO, gestionnaire
// des risques, RSSI) et n'en ont aucune voient sur /dashboard leurs actions principales et « À traiter » au lieu des
// compteurs d'analyses à 0, du guide des ateliers EBIOS et de la configuration. Rôle EFFECTIF dans l'entité active
// (un même utilisateur peut avoir un rôle différent par entité). Une analyse visible rend l'accueil des analyses ;
// pour les rôles hors analyse, les actions du rôle restent au-dessus (n° 57).
// Testé : accueil-role.test.ts.
import type { UserRole } from '@/lib/permissions'

export type ActionAccueil = { cle: 'declarerIncident' | 'executerControles' | 'missionsAudit' | 'planAction' | 'registreTraitements' | 'pilotage' | 'registreRisques' | 'suivreKri' | 'conformite'; href: string }
type Modules = { incidentsActive: boolean; controlePermanentActive: boolean; auditInterneActive: boolean; conformiteActive?: boolean; registreRisquesActive?: boolean; kriActive?: boolean; grcActive?: boolean }

const si = (cond: boolean | undefined, a: ActionAccueil): ActionAccueil[] => (cond ? [a] : [])
const PRINCIPALES: Partial<Record<UserRole, (m: Modules) => ActionAccueil[]>> = {
  METIER: m => si(m.incidentsActive, { cle: 'declarerIncident', href: '/incidents' }),
  CONTROLEUR: m => si(m.controlePermanentActive, { cle: 'executerControles', href: '/controles' }),
  AUDITEUR: m => si(m.auditInterneActive, { cle: 'missionsAudit', href: '/audit' }),
  DIRECTION_METIER: m => si(m.grcActive, { cle: 'pilotage', href: '/pilotage' }),
  DPO: () => [{ cle: 'registreTraitements', href: '/rgpd' }],
  RISK_MANAGER: m => [...si(m.grcActive, { cle: 'pilotage', href: '/pilotage' }), ...si(m.registreRisquesActive, { cle: 'registreRisques', href: '/registre' }), ...si(m.kriActive, { cle: 'suivreKri', href: '/kri' })],
  RSSI: m => [...si(m.conformiteActive, { cle: 'conformite', href: '/conformite' }), ...si(m.grcActive, { cle: 'pilotage', href: '/pilotage' })],
}
const PLAN: ActionAccueil = { cle: 'planAction', href: '/actions' }

// n° 57 : rôles qui ne mènent pas d'analyse — leurs actions restent affichées au-dessus des analyses visibles.
const HORS_ANALYSE: UserRole[] = ['METIER', 'CONTROLEUR', 'AUDITEUR', 'DIRECTION_METIER', 'DPO']

export function accueilRole(role: UserRole, nbAnalyses: number, modules: Modules): { centreAnalyses: boolean; actions: ActionAccueil[] } {
  const principales = PRINCIPALES[role]
  if (!principales) return { centreAnalyses: true, actions: [] }
  if (nbAnalyses === 0) return { centreAnalyses: false, actions: [...principales(modules), PLAN] }
  return { centreAnalyses: true, actions: HORS_ANALYSE.includes(role) ? [...principales(modules), PLAN] : [] }
}
