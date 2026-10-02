/**
 * Constructeur de packs sectoriels (catalogue 1.10+) : écrit un pack de manière compacte et produit, avec les
 * éléments, la catégorie bâloise des risques et les liens « couvre ce risque » des contrôles et missions.
 * Mêmes règles que le catalogue : suggestions à qualifier, jamais d'exécution, de seuil, de date, de notation ni de constat.
 * Les clés sont `<secteur>.<type>.<slug>` ; une clé complète (avec un point) désigne un élément d'un autre pack ou du socle.
 */
import type { CatalogueItem, Localized, SectorCode } from './sector-suggestions'

export type Tr = readonly [fr: string, en: string, de: string, es: string, it: string]
type Periodicite = NonNullable<CatalogueItem['periodicite']>
type CType = NonNullable<CatalogueItem['controlType']>
type Bale = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const tr = (t: Tr): Localized => ({ fr: t[0], en: t[1], de: t[2], es: t[3], it: t[4] })

export interface SectorPack {
  items: CatalogueItem[]
  bale: Record<string, Bale>
  controlRisks: Record<string, string[]>
  auditRisks: Record<string, string[]>
}

export function sectorPack(sector: SectorCode) {
  const pre = sector.toLowerCase()
  const pack: SectorPack = { items: [], bale: {}, controlRisks: {}, auditRisks: {} }
  const full = (type: string, slug: string) => (slug.includes('.') ? slug : `${pre}.${type}.${slug}`)
  const api = {
    pack,
    process: (slug: string, title: Tr, parent?: string) => { pack.items.push({ key: full('process', slug), sector, kind: 'PROCESS', title: tr(title), ...(parent ? { parentKey: full('process', parent) } : {}) }) },
    risk: (slug: string, bale: Bale, title: Tr, process: string, description?: Tr) => {
      const key = full('risk', slug)
      pack.items.push({ key, sector, kind: 'RISK', title: tr(title), processKey: full('process', process), ...(description ? { description: tr(description) } : {}) })
      pack.bale[key] = bale
    },
    control: (slug: string, title: Tr, process: string, periodicite: Periodicite, controlType: CType, risks: string[], references?: string[]) => {
      const key = full('control', slug)
      pack.items.push({ key, sector, kind: 'CONTROL', title: tr(title), processKey: full('process', process), periodicite, controlType, ...(references ? { references } : {}) })
      pack.controlRisks[key] = risks.map(r => full('risk', r))
    },
    kri: (slug: string, title: Tr, process: string, unite: Tr, sens: 'HAUSSE' | 'BAISSE', periodicite: Exclude<Periodicite, 'HEBDOMADAIRE'>) => {
      pack.items.push({ key: full('kri', slug), sector, kind: 'KRI', title: tr(title), processKey: full('process', process), unite: tr(unite), sens, periodicite })
    },
    audit: (slug: string, title: Tr, process: string, risks: string[], points: Tr[]) => {
      const key = full('audit', slug)
      pack.items.push({ key, sector, kind: 'AUDIT', title: tr(title), processKey: full('process', process), points: points.map(tr) })
      pack.auditRisks[key] = risks.map(r => full('risk', r))
    },
  }
  return api
}

// Unités courantes.
export const U_PCT: Tr = ['%', '%', '%', '%', '%']
export const U_NB: Tr = ['nombre', 'count', 'Anzahl', 'número', 'numero']
export const U_DAYS: Tr = ['jours', 'days', 'Tage', 'días', 'giorni']
export const U_HOURS: Tr = ['heures', 'hours', 'Stunden', 'horas', 'ore']
export const U_MIN: Tr = ['minutes', 'minutes', 'Minuten', 'minutos', 'minuti']
