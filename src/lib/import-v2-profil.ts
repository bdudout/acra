// ─── API v2 « fichier + profil » (B-IMP-72) — PUR ─────────────────────────────
// Sélection appliquée à un classeur reçu par l'API : profil RÉFÉRENCÉ (identifiant d'un profil livré, ou nom d'un mapping
// enregistré par l'organisation — prioritaire), sinon profil fourni dans la requête (format d'export d'un profil), sinon
// détection automatique de l'aperçu (comme l'assistant de l'interface avant toute correction).
// États des lignes (B-IMP-53) : prêt / importable sans ce champ / à confirmer / non importable (+ lignes modèles ignorées).
// Testé : import-v2-profil.test.ts.
import { z } from 'zod'
import { HISTORIC_SHEET_TYPES, type HistoricColumnMapping, type HistoricImportDecision, type HistoricSheetType } from '@/lib/historic-import'
import { BUILTIN_PROFILES, profileToSelection, sanitizeProfile } from '@/lib/import-profile'

// ─── Mapping enregistré (AnalysisImportMapping.mappings) ───
const sheetType = z.enum(HISTORIC_SHEET_TYPES)
const valueTransform = z.object({ mode: z.enum(['LINES', 'SEMICOLON', 'PIPE']).optional(), carryForward: z.boolean().optional() }).refine(value => Boolean(value.mode || value.carryForward))
export const mappingRecord = z.record(z.string(), z.record(z.string(), z.string().optional()))
export const scoreMappingsSchema = z.record(z.string(), z.record(z.string(), z.record(z.string(), z.enum(['1', '2', '3', '4']))))
export const refAliasesSchema = z.record(z.string(), z.record(z.string().max(12), z.string().max(12)))
export type MappingEnregistre = {
  mappings: z.infer<typeof mappingRecord>; sheetTypes: Record<string, HistoricSheetType>
  transforms: Record<string, Record<string, { mode?: 'LINES' | 'SEMICOLON' | 'PIPE'; carryForward?: boolean } | undefined>>
  statusMappings: Record<string, Record<string, 'A_FAIRE' | 'EN_COURS' | 'REALISE' | 'REPORTE'>>; scoreMappings: z.infer<typeof scoreMappingsSchema>
  refAliases?: z.infer<typeof refAliasesSchema>
}
/** Mapping enregistré : format v2 (rôles, colonnes, correspondances), ou ancien format (colonnes seules). */
export function normaliserMappingEnregistre(value: unknown): MappingEnregistre {
  const parsed = z.object({ version: z.literal(2), mappings: mappingRecord, sheetTypes: z.record(z.string(), sheetType).default({}), transforms: z.record(z.string(), z.record(z.string(), valueTransform.optional())).default({}), statusMappings: z.record(z.string(), z.record(z.string(), z.enum(['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE']))).default({}), scoreMappings: scoreMappingsSchema.default({}), refAliases: refAliasesSchema.optional() }).safeParse(value)
  if (parsed.success) return parsed.data
  return { mappings: mappingRecord.parse(value), sheetTypes: {}, transforms: {}, statusMappings: {}, scoreMappings: {} }
}

// ─── Sélection ───
export interface SelectionV2 {
  mappings: Record<string, Record<string, string | undefined>>
  sheetTypes: Record<string, HistoricSheetType>
  transforms: MappingEnregistre['transforms']
  statusMappings: Record<string, Record<string, string>>
  scoreMappings: Record<string, Record<string, Record<string, string>>>
  partialImport: boolean
  valueMaps: Record<string, { category?: Record<string, string>; type?: Record<string, string> }>
  refAliases: Record<string, Record<string, string>>
  rowOverrides: Record<string, Record<string, Record<string, string>>>
}
export interface FeuilleApercu { name: string; columns: string[]; detection: { type: HistoricSheetType }; mapping: HistoricColumnMapping }
export type SourceProfil = 'REFERENCE' | 'INLINE' | 'AUTO'
export type ResultatSelection = { ok: true; selection: SelectionV2; source: SourceProfil } | { ok: false; error: 'profil_introuvable' | 'profile_invalid' | 'profile_version_unsupported' }

const complete = (p: Pick<SelectionV2, 'mappings' | 'sheetTypes'> & Partial<SelectionV2>): SelectionV2 => ({
  transforms: {}, statusMappings: {}, scoreMappings: {}, partialImport: true, valueMaps: {}, refAliases: {}, rowOverrides: {}, ...p,
})

export function selectionDepuisProfil(
  demande: { profilRef?: string | null; profilInline?: unknown },
  apercu: FeuilleApercu[],
  enregistres: { name: string; mappings: unknown }[],
): ResultatSelection {
  const feuilles = apercu.map(f => ({ name: f.name, columns: f.columns }))
  const ref = demande.profilRef?.trim()
  if (ref) {
    const livre = BUILTIN_PROFILES.find(p => p.id === ref)
    if (livre) return { ok: true, source: 'REFERENCE', selection: complete(profileToSelection(livre, feuilles)) }
    const enregistre = enregistres.find(m => m.name === ref)
    if (!enregistre) return { ok: false, error: 'profil_introuvable' }
    const m = normaliserMappingEnregistre(enregistre.mappings)
    return { ok: true, source: 'REFERENCE', selection: complete({ mappings: m.mappings, sheetTypes: m.sheetTypes, transforms: m.transforms, statusMappings: m.statusMappings, scoreMappings: m.scoreMappings, refAliases: m.refAliases ?? {} }) }
  }
  if (demande.profilInline !== undefined && demande.profilInline !== null) {
    const p = sanitizeProfile(demande.profilInline)
    if (!p.ok) return { ok: false, error: p.error }
    return { ok: true, source: 'INLINE', selection: complete(profileToSelection(p.profile, feuilles)) }
  }
  return {
    ok: true, source: 'AUTO',
    selection: complete({ mappings: Object.fromEntries(apercu.map(f => [f.name, { ...f.mapping }])), sheetTypes: Object.fromEntries(apercu.map(f => [f.name, f.detection.type])) }),
  }
}

// ─── États des lignes (B-IMP-53) ───
export interface EtatsLignes { pret: number; sansCeChamp: number; aConfirmer: number; nonImportable: number; ignorees: number }
export function etatsLignes(decisions: HistoricImportDecision[]): EtatsLignes {
  const e: EtatsLignes = { pret: 0, sansCeChamp: 0, aConfirmer: 0, nonImportable: 0, ignorees: 0 }
  for (const d of decisions) {
    if (d.status === 'READY') e.pret++
    else if (d.status === 'FIELD_OMITTED') e.sansCeChamp++
    else if (d.status === 'IGNORED') e.ignorees++
    else if (d.reason === 'MISSING_REQUIRED_VALUE') e.aConfirmer++
    else e.nonImportable++
  }
  return e
}
