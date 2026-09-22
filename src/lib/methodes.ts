// ─── Méthodes d'analyse de risque (registre PUR) ─────────────────────────────
// Rend la MÉTHODE d'analyse configurable (cf. docs/methodes-analyse-cadrage.md).
// EBIOS RM reste le défaut et la seule méthode dont l'UI d'ateliers est câblée en
// phase 1 (`IMPLEMENTED_METHODS`). Ce module est PUR (aucun accès DB) : registre
// des méthodes + jeux d'étapes + résolution de l'ensemble effectif. Les libellés
// d'étapes/normes définitifs seront repris des sources OFFICIELLES (ISO/NIST/ANSSI,
// versions citées) — les `labelKey` ci-dessous pointent vers l'i18n.

/** Méthodes d'analyse de risque connues. EBIOS RM = défaut. */
export const RISK_METHODS = ['EBIOS_RM', 'ISO_27005', 'NIST_800_30', 'ISO_31000'] as const
export type RiskMethod = (typeof RISK_METHODS)[number]

/** Méthode par défaut (rétrocompatibilité : toute analyse sans méthode = EBIOS RM). */
export const DEFAULT_METHOD: RiskMethod = 'EBIOS_RM'

/** Méthodes dont le parcours (UI) est réellement câblé : EBIOS RM + ISO 31000 simple. */
export const IMPLEMENTED_METHODS: readonly RiskMethod[] = ['EBIOS_RM', 'ISO_31000']

/**
 * Méthodes à **saisie directe** des risques (gravité × vraisemblance saisis
 * directement), par opposition à EBIOS RM où les risques sont **dérivés** des
 * scénarios opérationnels. Détermine si l'API de saisie directe est autorisée.
 */
export const DIRECT_RISK_METHODS: readonly RiskMethod[] = ['ISO_31000']

/** Vrai si la méthode apprécie les risques par saisie directe (pas via scénarios). */
export function usesDirectRiskEntry(m: string): boolean {
  return isRiskMethod(m) && DIRECT_RISK_METHODS.includes(m)
}

/**
 * Assainit la liste des méthodes ACTIVÉES au niveau instance (SUPER_ADMIN) : ne
 * garde que des méthodes connues **et câblées** (`IMPLEMENTED_METHODS`), et
 * **impose EBIOS RM** (garde-fou : l'instance a toujours au moins EBIOS RM).
 */
export function cleanActiveMethodes(v: unknown): RiskMethod[] {
  const arr = Array.isArray(v) ? v : []
  const set = new Set<RiskMethod>([DEFAULT_METHOD])
  for (const x of arr) if (isRiskMethod(x) && IMPLEMENTED_METHODS.includes(x)) set.add(x)
  return RISK_METHODS.filter(m => set.has(m))
}

/** Vrai si `v` est une méthode connue. */
export function isRiskMethod(v: unknown): v is RiskMethod {
  return typeof v === 'string' && (RISK_METHODS as readonly string[]).includes(v)
}

/** Métadonnées d'une méthode (référentiel d'origine, nature). */
export interface MethodMeta {
  /** Norme/guide de référence (pour affichage + citation de version). */
  standard: string
  /** Clé i18n du nom court. */
  labelKey: string
  /** Méthode cyber/SI approfondie (vs générique/opérationnelle). */
  cyber: boolean
}

export const METHOD_META: Record<RiskMethod, MethodMeta> = {
  EBIOS_RM:    { standard: 'EBIOS Risk Manager (ANSSI, 2018)',        labelKey: 'methodes.ebiosRm.nom',   cyber: true },
  ISO_27005:   { standard: 'ISO/IEC 27005:2022',                      labelKey: 'methodes.iso27005.nom',  cyber: true },
  NIST_800_30: { standard: 'NIST SP 800-30 Rev. 1',                   labelKey: 'methodes.nist80030.nom', cyber: true },
  ISO_31000:   { standard: 'ISO 31000:2018',                          labelKey: 'methodes.iso31000.nom',  cyber: false },
}

/** Étape d'une méthode (ordre + clé stable + clé i18n de libellé). */
export interface MethodStep {
  num: number
  key: string
  labelKey: string
}

