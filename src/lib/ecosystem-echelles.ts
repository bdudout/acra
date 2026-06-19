/**
 * ecosystem-echelles.ts — Échelles de cotation des 4 sous-critères de dangerosité
 * des parties prenantes (Atelier 3 EBIOS RM), configurables par l'organisation.
 *
 * Méthode Club EBIOS (Fiche méthode 5) :
 *   exposition = dépendance × pénétration  (↑ menace)
 *   fiabilité  = maturité  × confiance      (↓ menace)
 *   menace     = exposition / fiabilité
 *
 * Chaque critère est une échelle qualitative ordonnée (1..N) dont chaque niveau
 * porte un NOM (et une description optionnelle). Échelles 1→4 par défaut, mais
 * l'admin peut les adapter (renommer les niveaux, en ajouter/retirer) — le guide
 * autorise explicitement de calibrer la métrique au contexte.
 *
 * Modèle « remplace les défauts » : un override (objet non vide stocké dans
 * OrganizationConfig.echellesEcosysteme) est utilisé tel quel ; sinon repli sur
 * ECHELLES_ECOSYSTEME_DEFAUT. Même esprit que exemples-ateliers.ts.
 *
 * Module pur (sans React/Prisma) → réutilisé par l'atelier 3, le radar, le PDF,
 * /tiers et l'éditeur de configuration.
 */

export type CritereEcosysteme = 'dependance' | 'penetration' | 'maturite' | 'confiance'

export const CRITERES_ECOSYSTEME: CritereEcosysteme[] = ['dependance', 'penetration', 'maturite', 'confiance']

export interface NiveauEchelle {
  valeur: number       // rang 1..N (croissant)
  nom: string          // libellé qualitatif du niveau
  description?: string // aide optionnelle
}

export interface EchelleCritere {
  niveaux: NiveauEchelle[]
}

export type EchellesEcosysteme = Record<CritereEcosysteme, EchelleCritere>

// ─── Défauts EBIOS RM (échelles 1→4, libellés FR) ─────────────────────────────
// Sens : pour exposition (dépendance, pénétration) une valeur élevée AUGMENTE la
// menace ; pour fiabilité (maturité, confiance) une valeur élevée la DIMINUE
// (au dénominateur). Aligné sur les exemples du guide (régulateur : confiance 4).
export const ECHELLES_ECOSYSTEME_DEFAUT: EchellesEcosysteme = {
  dependance: {
    niveaux: [
      { valeur: 1, nom: 'Nulle', description: "L'objet de l'étude ne dépend pas de cette partie prenante." },
      { valeur: 2, nom: 'Faible', description: 'Dépendance occasionnelle ou facilement substituable.' },
      { valeur: 3, nom: 'Significative', description: 'Dépendance importante pour une activité clé.' },
      { valeur: 4, nom: 'Vitale', description: "Dépendance critique : l'activité s'arrête sans cette PP." },
    ],
  },
  penetration: {
    niveaux: [
      { valeur: 1, nom: 'Aucun accès', description: "La PP n'a aucun accès au système d'information." },
      { valeur: 2, nom: 'Accès ponctuel', description: 'Accès limité, ponctuel ou supervisé.' },
      { valeur: 3, nom: 'Accès régulier', description: 'Accès récurrent à des ressources internes.' },
      { valeur: 4, nom: 'Accès privilégié permanent', description: 'Accès profond et permanent (administration, interconnexion).' },
    ],
  },
  maturite: {
    niveaux: [
      { valeur: 1, nom: 'Inexistante', description: 'Aucune démarche de sécurité identifiable.' },
      { valeur: 2, nom: 'Faible', description: 'Pratiques de sécurité partielles ou informelles.' },
      { valeur: 3, nom: 'Satisfaisante', description: 'Démarche structurée et globalement maîtrisée.' },
      { valeur: 4, nom: 'Forte', description: 'Sécurité éprouvée (certifications, audits réguliers).' },
    ],
  },
  confiance: {
    niveaux: [
      { valeur: 1, nom: 'Aucune (méfiance)', description: "Intentions douteuses ou intérêts divergents (ex. concurrent)." },
      { valeur: 2, nom: 'Faible', description: 'Confiance limitée, peu de visibilité sur la PP.' },
      { valeur: 3, nom: 'Moyenne', description: 'Relation établie, confiance raisonnable.' },
      { valeur: 4, nom: 'Pleine confiance', description: 'Relation de confiance forte et durable (ex. régulateur).' },
    ],
  },
}

