// ─── Socle référentiels & exigences ──────────────────────────────────────────
// Un « référentiel » est un ensemble structuré d'EXIGENCES (points de contrôle) :
//   - BUILTIN : les 15 cadres livrés (ISO 27001, DORA, NIS2/ReCyF…), définis en
//     code (frameworks-data.ts / ebios-data.ts), localisés ;
//   - CUSTOM  : référentiels propres à l'organisation (PSSI, politiques internes,
//     exigences réglementaires maison), saisis/importés et stockés en base.
// Une exigence a la MÊME forme qu'un `FrameworkControl` — les deux sources sont
// donc interchangeables pour la conformité, les contrôles et l'audit.
// Logique PURE et testée ; l'API/UI ne font qu'appliquer ce moteur.

import type { FrameworkControl, ControlType } from './frameworks-data'

export type Exigence = FrameworkControl

export const EXIGENCE_TYPES: ControlType[] = ['ORGANISATIONNELLE', 'HUMAINE', 'PHYSIQUE', 'TECHNOLOGIQUE']
const DEFAULT_TYPE: ControlType = 'ORGANISATIONNELLE'

// Nature d'un référentiel custom (au-delà des cadres livrés).
export const REFERENTIEL_TYPES = ['PSSI', 'POLITIQUE', 'REGLEMENTAIRE', 'STANDARD', 'CUSTOM'] as const
export type ReferentielType = (typeof REFERENTIEL_TYPES)[number]

export interface ReferentielInput {
  code?: unknown
  nom?: unknown
  type?: unknown
  version?: unknown
  description?: unknown
  exigences?: unknown
}

export interface CleanReferentiel {
  code: string
  nom: string
  type: ReferentielType
  version: string | null
  description: string | null
  exigences: Exigence[]
}

const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const txtOrNull = (v: unknown): string | null => (txt(v) ? txt(v) : null)

/** Normalise un code de référentiel : MAJUSCULES alphanumériques + tirets. */
export function slugifyCode(v: unknown): string {
  return txt(v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // enlève les accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function coerceType(v: unknown): ControlType {
  return (EXIGENCE_TYPES as string[]).includes(v as string) ? (v as ControlType) : DEFAULT_TYPE
}

function cleanExigence(e: unknown): Exigence | null {
  if (e == null || typeof e !== 'object') return null
  const o = e as Record<string, unknown>
  const ref = txt(o.ref)
  if (!ref) return null
  return {
    ref,
    nom: txt(o.nom) || ref,
    description: txt(o.description),
    categorie: txt(o.categorie),
    type: coerceType(o.type),
  }
}

/**
 * Parse une saisie texte en exigences : une par ligne, champs séparés par « | »
 * ou une tabulation, dans l'ordre `ref | intitulé | catégorie | type`. Les lignes
 * vides et celles commençant par « # » sont ignorées. Dédupliquées par ref.
 */
export function parseExigences(texte: unknown): Exigence[] {
  if (typeof texte !== 'string') return []
  const out: Exigence[] = []
  const seen = new Set<string>()
  for (const rawLine of texte.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/\s*\|\s*|\t/).map(s => s.trim())
    const ref = parts[0]
    if (!ref || seen.has(ref)) continue
    seen.add(ref)
    out.push({
      ref,
      nom: parts[1] || ref,
      categorie: parts[2] || '',
      type: coerceType(parts[3]),
      description: '',
    })
  }
  return out
}

/** Renvoie un code d'erreur i18n, ou null si l'entrée est valide. */
export function validateReferentielInput(body: ReferentielInput): string | null {
  if (!slugifyCode(body.code)) return 'code_requis'
  if (!txt(body.nom)) return 'nom_requis'
  if (body.type != null && !(REFERENTIEL_TYPES as readonly string[]).includes(body.type as string)) return 'type_invalide'
  if (Array.isArray(body.exigences)) {
    for (const e of body.exigences) {
      if (e == null || typeof e !== 'object' || !txt((e as Record<string, unknown>).ref)) return 'exigence_ref_requise'
    }
  }
  return null
}

/** Normalise un référentiel custom : code slugifié, type borné, exigences dédupliquées. */
export function cleanReferentielInput(body: ReferentielInput): CleanReferentiel {
  const type: ReferentielType = (REFERENTIEL_TYPES as readonly string[]).includes(body.type as string)
    ? (body.type as ReferentielType) : 'CUSTOM'

  const exigences: Exigence[] = []
  const seen = new Set<string>()
  if (Array.isArray(body.exigences)) {
    for (const raw of body.exigences) {
      const e = cleanExigence(raw)
      if (!e || seen.has(e.ref)) continue
      seen.add(e.ref)
      exigences.push(e)
    }
  }

  return {
    code: slugifyCode(body.code),
    nom: txt(body.nom),
    type,
    version: txtOrNull(body.version),
    description: txtOrNull(body.description),
    exigences,
  }
}