// Jeux d'étapes par méthode. EBIOS RM = les 5 ateliers existants (inchangés).
// Les autres sont déclarés (data model complet) mais leur UI n'est pas encore
// câblée (cf. IMPLEMENTED_METHODS) ; leurs libellés officiels restent à confirmer.
export const METHOD_STEPS: Record<RiskMethod, MethodStep[]> = {
  EBIOS_RM: [
    { num: 1, key: 'cadrage-socle',        labelKey: 'methodes.ebiosRm.a1' },
    { num: 2, key: 'sources-risque',       labelKey: 'methodes.ebiosRm.a2' },
    { num: 3, key: 'scenarios-strat',      labelKey: 'methodes.ebiosRm.a3' },
    { num: 4, key: 'scenarios-op',         labelKey: 'methodes.ebiosRm.a4' },
    { num: 5, key: 'traitement',           labelKey: 'methodes.ebiosRm.a5' },
  ],
  // ISO 31000:2018 « simple » (risque opérationnel) : appréciation qualitative G×V.
  ISO_31000: [
    { num: 1, key: 'perimetre-criteres',   labelKey: 'methodes.iso31000.s1' },
    { num: 2, key: 'appreciation',         labelKey: 'methodes.iso31000.s2' },
    { num: 3, key: 'traitement',           labelKey: 'methodes.iso31000.s3' },
  ],
  // ISO/IEC 27005:2022 (phases) — libellés officiels à reprendre à l'implémentation.
  ISO_27005: [
    { num: 1, key: 'contexte',             labelKey: 'methodes.iso27005.s1' },
    { num: 2, key: 'identification',       labelKey: 'methodes.iso27005.s2' },
    { num: 3, key: 'analyse',              labelKey: 'methodes.iso27005.s3' },
    { num: 4, key: 'evaluation',           labelKey: 'methodes.iso27005.s4' },
    { num: 5, key: 'traitement',           labelKey: 'methodes.iso27005.s5' },
  ],
  // NIST SP 800-30 Rev.1 — Prepare / Conduct / Communicate / Maintain.
  NIST_800_30: [
    { num: 1, key: 'prepare',              labelKey: 'methodes.nist80030.s1' },
    { num: 2, key: 'conduct',              labelKey: 'methodes.nist80030.s2' },
    { num: 3, key: 'communicate',          labelKey: 'methodes.nist80030.s3' },
    { num: 4, key: 'maintain',             labelKey: 'methodes.nist80030.s4' },
  ],
}

/** Étapes ordonnées d'une méthode (repli sur EBIOS RM si méthode inconnue). */
export function methodSteps(m: string): MethodStep[] {
  return METHOD_STEPS[(isRiskMethod(m) ? m : DEFAULT_METHOD)]
}

/** Nombre d'étapes d'une méthode (utile pour la progression / bornage `atelierCourant`). */
export function methodStepCount(m: string): number {
  return methodSteps(m).length
}

// ── Résolution de l'ensemble effectif (config à 3 niveaux) ───────────────────

/** Entrées de résolution (toutes optionnelles ; absentes = pas de restriction). */
export interface MethodResolution {
  /** Méthodes activées au niveau instance (SUPER_ADMIN). */
  instanceEnabled?: readonly string[] | null
  /** Méthodes autorisées au niveau organisation (ADMIN). */
  orgAllowed?: readonly string[] | null
  /** Méthode par défaut souhaitée pour l'organisation. */
  orgDefault?: string | null
}

/**
 * Ensemble EFFECTIF des méthodes proposables + la méthode par défaut. Règles :
 *  - on part des méthodes réellement **câblées** (`IMPLEMENTED_METHODS`) ;
 *  - on intersecte avec l'activation d'instance puis l'autorisation d'org (si
 *    fournies) ;
 *  - **EBIOS RM est toujours disponible** (garde-fou : jamais d'org sans méthode) ;
 *  - le défaut est `orgDefault` s'il est disponible, sinon EBIOS RM.
 */
export function resolveMethodes(opts: MethodResolution = {}): { available: RiskMethod[]; default: RiskMethod } {
  const inInstance = (m: RiskMethod) => !opts.instanceEnabled || opts.instanceEnabled.includes(m)
  const inOrg = (m: RiskMethod) => !opts.orgAllowed || opts.orgAllowed.includes(m)
  const available = IMPLEMENTED_METHODS.filter(m => inInstance(m) && inOrg(m))
  // Garde-fou : EBIOS RM toujours présent (et en tête).
  const set = new Set<RiskMethod>([DEFAULT_METHOD, ...available])
  const ordered = RISK_METHODS.filter(m => set.has(m))
  const def: RiskMethod = isRiskMethod(opts.orgDefault) && ordered.includes(opts.orgDefault)
    ? opts.orgDefault
    : DEFAULT_METHOD
  return { available: ordered, default: def }
}
