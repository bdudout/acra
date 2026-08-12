// ─── Reporting réglementaire — Registre d'incidents ICT (DORA) ───────────────
// Aide à la CLASSIFICATION d'un incident lié aux TIC selon les critères du
// règlement DORA (UE 2022/2554, art. 18) et de son RTS de classification
// (règlement délégué UE 2024/1772). Sept critères ; un incident est « MAJEUR »
// s'il touche des services CRITIQUES et au moins un autre critère, OU s'il déclenche
// au moins deux critères. Outil d'AIDE À LA DÉCISION — ne vaut pas qualification
// réglementaire officielle. Logique PURE et testée.

export const DORA_CLASSES = ['MAJEUR', 'SIGNIFICATIF', 'MINEUR'] as const
export type DoraClasse = (typeof DORA_CLASSES)[number]

// Seuils par défaut (paramétrables ultérieurement). Alignés sur des repères DORA
// (ex. indisponibilité > 2 h, impact économique > 100 000 €).
export interface DoraSeuils {
  clients: number // nb de clients / contreparties affectés
  transactions: number // nb de transactions affectées
  dureeMinutes: number // durée d'indisponibilité (minutes)
  impactEconomique: number // coût (€)
}

export const DORA_SEUILS_DEFAUT: DoraSeuils = {
  clients: 1000,
  transactions: 1000,
  dureeMinutes: 120,
  impactEconomique: 100_000,
}

// Critères saisis pour un incident (tous facultatifs ; absent = non déclenché).
export interface DoraCriteres {
  clientsAffectes?: number | null
  transactionsAffectees?: number | null
  dureeIndispoMinutes?: number | null
  impactEconomique?: number | null
  reputation?: boolean // atteinte à la réputation
  etendueGeo?: boolean // ≥ 2 États membres touchés
  pertesDonnees?: boolean // perte de disponibilité/intégrité/confidentialité
  serviceCritique?: boolean // services ou fonctions critiques touchés
}

// Les 7 critères « secondaires » (hors « services critiques », traité à part).
export const DORA_CRITERES_SECONDAIRES = [
  'clients', 'transactions', 'duree', 'economique', 'reputation', 'geo', 'donnees',
] as const
export type DoraCritere = (typeof DORA_CRITERES_SECONDAIRES)[number] | 'serviceCritique'

const nb = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Liste des critères déclenchés pour un incident, selon les seuils. */
export function criteresDeclenches(c: DoraCriteres, seuils: DoraSeuils = DORA_SEUILS_DEFAUT): DoraCritere[] {
  const out: DoraCritere[] = []
  if (nb(c.clientsAffectes) >= seuils.clients && seuils.clients > 0) out.push('clients')
  if (nb(c.transactionsAffectees) >= seuils.transactions && seuils.transactions > 0) out.push('transactions')
  if (nb(c.dureeIndispoMinutes) >= seuils.dureeMinutes && seuils.dureeMinutes > 0) out.push('duree')
  if (nb(c.impactEconomique) >= seuils.impactEconomique && seuils.impactEconomique > 0) out.push('economique')
  if (c.reputation) out.push('reputation')
  if (c.etendueGeo) out.push('geo')
  if (c.pertesDonnees) out.push('donnees')
  if (c.serviceCritique) out.push('serviceCritique')
  return out
}

export interface DoraEvaluation {
  classe: DoraClasse
  serviceCritique: boolean
  declenches: DoraCritere[]
  nbSecondaires: number // critères secondaires déclenchés (hors serviceCritique)
}

/**
 * Classe un incident TIC. MAJEUR si services critiques touchés + ≥1 autre critère,
 * ou ≥2 critères secondaires. SIGNIFICATIF si exactement 1 signal. MINEUR sinon.
 */
