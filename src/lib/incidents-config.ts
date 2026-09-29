/**
 * incidents-config.ts — Configuration « Incidents & pertes » d'une organisation.
 * Module PUR. Modèle à 3 niveaux : défaut (ici) → organisation (`OrganizationConfig.
 * incidentsConfig`, ADMIN) → politique d'instance (module actif ou non, via getOrgConfig).
 * Regroupe : régimes de notification, devise de référence et taux, seuils de collecte et
 * de grande perte, catalogues éditables (types d'événement, types de perte).
 */

import { resolveRegimes, sanitizeRegimesConfig, type Regime, type RegimeConfigEntry } from './notification-regimes'
import { TYPES_PERTE } from './pertes'

export const TYPES_EVENEMENT = ['CYBER', 'FRAUDE', 'PROCESSUS', 'CONTINUITE', 'SECURITE_PHYSIQUE', 'DONNEES_PERSONNELLES', 'AUTRE'] as const

export interface CatalogueEntryConfig { code: string; actif: boolean; label?: string }
export interface CatalogueItem { code: string; labelKey?: string; label?: string; actif: boolean; custom?: boolean }

export interface IncidentsConfigRaw {
  deviseReference: string
  seuilCollecte: number | null
  seuilGrandePerte: number | null
  taux: Record<string, number>
  regimes: RegimeConfigEntry[]
  typesEvenement: CatalogueEntryConfig[]
  typesPerte: CatalogueEntryConfig[]
}
export interface IncidentsConfig extends Omit<IncidentsConfigRaw, 'regimes' | 'typesEvenement' | 'typesPerte'> {
  regimes: Regime[]
  typesEvenement: CatalogueItem[]
  typesPerte: CatalogueItem[]
}

export const DEFAULT_INCIDENTS_CONFIG: IncidentsConfigRaw = {
  deviseReference: 'EUR', seuilCollecte: null, seuilGrandePerte: null, taux: {}, regimes: [], typesEvenement: [], typesPerte: [],
}

const CODE_RE = /^[A-Za-z0-9_-]{1,40}$/
const MAX_CUSTOM = 20
const MAX_MONTANT = 1e12

const montant = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_MONTANT ? v : null

function cleanCatalogue(input: unknown): CatalogueEntryConfig[] {
  if (!Array.isArray(input)) return []
  const out: CatalogueEntryConfig[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (out.length >= MAX_CUSTOM * 2) break
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const code = typeof o.code === 'string' ? o.code.trim() : ''
    if (!CODE_RE.test(code) || seen.has(code)) continue
    seen.add(code)
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, 120) : ''
    out.push({ code, actif: o.actif !== false, ...(label ? { label } : {}) })
  }
  return out
}

/** Nettoie la configuration d'organisation (stockée en JSON) : bornes, devise, taux, seuils, catalogues. */
export function sanitizeIncidentsConfig(input: unknown): IncidentsConfigRaw {
  const o = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const devise = typeof o.deviseReference === 'string' && /^[A-Za-z]{3}$/.test(o.deviseReference.trim()) ? o.deviseReference.trim().toUpperCase() : DEFAULT_INCIDENTS_CONFIG.deviseReference
  const seuilCollecte = montant(o.seuilCollecte)
  let seuilGrandePerte = montant(o.seuilGrandePerte)
  if (seuilCollecte !== null && seuilGrandePerte !== null && seuilGrandePerte < seuilCollecte) seuilGrandePerte = null
  const taux: Record<string, number> = {}
  if (o.taux && typeof o.taux === 'object' && !Array.isArray(o.taux)) {
    for (const [k, v] of Object.entries(o.taux as Record<string, unknown>)) {
      if (/^[A-Z]{3}$/.test(k) && k !== devise && typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e6) taux[k] = v
    }
  }
  return {
    deviseReference: devise, seuilCollecte, seuilGrandePerte, taux,
    regimes: sanitizeRegimesConfig(o.regimes),
    typesEvenement: cleanCatalogue(o.typesEvenement),
    typesPerte: cleanCatalogue(o.typesPerte),
  }
}

function resolveCatalogue(defaults: readonly string[], keyPrefix: string, entries: CatalogueEntryConfig[]): CatalogueItem[] {
  const byCode = new Map(entries.map(e => [e.code, e]))
  const base = defaults.map((code): CatalogueItem => ({ code, labelKey: `${keyPrefix}.${code}`, actif: byCode.get(code)?.actif ?? true, ...(byCode.get(code)?.label ? { label: byCode.get(code)!.label } : {}) }))
  const customs = entries.filter(e => !defaults.includes(e.code) && e.label).map((e): CatalogueItem => ({ code: e.code, label: e.label, actif: e.actif, custom: true }))
  return [...base, ...customs]
}

/** Configuration effective d'une organisation : défauts + surcharges. */
export function resolveIncidentsConfig(raw: unknown): IncidentsConfig {
  const c = sanitizeIncidentsConfig(raw)
  return {
    deviseReference: c.deviseReference, seuilCollecte: c.seuilCollecte, seuilGrandePerte: c.seuilGrandePerte, taux: c.taux,
    regimes: resolveRegimes(c.regimes),
    typesEvenement: resolveCatalogue(TYPES_EVENEMENT, 'incidents.typesEvenement', c.typesEvenement),
    typesPerte: resolveCatalogue(TYPES_PERTE, 'incidents.typesPerte', c.typesPerte),
  }
}

/** Configuration effective → forme stockée (pour l'éditeur : on renvoie tout ce qui diffère du défaut). */
export function configToRaw(c: IncidentsConfig): IncidentsConfigRaw {
  const regimes: RegimeConfigEntry[] = c.regimes.map(r => {
    if (r.custom) {
      return { code: r.code, actif: r.actif, label: r.label, ...(r.autorite ? { autorite: r.autorite } : {}), declencheur: r.declencheur,
        phases: r.phases.map(p => ({ code: p.code, label: p.label, ...(p.delai.h !== undefined ? { delaiH: p.delai.h } : { delaiMois: p.delai.mois }), apres: p.apres })) }
    }
    return { code: r.code, actif: r.actif, phases: r.phases.map(p => ({ code: p.code, ...(p.delai.h !== undefined ? { delaiH: p.delai.h } : { delaiMois: p.delai.mois }) })) }
  })
  const cat = (items: CatalogueItem[]): CatalogueEntryConfig[] => items.filter(i => i.custom || !i.actif || i.label).map(i => ({ code: i.code, actif: i.actif, ...(i.label ? { label: i.label } : {}) }))
  return {
    deviseReference: c.deviseReference, seuilCollecte: c.seuilCollecte, seuilGrandePerte: c.seuilGrandePerte, taux: c.taux,
    regimes, typesEvenement: cat(c.typesEvenement), typesPerte: cat(c.typesPerte),
  }
}
