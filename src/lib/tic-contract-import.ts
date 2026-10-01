// ─── Import guidé de contrats TIC (CSV / XLSX) — moteur d'aperçu PUR ──────────────────────────────────────────────────────
// Chaque ligne reçoit un statut expliqué (prête / déjà importée / rejetée + raison). Jamais d'écrasement : une référence déjà
// présente dans l'organisation est « déjà importée ». Jamais de valeur métier inventée en silence : une criticité ou un type
// ABSENTS prennent le défaut prudent ET sont signalés ; une valeur PRÉSENTE mais inconnue rejette la ligne.
// Identité : LEI identique = candidat certain (lien posé seulement si l'utilisateur le demande) ; nom seul = candidat faible,
// jamais lié automatiquement.

import { NIVEAUX_CRITICITE, TYPES_SERVICE_TIC, type NiveauCriticite, type TypeServiceTic } from './registre-tic'
import { findTierCandidates, normalizeLei, type TierLite } from './tier-identity'

export const MAX_TIC_ROWS = 500

export interface TicContractRow { line: number; reference?: string; prestataire?: string; lei?: string; pays?: string; typeService?: string; criticite?: string; dateDebut?: string; dateFin?: string; fonction?: string }
export type TicLineStatus = 'READY' | 'ALREADY_IMPORTED' | 'REJECTED'
export type TicRejectReason = 'missing_reference' | 'missing_provider' | 'duplicate_reference' | 'invalid_criticality' | 'invalid_type' | 'invalid_date' | 'invalid_lei' | 'inconsistent_dates'
export type TicWarning = 'criticite_default' | 'type_default'
export interface PlannedTicLine {
  line: number; status: TicLineStatus; reason?: TicRejectReason; warnings: TicWarning[]
  reference: string; prestataire: string; lei?: string; pays?: string; typeService: TypeServiceTic; criticite: NiveauCriticite
  dateDebut?: string; dateFin?: string; fonction?: string
  tier?: { tierId: string; strength: 'STRONG' | 'WEAK' }
}
export interface TicImportPlan {
  lines: PlannedTicLine[]; toCreate: PlannedTicLine[]
  counts: { ready: number; alreadyImported: number; rejected: number; certainLinks: number }
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const norm = (s: string) => strip(s).replace(/[^a-z0-9]+/g, ' ').trim()
const refKey = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ')

type Field = 'reference' | 'prestataire' | 'lei' | 'pays' | 'typeService' | 'criticite' | 'dateDebut' | 'dateFin' | 'fonction'
const RULES: [Field, (h: string) => boolean][] = [
  ['dateDebut', h => /(date )?(de )?(debut|start|effet)|^start|^debut/.test(h) && /date|debut|start|effet/.test(h)],
  ['dateFin', h => /(fin|end|echeance|expiration)/.test(h) && !/fonction/.test(h)],
  ['lei', h => h === 'lei' || h.includes('lei ') || h.endsWith(' lei') || h.includes('identifiant')],
  ['typeService', h => /type/.test(h) && /(service|prestation)/.test(h) || h === 'type' || h === 'service type'],
  ['criticite', h => /critic/.test(h)],
  ['fonction', h => /fonction|function/.test(h)],
  ['pays', h => h === 'pays' || h === 'country' || h === 'pays du prestataire'],
  ['reference', h => /^(ref|reference|contrat|contract|code|id|numero)/.test(h) || /(contract|contrat) (ref|reference|id|number)/.test(h) || /^reference/.test(h)],
  ['prestataire', h => /(prestataire|provider|fournisseur|supplier|vendor|tiers|nom)/.test(h)],
]

/** Associe les en-têtes d'un fichier aux champs ; chaque colonne ne sert qu'un champ. */
export function mapTicContractColumns(headers: string[]): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {}
  const used = new Set<string>()
  for (const [field, test] of RULES) {
    const found = headers.find(h => !used.has(h) && test(norm(h)))
    if (found) { out[field] = found; used.add(found) }
  }
  return out
}

