/**
 * maturity.ts — Maturité (profil cible) d'un référentiel de conformité. Module PUR.
 *
 * La maturité est une COUCHE de l'objet `Conformite` (même suivi, même référentiel,
 * mêmes références de points) : la conformité répond « le contrôle est-il
 * respecté ? », la maturité « à quel niveau sommes-nous, et quel niveau visons-nous ? ».
 * Les deux restent indépendantes (décision produit 2026-09-29) et se lisent côte à côte.
 *
 * Lecture « RAS / RAD » : la cible (globale ou par point) joue le rôle d'une
 * déclaration d'appétence (RAS) ; l'écart actuel/cible par domaine, celui d'un
 * tableau de bord d'appétence (RAD).
 *
 * Échelle : CMMI, niveaux fixes 0 à 5 (0 Incomplete, 1 Initial, 2 Managed,
 * 3 Defined, 4 Quantitatively Managed, 5 Optimizing). Libellés et définitions par
 * défaut dans l'i18n ; l'ADMIN de l'organisation peut les personnaliser
 * (OrganizationConfig.echelleMaturite), niveau par niveau.
 */

export const MATURITY_LEVELS = [0, 1, 2, 3, 4, 5] as const
export type MaturityLevel = (typeof MATURITY_LEVELS)[number]

export interface MaturityScaleLevel { niveau: number; libelle: string; definition: string }

/** Évaluation de maturité d'un point du référentiel (clé = ref du contrôle). */
export interface MaturityEntry {
  actuel?: number
  /** Cible propre au point ; absente ⇒ cible globale du profil. */
  cible?: number
  responsable?: string
  commentaire?: string
  /** Horodatage serveur de la dernière modification (ISO 8601), non forgeable. */
  updatedAt?: string
  updatedById?: string
}
export type Maturites = Record<string, MaturityEntry>

export const isMaturityLevel = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 5

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

// ─── Échelle ─────────────────────────────────────────────────────────────────

/** Personnalisation d'échelle saisie par l'ADMIN : niveaux 0–5 uniquement, libellé requis. */
export function sanitizeMaturityScale(input: unknown): MaturityScaleLevel[] {
  if (!Array.isArray(input)) return []
  const byLevel = new Map<number, MaturityScaleLevel>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const libelle = str(o.libelle, 80)
    if (!isMaturityLevel(o.niveau) || !libelle) continue
    byLevel.set(o.niveau, { niveau: o.niveau, libelle, definition: str(o.definition, 500) ?? '' })
  }
  return [...byLevel.values()].sort((a, b) => a.niveau - b.niveau)
}

/**
 * Échelle effective : défaut (libellés i18n) surchargé niveau par niveau par la
 * personnalisation de l'organisation ; une définition vide garde celle du défaut.
 */
export function resolveMaturityScale(custom: unknown, defaults: MaturityScaleLevel[]): MaturityScaleLevel[] {
  const overrides = new Map(sanitizeMaturityScale(custom).map(l => [l.niveau, l]))
  return MATURITY_LEVELS.map(n => {
    const d = defaults.find(l => l.niveau === n) ?? { niveau: n, libelle: String(n), definition: '' }
    const o = overrides.get(n)
    return o ? { niveau: n, libelle: o.libelle, definition: o.definition || d.definition } : d
  })
}

// ─── Évaluations ─────────────────────────────────────────────────────────────

function cleanEntry(raw: unknown): MaturityEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const e: MaturityEntry = {}
  if (isMaturityLevel(o.actuel)) e.actuel = o.actuel
  if (isMaturityLevel(o.cible)) e.cible = o.cible
  const responsable = str(o.responsable, 120); if (responsable) e.responsable = responsable
  const commentaire = str(o.commentaire, 2000); if (commentaire) e.commentaire = commentaire
  if (typeof o.updatedAt === 'string' && ISO_DATE.test(o.updatedAt)) e.updatedAt = o.updatedAt
  const by = str(o.updatedById, 64); if (by) e.updatedById = by
  return e
}

const hasValue = (e: MaturityEntry) => e.actuel !== undefined || e.cible !== undefined || !!e.responsable || !!e.commentaire

/** Nettoie la carte ref → évaluation (refs hors référentiel écartées si `validRefs`). */
export function sanitizeMaturites(input: unknown, validRefs?: Set<string>): Maturites {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: Maturites = {}
  for (const [ref, raw] of Object.entries(input as Record<string, unknown>)) {
    const r = ref.trim().slice(0, 80)
    if (!r || (validRefs && !validRefs.has(r))) continue
    const e = cleanEntry(raw)
    if (e && hasValue(e)) out[r] = e
  }
  return out
}

const TRACKED = ['actuel', 'cible', 'responsable', 'commentaire'] as const
type Tracked = (typeof TRACKED)[number]
export interface MaturityChange { ref: string; fields: Partial<Record<Tracked, [string | number | null, string | number | null]>> }

/**
 * Fusionne une saisie dans l'état stocké : seuls les points modifiés sont horodatés
 * côté serveur (les métadonnées envoyées par le client sont ignorées) ; un point
 * vidé est retiré ; les points absents de la saisie sont conservés. Renvoie le diff.
 */
