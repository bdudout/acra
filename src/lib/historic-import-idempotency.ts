import { createHash } from 'crypto'
import type { HistoricRowOverrides } from '@/lib/historic-import'

/** Choix de l'assistant qui peuvent modifier le contenu réellement importé. */
export type HistoricExcelImportIdempotencyInput = {
  organizationId?: string
  mappings: Record<string, Record<string, string | undefined>>
  sheetTypes: Record<string, string>
  transforms: Record<string, Record<string, unknown>>
  statusMappings: Record<string, Record<string, string>>
  scoreMappings: Record<string, Record<string, Record<string, string>>>
  partialImport: boolean
  rowOverrides?: HistoricRowOverrides
  /** Alias de préfixe validés (R_ ⇒ RI_) : présents dans la clé seulement s'ils existent (clés d'avant conservées). */
  refAliases?: Record<string, Record<string, string>>
}

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Une sélection différente doit toujours créer une clé distincte ; une même
 * sélection, même si l'ordre des propriétés diffère, reste rejouable sans
 * dupliquer les objets déjà créés.
 */
export function buildHistoricExcelIdempotencyKey(data: string, selection: HistoricExcelImportIdempotencyInput): string {
  return `excel:${createHash('sha256').update(data).update(stableJson(selection)).digest('hex')}`
}