const CRIT_ALIASES: Record<string, NiveauCriticite> = { critique: 'CRITIQUE', critical: 'CRITIQUE', importante: 'IMPORTANTE', importante_: 'IMPORTANTE', important: 'IMPORTANTE', 'non critique': 'NON_CRITIQUE', 'non critical': 'NON_CRITIQUE', noncritique: 'NON_CRITIQUE', 'non-critique': 'NON_CRITIQUE', 'non critical ': 'NON_CRITIQUE' }
const parseCriticality = (raw: string): NiveauCriticite | null => {
  const up = raw.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if ((NIVEAUX_CRITICITE as readonly string[]).includes(up)) return up as NiveauCriticite
  return CRIT_ALIASES[norm(raw)] ?? null
}
const parseType = (raw: string): TypeServiceTic | null => {
  const up = strip(raw).trim().toUpperCase().replace(/[\s-]+/g, '_')
  return (TYPES_SERVICE_TIC as readonly string[]).includes(up) ? up as TypeServiceTic : null
}
/** Dates ISO (AAAA-MM-JJ) ou JJ/MM/AAAA ; tout le reste est invalide (jamais d'interprétation hasardeuse). */
function parseDay(raw: string): string | null {
  const t = raw.trim()
  let y: number, m: number, d: number
  let mt = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(t)
  if (mt) { y = +mt[1]; m = +mt[2]; d = +mt[3] } else if ((mt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) { d = +mt[1]; m = +mt[2]; y = +mt[3] } else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date.toISOString().slice(0, 10)
}

export function planTicContractImport(rows: TicContractRow[], existing: { reference: string }[], tiers: TierLite[]): TicImportPlan {
  const have = new Set(existing.map(e => refKey(e.reference)))
  const seen = new Set<string>()
  const lines: PlannedTicLine[] = rows.map(r => {
    const reference = (r.reference ?? '').trim(); const prestataire = (r.prestataire ?? '').trim()
    const base: PlannedTicLine = { line: r.line, status: 'READY', warnings: [], reference, prestataire, typeService: 'AUTRE', criticite: 'NON_CRITIQUE' }
    const fail = (reason: TicRejectReason): PlannedTicLine => ({ ...base, status: 'REJECTED', reason })
    if (!reference) return fail('missing_reference')
    if (!prestataire) return fail('missing_provider')
    if (seen.has(refKey(reference))) return fail('duplicate_reference')
    seen.add(refKey(reference))
    const leiRaw = (r.lei ?? '').trim()
    const lei = leiRaw ? normalizeLei(leiRaw) : null
    if (leiRaw && !lei) return fail('invalid_lei')
    const critRaw = (r.criticite ?? '').trim(); const typeRaw = (r.typeService ?? '').trim()
    const criticite = critRaw ? parseCriticality(critRaw) : 'NON_CRITIQUE'
    if (!criticite) return fail('invalid_criticality')
    const typeService = typeRaw ? parseType(typeRaw) : 'AUTRE'
    if (!typeService) return fail('invalid_type')
    const debutRaw = (r.dateDebut ?? '').trim(); const finRaw = (r.dateFin ?? '').trim()
    const dateDebut = debutRaw ? parseDay(debutRaw) : undefined; const dateFin = finRaw ? parseDay(finRaw) : undefined
    if (dateDebut === null || dateFin === null) return fail('invalid_date')
    if (dateDebut && dateFin && dateFin < dateDebut) return fail('inconsistent_dates')
    const warnings: TicWarning[] = [...(critRaw ? [] : ['criticite_default' as const]), ...(typeRaw ? [] : ['type_default' as const])]
    const line: PlannedTicLine = { ...base, warnings, criticite, typeService, ...(lei ? { lei } : {}), ...((r.pays ?? '').trim() ? { pays: r.pays!.trim().toUpperCase().slice(0, 2) } : {}), ...(dateDebut ? { dateDebut } : {}), ...(dateFin ? { dateFin } : {}), ...((r.fonction ?? '').trim() ? { fonction: r.fonction!.trim() } : {}) }
    if (have.has(refKey(reference))) return { ...line, status: 'ALREADY_IMPORTED' }
    const cand = findTierCandidates({ nom: prestataire, lei }, tiers)
    const strong = cand.filter(c => c.strength === 'STRONG')
    if (strong.length === 1) line.tier = { tierId: strong[0].tierId, strength: 'STRONG' }
    else if (!strong.length && cand.length === 1) line.tier = { tierId: cand[0].tierId, strength: 'WEAK' }
    return line
  })
  const toCreate = lines.filter(l => l.status === 'READY')
  return { lines, toCreate, counts: {
    ready: toCreate.length, alreadyImported: lines.filter(l => l.status === 'ALREADY_IMPORTED').length, rejected: lines.filter(l => l.status === 'REJECTED').length,
    certainLinks: toCreate.filter(l => l.tier?.strength === 'STRONG').length,
  } }
}
