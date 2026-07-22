/**
 * Assainissement des analyses importées (JSON/CSV) — fonctions PURES et testables.
 *
 * Objectifs de sécurité (#117) :
 *  - **Cap de cardinalité** (`capArr`, `IMPORT_MAX_ITEMS`) : un fichier importé ne
 *    peut pas créer un nombre illimité d'enregistrements (anti-DoS / anti-abus du
 *    stockage). La limite de 2 Mo du payload ne borne PAS le nombre d'items (des
 *    milliers de petits objets tiennent dans 2 Mo).
 *  - **Clamp des cotations** (`clampInt`) : les scores importés (gravité,
 *    vraisemblance, niveau de risque, priorité, efficacité…) sont ramenés dans
 *    leur plage EBIOS valide. Sans cela `Number(x) || def` laisse passer 9999,
 *    -5 ou 42, qui faussent la matrice des risques et les graphiques.
 *
 * Allowlist par modèle : évite aussi le mass-assignment si le schéma évolue.
 */

/** Nombre maximal d'éléments conservés par collection importée. */
export const IMPORT_MAX_ITEMS = 500

/** Tronque un tableau à `max` éléments ; renvoie `[]` si l'entrée n'est pas un tableau. */
export function capArr<T = unknown>(arr: unknown, max: number = IMPORT_MAX_ITEMS): T[] {
  return Array.isArray(arr) ? (arr.slice(0, max) as T[]) : []
}

/**
 * Ramène `v` à un entier dans `[min, max]`. Conserve la sémantique historique
 * `Number(x) || def` : une valeur absente / non numérique / nulle / zéro retombe
 * sur `def` (les échelles EBIOS commencent à 1, donc 0 est invalide). Une valeur
 * fournie mais hors plage (négative ou trop grande) est ramenée dans `[min, max]`.
 * Si `def` est omis, renvoie `undefined` dans ces cas (pour les champs optionnels).
 */
export function clampInt(v: unknown, min: number, max: number, def?: number): number | undefined {
  const n = Number(v)
  if (!Number.isFinite(n) || n === 0) return def
  return Math.max(min, Math.min(max, Math.round(n)))
}

// ─── Cleaners par modèle ────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export function cleanCadrage(obj: any): any {
  if (!obj) return obj
  const capJson = (a: unknown) => (Array.isArray(a) ? a.slice(0, IMPORT_MAX_ITEMS) : undefined)
  return {
    perimetre:    obj.perimetre    != null ? String(obj.perimetre).slice(0, 5000)  : undefined,
    tailleAnalyse: ['STANDARD', 'TPE', 'PME', 'ETI_GE'].includes(obj.tailleAnalyse) ? obj.tailleAnalyse : undefined,
    contexte:     obj.contexte     != null ? String(obj.contexte).slice(0, 5000)   : undefined,
    objectifs:    obj.objectifs    != null ? String(obj.objectifs).slice(0, 5000)  : undefined,
    evenementsRedoutes: capJson(obj.evenementsRedoutes),
    valeursMetier:      capJson(obj.valeursMetier),
    biensSupports:      capJson(obj.biensSupports),
    missions:           capJson(obj.missions),
    referentiel:  obj.referentiel != null ? String(obj.referentiel).slice(0, 100) : undefined,
  }
}

/** Catégories de source de risque valides (enum Prisma `CategorieSource`). */
const CATEGORIES_SOURCE = [
  'CYBERCRIMINEL', 'ETAT_NATION', 'CONCURRENT', 'ACTIVISTE',
  'EMPLOYE_MALVEILLANT', 'PRESTATAIRE', 'AMATEUR', 'TERRORISTE', 'AUTRE',
]

export function cleanSourceRisque(obj: any): any {
  return {
    nom:            String(obj.nom        ?? '').slice(0, 255),
    // `categorie` est un enum REQUIS : valider contre l'allowlist et retomber sur
    // AUTRE si absent/inconnu (sinon Prisma rejette tout l'import → 422).
    categorie:      CATEGORIES_SOURCE.includes(obj.categorie) ? obj.categorie : 'AUTRE',
    pertinence:     clampInt(obj.pertinence, 1, 4, 3),
    retenu:         Boolean(obj.retenu),
    // FM4 : motivation/ressources/activite sont du TEXTE LIBRE (String?) dans le
    // schéma ; les scores associés sont des entiers 1-4 séparés. L'ancien code
    // envoyait Number(motivation) dans un champ String → 422 à chaque import
    // d'une analyse comportant des sources. On respecte désormais le schéma.
    motivation:      obj.motivation != null ? String(obj.motivation).slice(0, 500) : undefined,
    ressources:      obj.ressources != null ? String(obj.ressources).slice(0, 500) : undefined,
    activite:        obj.activite   != null ? String(obj.activite).slice(0, 500)   : undefined,
    motivationScore: obj.motivationScore != null ? clampInt(obj.motivationScore, 1, 4, 1) : undefined,
    ressourcesScore: obj.ressourcesScore != null ? clampInt(obj.ressourcesScore, 1, 4, 1) : undefined,
    activiteScore:   obj.activiteScore   != null ? clampInt(obj.activiteScore, 1, 4, 1)   : undefined,
    description:    obj.description   != null ? String(obj.description).slice(0, 2000) : undefined,
    objectifsVises: capArr(obj.objectifsVises),
  }
}