export function applyMaturityUpdate(previous: Maturites, incoming: Maturites | Record<string, unknown>, meta: { userId: string; now: Date }) {
  const maturites: Maturites = { ...previous }
  const changes: MaturityChange[] = []
  for (const [ref, raw] of Object.entries(incoming)) {
    const next = cleanEntry(raw) ?? {}
    const old = previous[ref]
    const fields: MaturityChange['fields'] = {}
    for (const f of TRACKED) {
      const a = old?.[f] ?? null
      const b = next[f] ?? null
      if (a !== b) fields[f] = [a, b]
    }
    if (!Object.keys(fields).length) continue
    const clean: MaturityEntry = {}
    for (const f of TRACKED) if (next[f] !== undefined) (clean as Record<string, unknown>)[f] = next[f]
    if (hasValue(clean)) maturites[ref] = { ...clean, updatedAt: meta.now.toISOString(), updatedById: meta.userId }
    else delete maturites[ref]
    changes.push({ ref, fields })
  }
  return { maturites, changes }
}

// ─── Écarts et synthèse ──────────────────────────────────────────────────────

/** Cible effective d'un point : la sienne, sinon la cible globale du profil. */
export function effectiveTarget(entry: MaturityEntry | undefined, globalTarget: number | null | undefined): number | null {
  if (entry?.cible !== undefined) return entry.cible
  return isMaturityLevel(globalTarget) ? globalTarget : null
}

/** Écart : maturité actuelle ÉVALUÉE strictement sous la cible effective. */
export function isMaturityGap(entry: MaturityEntry | undefined, globalTarget: number | null | undefined): boolean {
  const target = effectiveTarget(entry, globalTarget)
  return entry?.actuel !== undefined && target !== null && entry.actuel < target
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)

export interface MaturityDomainStats { categorie: string; total: number; assessed: number; averageCurrent: number | null; averageTarget: number | null; belowTarget: number }
export interface MaturityGap { ref: string; categorie: string; actuel: number; cible: number; gap: number }
export interface MaturityStats {
  total: number
  assessed: number
  belowTarget: number
  averageCurrent: number | null
  averageTarget: number | null
  lastReviewedAt: string | null
  domains: MaturityDomainStats[]
  topGaps: MaturityGap[]
}

/** Synthèse du profil (tableau de bord « RAD ») : globale, par domaine, plus grands écarts. */
export function maturityStats(items: { ref: string; categorie: string }[], maturites: Maturites, globalTarget: number | null | undefined, topN = 10): MaturityStats {
  const domains = new Map<string, { total: number; cur: number[]; tgt: number[]; below: number }>()
  const cur: number[] = [], tgt: number[] = []
  const gaps: MaturityGap[] = []
  const dates: string[] = []
  for (const item of items) {
    const d = domains.get(item.categorie) ?? { total: 0, cur: [], tgt: [], below: 0 }
    d.total += 1
    const e = maturites[item.ref]
    if (e?.updatedAt) dates.push(e.updatedAt)
    if (e?.actuel !== undefined) {
      d.cur.push(e.actuel); cur.push(e.actuel)
      const target = effectiveTarget(e, globalTarget)
      if (target !== null) {
        d.tgt.push(target); tgt.push(target)
        if (e.actuel < target) {
          d.below += 1
          gaps.push({ ref: item.ref, categorie: item.categorie, actuel: e.actuel, cible: target, gap: target - e.actuel })
        }
      }
    }
    domains.set(item.categorie, d)
  }
  dates.sort()
  return {
    total: items.length,
    assessed: cur.length,
    belowTarget: gaps.length,
    averageCurrent: avg(cur),
    averageTarget: avg(tgt),
    lastReviewedAt: dates.length ? dates[dates.length - 1] : null,
    domains: [...domains.entries()].map(([categorie, d]) => ({
      categorie, total: d.total, assessed: d.cur.length, averageCurrent: avg(d.cur), averageTarget: avg(d.tgt), belowTarget: d.below,
    })),
    topGaps: gaps.sort((a, b) => b.gap - a.gap).slice(0, topN),
  }
}

/**
 * Lignes d'export (hors en-tête) : domaine, réf., intitulé, maturité actuelle,
 * cible effective, écart, responsable, justification, dernière modification.
 * La neutralisation des formules est faite à la sérialisation (toCsvCell).
 */
export function maturityCsvRows(
  items: { ref: string; categorie: string; nom: string }[],
  maturites: Maturites,
  globalTarget: number | null | undefined,
  levelLabel: (n: number) => string,
): string[][] {
  return items.map(item => {
    const e = maturites[item.ref]
    const target = effectiveTarget(e, globalTarget)
    return [
      item.categorie, item.ref, item.nom,
      e?.actuel !== undefined ? levelLabel(e.actuel) : '',
      target !== null ? levelLabel(target) : '',
      e?.actuel !== undefined && target !== null ? String(target - e.actuel) : '',
      e?.responsable ?? '', e?.commentaire ?? '', e?.updatedAt ?? '',
    ]
  })
}

export interface RefActionSummary { total: number; open: number; overdue: number }

/**
 * Compte, par référence de point, les plans d'action liés : total, ouverts
 * (statut ≠ FAIT) et en retard (ouverts à échéance dépassée — jamais stocké).
 */
export function summarizeRefActions(
  rows: { statut: string; echeance: Date | null; liens: { ref: string | null }[] }[],
  now: Date,
): Record<string, RefActionSummary> {
  const out: Record<string, RefActionSummary> = {}
  for (const row of rows) {
    const open = row.statut !== 'FAIT'
    const overdue = open && !!row.echeance && row.echeance.getTime() < now.getTime()
    for (const ref of new Set(row.liens.map(l => l.ref).filter((r): r is string => !!r))) {
      const s = out[ref] ?? { total: 0, open: 0, overdue: 0 }
      s.total += 1
      if (open) s.open += 1
      if (overdue) s.overdue += 1
      out[ref] = s
    }
  }
  return out
}
