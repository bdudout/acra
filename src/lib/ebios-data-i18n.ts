/**
 * Résolveur i18n des données EBIOS.
 *
 * `getEbiosData(locale)` renvoie une copie des exports de `ebios-data.ts` dont
 * les champs TEXTE sont remplacés par leur traduction (clés générées par
 * scripts/extract-ebios-data-i18n.mjs). Repli automatique : traduction manquante
 * → FR. Pur (pas de React) → utilisable côté client et serveur.
 *
 * La logique de parcours DOIT rester alignée sur le script d'extraction.
 */
import * as RAW from './ebios-data'
import type { Locale } from './i18n'
import fr from './i18n/ebios-data/fr'
import en from './i18n/ebios-data/en'
import de from './i18n/ebios-data/de'
import es from './i18n/ebios-data/es'
import it from './i18n/ebios-data/it'

const DICTS: Record<string, Record<string, string>> = { fr, en, de, es, it }

const TEXT_FIELDS = new Set([
  'nom', 'description', 'label', 'titre', 'sousTitre', 'critere',
  'motivation', 'ressources', 'conseil', 'mesure', 'objectifVise',
])
const TEXT_ARRAY_FIELDS = new Set(['etapes'])
const SKIP_EXPORTS = new Set(['ATELIERS_META']) // déjà i18n via t.ateliersMeta

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stableId = (obj: any, i: number): string => obj?.ref ?? obj?.value ?? obj?.id ?? String(i)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

function tr(dict: Record<string, string>, key: string, fallback: string): string {
  return dict[key] ?? fr[key] ?? fallback
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function localizeObject(obj: any, prefix: string, dict: Record<string, string>): any {
  const out: Record<string, unknown> = Array.isArray(obj) ? [...obj] as any : { ...obj }
  for (const [field, v] of Object.entries(obj)) {
    if (typeof v === 'string' && TEXT_FIELDS.has(field)) {
      out[field] = tr(dict, `${prefix}.${field}`, v)
    } else if (TEXT_ARRAY_FIELDS.has(field) && isStringArray(v)) {
      out[field] = v.map((s, j) => tr(dict, `${prefix}.${field}.${j}`, s))
    }
  }
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function localizeExport(name: string, val: any, dict: Record<string, string>): any {
  if (isStringArray(val)) return val.map((s, i) => tr(dict, `${name}.${i}`, s))
  if (Array.isArray(val)) {
    return val.map((obj, i) => (obj && typeof obj === 'object' ? localizeObject(obj, `${name}.${stableId(obj, i)}`, dict) : obj))
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = { ...val }
    for (const [k, obj] of Object.entries(val)) {
      if (obj && typeof obj === 'object') out[k] = localizeObject(obj, `${name}.${k}`, dict)
    }
    return out
  }
  return val
}

/** Exports d'ebios-data localisés pour la locale donnée (repli FR). */
export function getEbiosData(locale: Locale): typeof RAW {
  const dict = DICTS[locale] ?? fr
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any = {}
  for (const [name, val] of Object.entries(RAW)) {
    out[name] = typeof val === 'function' || SKIP_EXPORTS.has(name) ? val : localizeExport(name, val, dict)
  }
  return out
}