export function cleanPartiePrenante(obj: any): any {
  // Méthode Club EBIOS : 4 sous-critères 1-4 → exposition = dép×pén · fiabilité = mat×conf.
  const dependance  = clampInt(obj.dependance, 1, 4, 2) as number
  const penetration = clampInt(obj.penetration, 1, 4, 2) as number
  const maturite    = clampInt(obj.maturite, 1, 4, 3) as number
  const confiance   = clampInt(obj.confiance, 1, 4, 3) as number
  return {
    nom:             String(obj.nom         ?? '').slice(0, 255),
    type:            String(obj.type        ?? 'FOURNISSEUR').slice(0, 50),
    dependance, penetration, maturite, confiance,
    exposition:      dependance * penetration,
    fiabilite:       maturite * confiance,
    description:     obj.description != null ? String(obj.description).slice(0, 2000) : undefined,
  }
}

export function cleanScenarioStrat(obj: any): any {
  return {
    nom:                  String(obj.nom             ?? '').slice(0, 255),
    vraisemblance:        clampInt(obj.vraisemblance, 1, 4, 2),
    gravite:              clampInt(obj.gravite, 1, 4, 2),
    niveauRisque:         clampInt(obj.niveauRisque, 1, 16, 4),
    retenu:               Boolean(obj.retenu),
    description:          obj.description       != null ? String(obj.description).slice(0, 2000) : undefined,
    objectifVise:         obj.objectifVise       != null ? String(obj.objectifVise).slice(0, 500) : undefined,
    sourceRisqueRef:      obj.sourceRisqueRef    != null ? String(obj.sourceRisqueRef).slice(0, 255) : undefined,
    evenementRedouteRef:  obj.evenementRedouteRef != null ? String(obj.evenementRedouteRef).slice(0, 255) : undefined,
    mesuresEcosysteme:    capArr(obj.mesuresEcosysteme),
  }
}

export function cleanScenarioOp(obj: any): any {
  return {
    nom:            String(obj.nom         ?? '').slice(0, 255),
    vraisemblance:  clampInt(obj.vraisemblance, 1, 4, 2),
    gravite:        clampInt(obj.gravite, 1, 4, 2),
    description:    obj.description != null ? String(obj.description).slice(0, 2000) : undefined,
    cheminsAttaque: capArr(obj.cheminsAttaque),
    actionsMenace:  capArr(obj.actionsMenace),
  }
}

export function cleanRisque(obj: any): any {
  return {
    nom:            String(obj.nom         ?? '').slice(0, 255),
    gravite:        clampInt(obj.gravite, 1, 4, 2),
    vraisemblance:  clampInt(obj.vraisemblance, 1, 4, 2),
    niveauRisque:   clampInt(obj.niveauRisque, 1, 16, 4),
    strategie:      obj.strategie    != null ? String(obj.strategie).slice(0, 50)   : undefined,
    niveauResiduel: obj.niveauResiduel != null ? clampInt(obj.niveauResiduel, 1, 16, 1) : undefined,
    description:    obj.description  != null ? String(obj.description).slice(0, 2000) : undefined,
    scenarioRef:    obj.scenarioRef  != null ? String(obj.scenarioRef).slice(0, 255) : undefined,
  }
}

export function cleanMesure(obj: any): any {
  return {
    nom:         String(obj.nom       ?? '').slice(0, 255),
    description: obj.description != null ? String(obj.description).slice(0, 2000) : undefined,
    type:        obj.type        != null ? String(obj.type).slice(0, 50)          : undefined,
    priorite:    clampInt(obj.priorite, 1, 4, 2),
    statut:      String(obj.statut ?? 'A_FAIRE').slice(0, 50),
    responsable: obj.responsable != null ? String(obj.responsable).slice(0, 200)  : undefined,
    entite:      obj.entite      != null ? String(obj.entite).trim().slice(0, 100): undefined,
    echeance:    obj.echeance    != null ? new Date(obj.echeance) : undefined,
    cout:        obj.cout        != null ? String(obj.cout).slice(0, 100)         : undefined,
    efficacite:  obj.efficacite  != null ? clampInt(obj.efficacite, 1, 4, 1) : undefined,
    referentiel: obj.referentiel != null ? String(obj.referentiel).slice(0, 100)  : undefined,
    codeRef:     obj.codeRef     != null ? String(obj.codeRef).slice(0, 50)       : undefined,
  }
}
