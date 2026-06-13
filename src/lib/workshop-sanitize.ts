/**
 * workshop-sanitize.ts — Allowlists de sauvegarde des ateliers EBIOS RM (F006 / CWE-915).
 *
 * La route PUT /api/analyses/[id]/workshop/[num] persiste des entités envoyées par
 * le client. Pour éviter l'assignation de masse (mass assignment) et l'incohérence
 * de durcissement entre ateliers, chaque entité passe par une allowlist EXPLICITE :
 * seuls les champs du schéma Prisma sont retenus, typés et bornés en taille. Tout
 * champ inconnu (champ UI calculé, injection) est silencieusement ignoré — ce qui
 * rend aussi la sauvegarde plus robuste que l'ancien spread `...rest` (qui faisait
 * échouer Prisma au moindre champ hors-schéma).
 *
 * Même esprit que les helpers cleanXxx de src/app/api/import/route.ts.
 */

type Dict = Record<string, unknown>

/** Chaîne bornée ; undefined si la valeur est absente (laisse le défaut Prisma jouer). */
function str(v: unknown, max: number): string | undefined {
  return v != null ? String(v).slice(0, max) : undefined
}
/** Entier ; retombe sur `def` si non numérique (mirroir des helpers d'import). */
function num(v: unknown, def: number): number {
  return Number(v) || def
}
/** Entier optionnel ; undefined si absent (laisse le défaut Prisma jouer). */
function optNum(v: unknown): number | undefined {
  return v != null ? Number(v) : undefined
}
/** Booléen explicite ; undefined si absent (laisse le défaut Prisma jouer). */
function optBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}
/** Valeur JSON (objet/tableau) ; undefined sinon. */
function json(v: unknown): unknown {
  return Array.isArray(v) || (v !== null && typeof v === 'object') ? v : undefined
}

// ── Atelier 2 : Sources de risque ─────────────────────────────────────────────
export function cleanSourceRisque(s: Dict, analyseId: string) {
  return {
    analyseId,
    nom:             String(s.nom ?? '').slice(0, 255),
    categorie:       s.categorie as never, // enum CategorieSource — validé par Prisma
    description:     str(s.description, 5000),
    motivation:      str(s.motivation, 2000),
    ressources:      str(s.ressources, 2000),
    activite:        str(s.activite, 2000),
    motivationScore: optNum(s.motivationScore),
    ressourcesScore: optNum(s.ressourcesScore),
    activiteScore:   optNum(s.activiteScore),
    pertinence:      num(s.pertinence, 1),
    objectifsVises:  json(s.objectifsVises) as never,
    retenu:          optBool(s.retenu),
    justification:   str(s.justification, 5000),
  }
}

// ── Atelier 3 : Parties prenantes ─────────────────────────────────────────────
export function cleanPartiePrenante(p: Dict, analyseId: string) {
  return {
    analyseId,
    nom:           String(p.nom ?? '').slice(0, 255),
    type:          p.type as never, // enum TypePartiePrenante — validé par Prisma
    description:   str(p.description, 5000),
    exposition:    num(p.exposition, 1),
    fiabilite:     num(p.fiabilite, 3),
    vulnerabilite: num(p.vulnerabilite, 2),
  }
}

// ── Atelier 3 : Scénarios stratégiques ────────────────────────────────────────
export function cleanScenarioStrategique(s: Dict, analyseId: string) {
  return {
    analyseId,
    nom:                 String(s.nom ?? '').slice(0, 255),
    sourceRisqueId:      str(s.sourceRisqueId, 255),
    objectifVise:        str(s.objectifVise, 500),
    description:         str(s.description, 5000),
    evenementRedouteRef: str(s.evenementRedouteRef, 255),
    cheminAttaque:       json(s.cheminAttaque) as never,
    mesuresEcosysteme:   json(s.mesuresEcosysteme) as never,
    vraisemblance:       num(s.vraisemblance, 2),
    gravite:             num(s.gravite, 2),
    niveauRisque:        num(s.niveauRisque, 4),
    retenu:              optBool(s.retenu),
  }
}

// ── Atelier 4 : Scénarios opérationnels ───────────────────────────────────────
export function cleanScenarioOperationnel(s: Dict, analyseId: string) {
  return {
    analyseId,
    nom:                   String(s.nom ?? '').slice(0, 255),
    scenarioStrategiqueId: str(s.scenarioStrategiqueId, 255),
    description:           str(s.description, 5000),
    actionsElementaires:   json(s.actionsElementaires) as never,
    vraisemblance:         num(s.vraisemblance, 2),
    gravite:               num(s.gravite, 2),
  }
}