const isEchelle = (e: unknown): e is EchelleCritere =>
  !!e && typeof e === 'object' && Array.isArray((e as EchelleCritere).niveaux) && (e as EchelleCritere).niveaux.length >= 2

/**
 * Fusionne un override (depuis OrganizationConfig) avec les défauts : pour chaque
 * critère, l'échelle override valide remplace le défaut ; sinon on garde le défaut.
 */
export function resolveEchelles(override?: Partial<EchellesEcosysteme> | null): EchellesEcosysteme {
  const out = {} as EchellesEcosysteme
  for (const c of CRITERES_ECOSYSTEME) {
    const o = override?.[c]
    out[c] = isEchelle(o) ? o : ECHELLES_ECOSYSTEME_DEFAUT[c]
  }
  return out
}

/** Valeur maximale (= nombre de niveaux) d'un critère. */
export function maxValeur(echelle: EchelleCritere): number {
  return echelle.niveaux.reduce((m, n) => Math.max(m, n.valeur), 1)
}

/** Nom du niveau le plus proche d'une valeur (flottante) sur l'échelle. */
export function nomNiveau(echelle: EchelleCritere, valeur: number): string {
  if (!echelle.niveaux.length) return ''
  let best = echelle.niveaux[0]
  for (const n of echelle.niveaux) {
    if (Math.abs(n.valeur - valeur) < Math.abs(best.valeur - valeur)) best = n
  }
  return best.nom
}

export interface BornesEcosysteme {
  maxExpo: number    // dépendanceMax × pénétrationMax
  maxFiab: number    // maturitéMax × confianceMax
  menaceMin: number  // 1 / maxFiab
  menaceMax: number  // maxExpo
}

/**
 * Valide/normalise un override d'échelles reçu du client (API config) :
 * - ne garde que les 4 critères connus ;
 * - renumérote `valeur` en 1..n (ignore la valeur cliente) ;
 * - borne les libellés, retire les niveaux sans nom, plafonne à 10 niveaux ;
 * - exige ≥ 2 niveaux par échelle, sinon la clé est omise (⇒ repli sur le défaut).
 */
export function sanitizeEchelles(input: unknown): Partial<EchellesEcosysteme> {
  const out: Partial<EchellesEcosysteme> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  for (const c of CRITERES_ECOSYSTEME) {
    const e = (input as Record<string, unknown>)[c] as { niveaux?: unknown } | undefined
    if (!e || typeof e !== 'object' || !Array.isArray(e.niveaux)) continue
    const niveaux: NiveauEchelle[] = e.niveaux
      .slice(0, 10)
      .map((n: unknown, i: number) => {
        const nn = (n ?? {}) as { nom?: unknown; description?: unknown }
        const nom = String(nn.nom ?? '').trim().slice(0, 60)
        const description = String(nn.description ?? '').trim().slice(0, 300)
        return description
          ? { valeur: i + 1, nom, description }
          : { valeur: i + 1, nom }
      })
      .filter((n) => n.nom.length > 0)
      .map((n, i) => ({ ...n, valeur: i + 1 })) // renumérote après filtrage
    if (niveaux.length >= 2) out[c] = { niveaux }
  }
  return out
}

/** Bornes de la menace dérivées des échelles (pour adapter le rayon du radar). */
export function bornesMenace(echelles: EchellesEcosysteme): BornesEcosysteme {
  const maxExpo = maxValeur(echelles.dependance) * maxValeur(echelles.penetration)
  const maxFiab = maxValeur(echelles.maturite) * maxValeur(echelles.confiance)
  return {
    maxExpo,
    maxFiab,
    menaceMin: 1 / maxFiab,
    menaceMax: maxExpo,
  }
}
