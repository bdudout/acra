/**
 * import-profile.ts — Profils de mapping de l'import universel (lot I4). Module PUR.
 * Un profil décrit, pour un FORMAT de classeur : le rôle de chaque feuille, ses colonnes, les correspondances de valeurs.
 * Déclaratif et borné (aucune expression, aucun code) ; reconnu automatiquement sur un nouveau fichier ; exportable.
 * Les profils livrés ne s'appliquent qu'aux rôles déjà importables (registre, mesures…) ; les ateliers 1–4 arrivent avec le lot I5.
 */

import type { HistoricSheetType, HistoricColumnMapping } from './historic-import'

export const PROFILE_ROLES = ['ANALYSES', 'RISKS', 'VULNERABILITIES', 'MEASURES', 'ACTIONS', 'RISK_ACTION_LINKS', 'UNKNOWN'] as const satisfies readonly HistoricSheetType[]
export interface ProfileSheet {
  /** Feuille reconnue par son nom exact (insensible à la casse et aux accents). */
  match: { name: string }
  role: HistoricSheetType
  /** Champ ACRA → en-tête de colonne source. */
  fields: HistoricColumnMapping
}
export interface ImportProfile {
  version: 1
  id: string
  name: string
  description?: string
  /** Vrai pour un profil livré avec ACRA (non modifiable, dupliquable). */
  builtin?: boolean
  /** Le profil ne couvre pas tout le classeur (feuilles reprises plus tard). */
  partial?: boolean
  sheets: ProfileSheet[]
  statusMappings: Record<string, Record<string, string>>
  scoreMappings: Record<string, Record<string, Record<string, string>>>
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export const BUILTIN_PROFILES: ImportProfile[] = [
  {
    version: 1, id: 'builtin-dossier-securite-ebios', name: 'Dossier de sécurité EBIOS RM', builtin: true, partial: true,
    description: 'Classeur EBIOS RM en 15 feuilles (ateliers 1 à 5) : reprend aujourd’hui les risques initiaux et le plan de mesures ; les autres feuilles sont ignorées.',
    sheets: [
      { match: { name: 'Page de garde' }, role: 'UNKNOWN', fields: {} },
      { match: { name: 'Sommaire' }, role: 'UNKNOWN', fields: {} },
      { match: { name: 'Métriques' }, role: 'UNKNOWN', fields: {} },
      { match: { name: '5 - Risques initiaux' }, role: 'RISKS', fields: { externalId: 'Réf.RI', title: 'Description du risque', gravity: 'Gravité initiale', likelihood: 'Vraisemblance initiale', strategy: 'Traitement du risque initial' } },
      { match: { name: '5 - PACS' }, role: 'MEASURES', fields: { externalId: 'Réf. de la mesure de sécurité', title: 'Description courte de la mesure', description: 'Description longue', status: 'Statut', responsible: 'Responsable', dueDate: 'Date de mise en œuvre' } },
    ],
    statusMappings: { '5 - PACS': { Terminé: 'REALISE', 'A réaliser': 'A_FAIRE', 'En cours': 'EN_COURS', 'Abandonné / Suspendu': 'REPORTE' } },
    scoreMappings: {},
  },
]

export interface ProfileMatch {
  profile: ImportProfile
  /** 0–1 : 60 % feuilles retrouvées, 40 % colonnes retrouvées. */
  score: number
  missingSheets: string[]
  missingColumns: { sheet: string; column: string }[]
}

/** Correspondance d'un profil avec les feuilles d'un fichier ; tolérante (feuilles en plus, colonnes renommées). */
export function matchProfile(profile: ImportProfile, sheets: { name: string; columns: string[] }[]): ProfileMatch {
  const byName = new Map(sheets.map(s => [norm(s.name), s]))
  const missingSheets: string[] = []
  const missingColumns: { sheet: string; column: string }[] = []
  let foundSheets = 0
  let cols = 0
  let foundCols = 0
  for (const ps of profile.sheets) {
    const sheet = byName.get(norm(ps.match.name))
    if (!sheet) { missingSheets.push(ps.match.name); continue }
    foundSheets++
    const have = new Set(sheet.columns.map(norm))
    for (const column of Object.values(ps.fields)) {
      if (!column) continue
      cols++
      if (have.has(norm(column))) foundCols++
      else missingColumns.push({ sheet: ps.match.name, column })
    }
  }
  const sheetScore = profile.sheets.length ? foundSheets / profile.sheets.length : 0
  const colScore = cols ? foundCols / cols : (foundSheets ? 1 : 0)
  return { profile, score: Math.round((sheetScore * 0.6 + colScore * 0.4) * 100) / 100, missingSheets, missingColumns }
}

export function rankProfiles(profiles: ImportProfile[], sheets: { name: string; columns: string[] }[], threshold = 0.6): ProfileMatch[] {
  return profiles.map(p => matchProfile(p, sheets)).filter(m => m.score >= threshold).sort((a, b) => b.score - a.score)
}

export interface ProfileSelection {
  mappings: Record<string, HistoricColumnMapping>
  sheetTypes: Record<string, HistoricSheetType>
  statusMappings: Record<string, Record<string, string>>
  scoreMappings: Record<string, Record<string, Record<string, string>>>
}

/** Profil → état de l'assistant (rôles, colonnes, correspondances), pour les feuilles réellement présentes. */
export function profileToSelection(profile: ImportProfile, sheets: { name: string; columns: string[] }[]): ProfileSelection {
  const out: ProfileSelection = { mappings: {}, sheetTypes: {}, statusMappings: {}, scoreMappings: {} }
  const byName = new Map(sheets.map(s => [norm(s.name), s]))
  for (const ps of profile.sheets) {
    const sheet = byName.get(norm(ps.match.name))
    if (!sheet) continue
    const columnByNorm = new Map(sheet.columns.map(c => [norm(c), c]))
    out.sheetTypes[sheet.name] = ps.role
    out.mappings[sheet.name] = Object.fromEntries(Object.entries(ps.fields).flatMap(([field, col]) => { const real = col ? columnByNorm.get(norm(col)) : undefined; return real ? [[field, real]] : [] }))
    if (profile.statusMappings[ps.match.name]) out.statusMappings[sheet.name] = { ...profile.statusMappings[ps.match.name] }
    if (profile.scoreMappings[ps.match.name]) out.scoreMappings[sheet.name] = { ...profile.scoreMappings[ps.match.name] }
  }
  return out
}

// ─── Import / export d'un profil (JSON) ──────────────────────────────────────

const MAX_SHEETS = 50
const MAX_FIELDS = 40
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Valide un profil reçu (fichier JSON) : structure connue seulement, tailles bornées, champs inconnus écartés. */
export function sanitizeProfile(input: unknown): { ok: true; profile: ImportProfile } | { ok: false; error: 'profile_invalid' | 'profile_version_unsupported' } {
  if (!isRecord(input)) return { ok: false, error: 'profile_invalid' }
  if (input.version !== 1) return { ok: false, error: typeof input.version === 'number' ? 'profile_version_unsupported' : 'profile_invalid' }
  const id = str(input.id, 80); const name = str(input.name, 100)
  if (!id || !name || !Array.isArray(input.sheets) || input.sheets.length > MAX_SHEETS) return { ok: false, error: 'profile_invalid' }
  const sheets: ProfileSheet[] = []
  for (const raw of input.sheets) {
    if (!isRecord(raw) || !isRecord(raw.match)) return { ok: false, error: 'profile_invalid' }
    const sheetName = str(raw.match.name, 100)
    if (!sheetName || !(PROFILE_ROLES as readonly unknown[]).includes(raw.role)) return { ok: false, error: 'profile_invalid' }
    const fieldsIn = isRecord(raw.fields) ? raw.fields : {}
    const entries = Object.entries(fieldsIn).slice(0, MAX_FIELDS)
    const fields: HistoricColumnMapping = Object.fromEntries(entries.flatMap(([k, v]) => { const col = str(v, 200); return col && /^[A-Za-z]{1,40}$/.test(k) ? [[k, col]] : [] }))
    sheets.push({ match: { name: sheetName }, role: raw.role as HistoricSheetType, fields })
  }
  const cleanMap = (m: unknown): Record<string, Record<string, string>> => isRecord(m) ? Object.fromEntries(Object.entries(m).slice(0, MAX_SHEETS).filter(([, v]) => isRecord(v)).map(([k, v]) => [k, Object.fromEntries(Object.entries(v as Record<string, unknown>).slice(0, 100).flatMap(([a, b]) => { const t = str(b, 100); return t ? [[a.slice(0, 200), t]] : [] }))])) : {}
  const scoreIn = isRecord(input.scoreMappings) ? input.scoreMappings : {}
  const scoreMappings = Object.fromEntries(Object.entries(scoreIn).slice(0, MAX_SHEETS).filter(([, v]) => isRecord(v)).map(([k, v]) => [k, cleanMap(v)]))
  return { ok: true, profile: { version: 1, id, name, ...(str(input.description, 500) ? { description: str(input.description, 500)! } : {}), sheets, statusMappings: cleanMap(input.statusMappings), scoreMappings } }
}
