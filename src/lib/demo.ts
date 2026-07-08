/**
 * demo.ts — Mode « ACRA-Demo » (site de démonstration pour early adopters).
 *
 * Principe : MÊME base de code qu'ACRA, comportement démo activé par la variable
 * d'environnement `ACRA_DEMO_MODE=true` (interrupteur maître, posé uniquement sur
 * le déploiement de démo). Les réglages fins (fenêtres de purge, caps) sont
 * surchargeables par le super-admin via la Configuration globale (phase ultérieure).
 *
 * Comportements démo :
 *  - inscription self-service → chaque testeur obtient SA propre organisation dont
 *    il est ADMIN (jamais SUPER_ADMIN) ;
 *  - purge automatique des organisations démo : après `inactivityDays` sans activité
 *    OU au bout de `hardCapDays` depuis la création (le plus tôt des deux) ;
 *  - bandeau de démonstration (export des données / contact) et mentions RGPD.
 *
 * La logique de dates est PURE → testée unitairement (demo.test.ts).
 */

/** Interrupteur maître : le mode démo est actif si la variable d'env vaut "true". */
export function isDemoMode(): boolean {
  return process.env.ACRA_DEMO_MODE === 'true'
}

/**
 * Identité figée d'une instance : décidée UNE fois puis persistée (cf. demo-server
 * `resolveInstanceMode`). Sert de garde-fou : une instance de PROD ne peut jamais
 * devenir une instance de DEMO, même si `ACRA_DEMO_MODE` est activé par erreur.
 */
export type InstanceMode = 'PROD' | 'DEMO'

/**
 * Décide (logique PURE) le mode d'instance à partir de l'état env + DB.
 *  - marqueur déjà posé → IMMUABLE (on ne le réécrit pas) ; si l'env réclame le
 *    mode démo alors que l'instance est stampée PROD → `refusedDemo` (à auditer) ;
 *  - marqueur absent → on le pose : DEMO seulement si l'env démo est actif ET que
 *    l'instance est vierge de données réelles ; sinon PROD (avec refus signalé si
 *    l'env démo était demandé sur une instance déjà peuplée).
 *
 * @returns mode retenu, `persist` (faut-il écrire le marqueur), `refusedDemo`
 *          (tentative d'activer la démo bloquée → alerte de sécurité).
 */
export function decideInstanceMode(input: {
  envDemo: boolean
  marker: InstanceMode | null
  hasRealData: boolean
}): { mode: InstanceMode; persist: boolean; refusedDemo: boolean } {
  const { envDemo, marker, hasRealData } = input
  if (marker !== null) {
    return { mode: marker, persist: false, refusedDemo: envDemo && marker === 'PROD' }
  }
  if (envDemo && !hasRealData) {
    return { mode: 'DEMO', persist: true, refusedDemo: false }
  }
  if (envDemo && hasRealData) {
    // Instance déjà peuplée : refus de la conversion en démo (anti-destruction).
    return { mode: 'PROD', persist: true, refusedDemo: true }
  }
  return { mode: 'PROD', persist: true, refusedDemo: false }
}

export interface DemoConfig {
  /** Jours sans activité avant purge d'une organisation démo. */
  inactivityDays: number
  /** Plafond absolu (jours depuis la création) quelle que soit l'activité. */
  hardCapDays: number
  /** Nombre de jours avant expiration où l'on prévient le testeur. */
  warningDays: number
  /** Nombre max d'analyses par organisation démo (anti-abus). */
  maxAnalysesPerOrg: number
  /** Nombre max d'organisations démo actives sur l'instance (anti-abus). */
  maxActiveOrgs: number
}

/** Réglages par défaut du mode démo (surchargeables par le super-admin). */
export const DEMO_DEFAULTS: DemoConfig = {
  inactivityDays: 30,
  hardCapDays: 90,
  warningDays: 7,
  maxAnalysesPerOrg: 50,
  maxActiveOrgs: 200,
}

/**
 * Fusionne les réglages persistés (Configuration globale) avec les défauts.
 * Toute valeur absente/invalide retombe sur le défaut. Pur (pas d'accès DB).
 */
export function resolveDemoConfig(overrides?: Partial<Record<keyof DemoConfig, unknown>> | null): DemoConfig {
  const pick = (k: keyof DemoConfig): number => {
    const v = Number(overrides?.[k])
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : DEMO_DEFAULTS[k]
  }
  return {
    inactivityDays:    pick('inactivityDays'),
    hardCapDays:       pick('hardCapDays'),
    warningDays:       pick('warningDays'),
    maxAnalysesPerOrg: pick('maxAnalysesPerOrg'),
    maxActiveOrgs:     pick('maxActiveOrgs'),
  }
}

/**
 * Vrai si une organisation démo a atteint son plafond d'analyses (anti-abus sur le
 * site public). Pur → testé unitairement. `count` = nombre d'analyses de l'org.
 */
export function analysisCapReached(count: number, cfg: DemoConfig = DEMO_DEFAULTS): boolean {
  return count >= cfg.maxAnalysesPerOrg
}

const DAY_MS = 24 * 60 * 60 * 1000

interface OrgLifecycle {
  createdAt: Date
  lastActivityAt?: Date | null
}

/**
 * Date de purge d'une organisation démo : le plus TÔT entre
 *   - dernière activité + inactivityDays (ou création si aucune activité) ;
 *   - création + hardCapDays.
 */
export function orgExpiresAt(org: OrgLifecycle, cfg: DemoConfig = DEMO_DEFAULTS): Date {
  const last = org.lastActivityAt ?? org.createdAt
  const inactivity = last.getTime() + cfg.inactivityDays * DAY_MS
  const hardCap = org.createdAt.getTime() + cfg.hardCapDays * DAY_MS
  return new Date(Math.min(inactivity, hardCap))
}

/** Vrai si l'organisation démo doit être purgée à `now`. */
export function isOrgExpired(org: OrgLifecycle, cfg: DemoConfig = DEMO_DEFAULTS, now: Date = new Date()): boolean {
  return now.getTime() >= orgExpiresAt(org, cfg).getTime()
}

/** Nombre de jours (arrondi au supérieur) avant purge ; 0 si déjà expirée. */
export function daysUntilPurge(org: OrgLifecycle, cfg: DemoConfig = DEMO_DEFAULTS, now: Date = new Date()): number {
  const remainingMs = orgExpiresAt(org, cfg).getTime() - now.getTime()
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / DAY_MS)
}

/** Vrai si l'on est dans la fenêtre de préavis (proche expiration, pas encore expirée). */
export function shouldWarn(org: OrgLifecycle, cfg: DemoConfig = DEMO_DEFAULTS, now: Date = new Date()): boolean {
  const d = daysUntilPurge(org, cfg, now)
  return d > 0 && d <= cfg.warningDays
}
