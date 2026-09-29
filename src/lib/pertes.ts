/**
 * pertes.ts — Pertes d'un incident : lignes typées, récupérations, devises, seuils.
 * Module PUR. Généralise le triptyque brut / récupérations / net de la LDC (Bâle) :
 * une perte = plusieurs COMPOSANTES (perte directe, provision, réparation, pénalité,
 * manque à gagner…) dans des devises éventuellement différentes. Les types sont des
 * codes d'un catalogue éditable par organisation ; les libellés sont traduits (i18n).
 * Les agrégats `montantBrut` / `recuperations` de l'incident restent la somme des lignes
 * en devise de référence (rétrocompatibilité des exports et du cockpit).
 */

export const TYPES_PERTE = ['PERTE_DIRECTE', 'PROVISION', 'REPARATION', 'PENALITE', 'MANQUE_A_GAGNER', 'AUTRE'] as const
export const TYPES_RECUPERATION = ['ASSURANCE', 'TIERS', 'CLIENT', 'AUTRE'] as const
export const STATUTS_LIGNE = ['ESTIME', 'PROVISIONNE', 'COMPTABILISE'] as const
export type StatutLigne = (typeof STATUTS_LIGNE)[number]

export interface LignePerte { type: string; montant: number; devise: string; date?: string; statut: StatutLigne }
export interface LigneRecuperation { type: string; montant: number; devise: string; date?: string }
export interface DevisesConfig { deviseReference: string; taux: Record<string, number> }
export interface SeuilsPertes { seuilCollecte: number | null; seuilGrandePerte: number | null }

const CODE_RE = /^[A-Za-z0-9_-]{1,40}$/
const DEVISE_RE = /^[A-Za-z]{3}$/
const MAX_LIGNES = 50
const MAX_MONTANT = 1e12
const r2 = (n: number) => Math.round(n * 100) / 100

function ligne(raw: unknown, deviseRef: string): { type: string; montant: number; devise: string; date?: string; statut?: unknown } | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.type !== 'string' || !o.type.trim()) return null
  if (typeof o.montant !== 'number' || !Number.isFinite(o.montant) || o.montant < 0 || o.montant > MAX_MONTANT) return null
  const t = o.type.trim()
  const type = CODE_RE.test(t) ? t : 'AUTRE'
  const devise = typeof o.devise === 'string' && DEVISE_RE.test(o.devise.trim()) ? o.devise.trim().toUpperCase() : deviseRef
  const d = typeof o.date === 'string' ? new Date(o.date) : null
  return { type, montant: r2(o.montant), devise, ...(d && !Number.isNaN(d.getTime()) ? { date: d.toISOString() } : {}), statut: o.statut }
}

/** Nettoie les lignes de perte saisies (types, devises, montants, dates). */
export function sanitizePertes(input: unknown, deviseRef: string): LignePerte[] {
  if (!Array.isArray(input)) return []
  const out: LignePerte[] = []
  for (const raw of input) {
    if (out.length >= MAX_LIGNES) break
    const l = ligne(raw, deviseRef)
    if (!l) continue
    const statut = (STATUTS_LIGNE as readonly string[]).includes(l.statut as string) ? (l.statut as StatutLigne) : 'ESTIME'
    out.push({ type: l.type, montant: l.montant, devise: l.devise, ...(l.date ? { date: l.date } : {}), statut })
  }
  return out
}

/** Nettoie les lignes de récupération (assurance, tiers responsable, client…). */
export function sanitizeRecuperations(input: unknown, deviseRef: string): LigneRecuperation[] {
  if (!Array.isArray(input)) return []
  const out: LigneRecuperation[] = []
  for (const raw of input) {
    if (out.length >= MAX_LIGNES) break
    const l = ligne(raw, deviseRef)
    if (!l) continue
    out.push({ type: l.type, montant: l.montant, devise: l.devise, ...(l.date ? { date: l.date } : {}) })
  }
  return out
}

function convertir(montant: number, devise: string, cfg: DevisesConfig, sansTaux: Set<string>): number {
  if (devise === cfg.deviseReference) return montant
  const t = cfg.taux[devise]
  if (typeof t !== 'number' || !(t > 0)) { sansTaux.add(devise); return 0 }
  return montant * t
}

export interface TotauxPertes { brut: number | null; recuperations: number | null; net: number | null; devisesSansTaux: string[] }

/**
 * Totaux en devise de référence. Une devise sans taux est EXCLUE et signalée (jamais
 * convertie à un taux inventé). Sans aucune ligne : null (pas de perte inventée).
 */
export function totauxPertes(pertes: LignePerte[], recups: LigneRecuperation[], cfg: DevisesConfig): TotauxPertes {
  if (pertes.length === 0 && recups.length === 0) return { brut: null, recuperations: null, net: null, devisesSansTaux: [] }
  const sansTaux = new Set<string>()
  const brut = r2(pertes.reduce((s, l) => s + convertir(l.montant, l.devise, cfg, sansTaux), 0))
  const recup = recups.length ? r2(recups.reduce((s, l) => s + convertir(l.montant, l.devise, cfg, sansTaux), 0)) : null
  return { brut, recuperations: recup, net: r2(brut - (recup ?? 0)), devisesSansTaux: [...sansTaux].sort() }
}

/** Seuils : sous le seuil de collecte → non collectée ; au moins au seuil de grande perte → escalade. */
export function evaluerSeuils(net: number | null, s: SeuilsPertes): { collectee: boolean; grandePerte: boolean } {
  if (net === null) return { collectee: true, grandePerte: false }
  return {
    collectee: s.seuilCollecte === null || net >= s.seuilCollecte,
    grandePerte: s.seuilGrandePerte !== null && net >= s.seuilGrandePerte,
  }
}

/** Brut converti ventilé par type de perte (reporting). */
export function pertesParType(pertes: LignePerte[], cfg: DevisesConfig): Record<string, number> {
  const out: Record<string, number> = {}
  const sansTaux = new Set<string>()
  for (const l of pertes) out[l.type] = r2((out[l.type] ?? 0) + convertir(l.montant, l.devise, cfg, sansTaux))
  return out
}
