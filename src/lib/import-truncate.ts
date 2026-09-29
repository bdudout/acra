// ─── Import : textes trop longs raccourcis, erreurs de validation lisibles (PUR) ─────────────────────────────────────────
// Un intitulé de 1 200 caractères dans un classeur ne doit pas faire échouer tout l'import : le texte est raccourci au plafond du
// schéma et la troncature est signalée au bilan. Les autres erreurs de validation sont décrites en clair (objet, n° d'élément, champ).

import { z, ZodError } from 'zod'

export interface Truncation { path: string; max: number; length: number }

type AnySchema = z.ZodTypeAny
const unwrap = (schema: AnySchema): AnySchema => {
  let s = schema
  for (let i = 0; i < 10; i++) {
    const def = s._def as { typeName?: string; innerType?: AnySchema; schema?: AnySchema }
    if (def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable' || def.typeName === 'ZodDefault') s = def.innerType as AnySchema
    else if (def.typeName === 'ZodEffects') s = def.schema as AnySchema
    else break
  }
  return s
}

/** Copie de `value` dont les chaînes dépassant le `max` du schéma sont raccourcies ; `truncated` liste chaque troncature. */
export function truncateStringsBySchema(schema: AnySchema, value: unknown): { data: unknown; truncated: Truncation[] } {
  const truncated: Truncation[] = []
  const walk = (s: AnySchema, v: unknown, path: string): unknown => {
    const inner = unwrap(s); const typeName = (inner._def as { typeName?: string }).typeName
    if (typeName === 'ZodString' && typeof v === 'string') {
      const max = ((inner._def as { checks: { kind: string; value?: number }[] }).checks.find(c => c.kind === 'max')?.value)
      if (typeof max === 'number' && v.length > max) { truncated.push({ path, max, length: v.length }); return v.slice(0, max) }
      return v
    }
    if (typeName === 'ZodArray' && Array.isArray(v)) return v.map((item, i) => walk((inner as z.ZodArray<AnySchema>).element, item, path ? `${path}.${i}` : String(i)))
    if (typeName === 'ZodObject' && v && typeof v === 'object' && !Array.isArray(v)) {
      const shape = (inner as z.ZodObject<z.ZodRawShape>).shape
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, item]) => [k, shape[k] ? walk(shape[k], item, path ? `${path}.${k}` : k) : item]))
    }
    return v
  }
  return { data: walk(schema, value, ''), truncated }
}

/** Regroupe les troncatures par champ (indices retirés) : `securityBaseline.9.title` + `.39.title` → 1 ligne, 2 occurrences. */
export function groupTruncations(list: Truncation[]): { field: string; count: number; max: number }[] {
  const groups = new Map<string, { field: string; count: number; max: number }>()
  for (const t of list) {
    const field = t.path.split('.').filter(p => !/^\d+$/.test(p)).join('.')
    const g = groups.get(field) ?? { field, count: 0, max: t.max }; g.count += 1; groups.set(field, g)
  }
  return [...groups.values()]
}

/** Erreurs de validation en clair : « securityBaseline n°10 › title : texte trop long (max 1000) ». */
export function describeZodIssues(error: ZodError, limit = 8): string[] {
  return error.issues.slice(0, limit).map(issue => {
    const parts: string[] = []
    issue.path.forEach((seg, i) => {
      if (typeof seg === 'number') parts.push(`n°${seg + 1}`)
      else parts.push(i === 0 ? String(seg) : `› ${seg}`)
    })
    const where = parts.join(' ').replace(/ › /g, ' › ')
    const reason = issue.code === 'too_big' && issue.type === 'string' ? `texte trop long (max ${issue.maximum})`
      : issue.code === 'too_big' && issue.type === 'array' ? `trop d'éléments (max ${issue.maximum})`
        : issue.code === 'too_big' || issue.code === 'too_small' && issue.type !== 'string' ? 'valeur hors limites'
          : issue.code === 'too_small' ? 'valeur vide ou trop courte'
            : issue.code === 'invalid_type' ? 'type de valeur inattendu' : issue.message
    return `${where || 'fichier'} : ${reason}`
  })
}
