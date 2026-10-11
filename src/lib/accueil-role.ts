// ─── Accueil selon le rôle (recette n° 32) — PUR ──────────────────────────────
// Les rôles qui ne mènent pas d'analyse (Métier, Contrôleur, Auditeur, Direction métier) et n'en ont aucune voient sur
// /dashboard leur action principale et « À traiter » au lieu des compteurs d'analyses à 0, du guide des ateliers EBIOS et
// de la configuration. Un rôle à qui une analyse est partagée garde l'accueil des analyses. Testé : accueil-role.test.ts.
import type { UserRole } from '@/lib/permissions'

export type ActionAccueil = { cle: 'declarerIncident' | 'executerControles' | 'missionsAudit' | 'planAction'; href: string }
type Modules = { incidentsActive: boolean; controlePermanentActive: boolean; auditInterneActive: boolean }

const PRINCIPALE: Partial<Record<UserRole, (m: Modules) => ActionAccueil | null>> = {
  METIER: m => (m.incidentsActive ? { cle: 'declarerIncident', href: '/incidents' } : null),
  CONTROLEUR: m => (m.controlePermanentActive ? { cle: 'executerControles', href: '/controles' } : null),
  AUDITEUR: m => (m.auditInterneActive ? { cle: 'missionsAudit', href: '/audit' } : null),
  DIRECTION_METIER: () => null,
}
const PLAN: ActionAccueil = { cle: 'planAction', href: '/actions' }

export function accueilRole(role: UserRole, nbAnalyses: number, modules: Modules): { centreAnalyses: boolean; actions: ActionAccueil[] } {
  const principale = PRINCIPALE[role]
  if (!principale || nbAnalyses > 0) return { centreAnalyses: true, actions: [] }
  const a = principale(modules)
  return { centreAnalyses: false, actions: a ? [a, PLAN] : [PLAN] }
}