export function classifierIncident(c: DoraCriteres, seuils: DoraSeuils = DORA_SEUILS_DEFAUT): DoraEvaluation {
  const declenches = criteresDeclenches(c, seuils)
  const serviceCritique = declenches.includes('serviceCritique')
  const nbSecondaires = declenches.filter(d => d !== 'serviceCritique').length
  const majeur = serviceCritique ? nbSecondaires >= 1 : nbSecondaires >= 2
  const significatif = !majeur && (serviceCritique || nbSecondaires >= 1)
  const classe: DoraClasse = majeur ? 'MAJEUR' : significatif ? 'SIGNIFICATIF' : 'MINEUR'
  return { classe, serviceCritique, declenches, nbSecondaires }
}

const DORA_CRITERE_KEYS = [
  'clientsAffectes', 'transactionsAffectees', 'dureeIndispoMinutes', 'impactEconomique',
  'reputation', 'etendueGeo', 'pertesDonnees', 'serviceCritique',
] as const

/** Un incident est « évalué DORA » dès qu'au moins un critère est renseigné. */
export function estEvalueDora(c: DoraCriteres | null | undefined): boolean {
  if (!c || typeof c !== 'object') return false
  return DORA_CRITERE_KEYS.some(k => {
    const v = (c as Record<string, unknown>)[k]
    return typeof v === 'number' ? Number.isFinite(v) : v === true
  })
}

/** Normalise les critères saisis (nombres finis ou null ; booléens stricts). */
export function cleanDoraCriteres(input: unknown): DoraCriteres {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return {
    clientsAffectes: num(src.clientsAffectes),
    transactionsAffectees: num(src.transactionsAffectees),
    dureeIndispoMinutes: num(src.dureeIndispoMinutes),
    impactEconomique: num(src.impactEconomique),
    reputation: src.reputation === true,
    etendueGeo: src.etendueGeo === true,
    pertesDonnees: src.pertesDonnees === true,
    serviceCritique: src.serviceCritique === true,
  }
}

// ─── Synthèses réglementaires ────────────────────────────────────────────────

export interface DoraSynthese {
  evalues: number // incidents évalués DORA
  majeurs: number
  significatifs: number
  mineurs: number
}

export function synthetiserDora(classes: DoraClasse[]): DoraSynthese {
  const s: DoraSynthese = { evalues: classes.length, majeurs: 0, significatifs: 0, mineurs: 0 }
  for (const c of classes) {
    if (c === 'MAJEUR') s.majeurs++
    else if (c === 'SIGNIFICATIF') s.significatifs++
    else s.mineurs++
  }
  return s
}

// ─── LDC (ACPR) — collecte des données de pertes ─────────────────────────────
// Agrégat des pertes des incidents pour la remise ACPR (arrêté du 3-11-2014).

export interface LdcLigne {
  montantBrut: number | null
  recuperations: number | null
  statut: string // exclut les REJETE
}

export interface LdcSynthese {
  nbIncidents: number // hors REJETE
  perteBruteTotale: number
  recuperationsTotales: number
  perteNetteTotale: number
}

export function synthetiserLdc(lignes: LdcLigne[]): LdcSynthese {
  const s: LdcSynthese = { nbIncidents: 0, perteBruteTotale: 0, recuperationsTotales: 0, perteNetteTotale: 0 }
  for (const l of lignes) {
    if (l.statut === 'REJETE') continue
    s.nbIncidents++
    const brut = typeof l.montantBrut === 'number' ? l.montantBrut : 0
    const recup = typeof l.recuperations === 'number' ? l.recuperations : 0
    s.perteBruteTotale += brut
    s.recuperationsTotales += recup
    s.perteNetteTotale += Math.max(0, brut - recup)
  }
  const round = (n: number) => Math.round(n * 100) / 100
  s.perteBruteTotale = round(s.perteBruteTotale)
  s.recuperationsTotales = round(s.recuperationsTotales)
  s.perteNetteTotale = round(s.perteNetteTotale)
  return s
}
