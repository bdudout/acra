// ─── Import : textes trop longs raccourcis, erreurs de validation lisibles (PUR) ─────────────────────────────────────────
// Un intitulé de 1 200 caractères dans un classeur ne doit pas faire échouer tout l'import : le texte est raccourci au plafond du
// schéma et la troncature est signalée au bilan. Les autres erreurs de validation sont décrites en clair (objet, n° d'élément, champ).

import { z, ZodError } from 'zod'

export interface Truncation { path: string; max: number; length: number }

// zod 4 : définition sous `_zod.def` (champ `type`) ; enveloppes (optional, nullable, default…) → `innerType` ;
// transformation (`pipe`) → schéma d'entrée `in`. Longueur max d'une chaîne : `maxLength`.
type AnySchema = z.ZodType
type Def = { type?: string; innerType?: AnySchema; in?: AnySchema; element?: AnySchema }
const defOf = (s: AnySchema): Def => (s as unknown as { _zod: { def: Def } })._zod.def
const ENVELOPPES = new Set(['optional', 'nullable', 'default', 'prefault', 'catch', 'readonly', 'nonoptional'])
const unwrap = (schema: AnySchema): AnySchema => {
  let s = schema
  for (let i = 0; i < 10; i++) {
    const def = defOf(s)
    if (def.type && ENVELOPPES.has(def.type) && def.innerType) s = def.innerType
    else if (def.type === 'pipe' && def.in) s = def.in
    else break
  }
  return s
}

/** Copie de `value` dont les chaînes dépassant le `max` du schéma sont raccourcies ; `truncated` liste chaque troncature. */
export function truncateStringsBySchema(schema: AnySchema, value: unknown): { data: unknown; truncated: Truncation[] } {
  const truncated: Truncation[] = []
  const walk = (s: AnySchema, v: unknown, path: string): unknown => {
    const inner = unwrap(s); const type = defOf(inner).type
    if (type === 'string' && typeof v === 'string') {
      const max = (inner as z.ZodString).maxLength
      if (typeof max === 'number' && v.length > max) { truncated.push({ path, max, length: v.length }); return v.slice(0, max) }
      return v
    }
    if (type === 'array' && Array.isArray(v)) return v.map((item, i) => walk(defOf(inner).element as AnySchema, item, path ? `${path}.${i}` : String(i)))
    if (type === 'object' && v && typeof v === 'object' && !Array.isArray(v)) {
      const shape = (inner as z.ZodObject<z.ZodRawShape>).shape as Record<string, AnySchema>
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
      else parts.push(i === 0 ? String(seg) : `› ${String(seg)}`)
    })
    const where = parts.join(' ')
    // zod 4 : la nature de la valeur limitée est dans `origin` (zod 3 : `type`).
    const reason = issue.code === 'too_big' && issue.origin === 'string' ? `texte trop long (max ${issue.maximum})`
      : issue.code === 'too_big' && issue.origin === 'array' ? `trop d'éléments (max ${issue.maximum})`
        : issue.code === 'too_big' || issue.code === 'too_small' && issue.origin !== 'string' ? 'valeur hors limites'
          : issue.code === 'too_small' ? 'valeur vide ou trop courte'
            : issue.code === 'invalid_type' ? 'type de valeur inattendu' : issue.message
    return `${where || 'fichier'} : ${reason}`
  })
}
