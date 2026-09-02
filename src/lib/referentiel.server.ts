// ─── Résolution unifiée des référentiels (BUILTIN + CUSTOM) ──────────────────
// Point d'accès UNIQUE : fusionne les cadres livrés (frameworks-data, en code,
// localisés) et les référentiels custom de l'organisation (table Referentiel).
// Toute la conformité / les contrôles / l'audit lisent leurs exigences ici, sans
// se soucier de la source.

import { prisma } from './prisma'
import { FRAMEWORK_IDS, FRAMEWORK_META, getFrameworkControles, type FrameworkId } from './frameworks-data'
import { coerceDomaine, type Domaine } from './referentiel-domaines'
import type { Locale } from './i18n'
import type { Exigence } from './referentiel'

export type ReferentielSource = 'BUILTIN' | 'CUSTOM'

export interface ReferentielSummary {
  code: string
  nom: string
  source: ReferentielSource
  type: string
  /** Filière de contrôle/audit (cf. referentiel-domaines.ts). */
  domaine: Domaine
  version: string | null
  nbExigences: number
  actif: boolean
  /** Identifiant en base (référentiels custom uniquement). */
  id?: string
}

// Les cadres livrés proposés dans le socle (on exclut CUSTOM, réservé au niveau
// analyse comme emplacement d'exigences ad hoc).
const BUILTIN_CODES = FRAMEWORK_IDS.filter(id => id !== 'CUSTOM')

const isBuiltin = (code: string): code is FrameworkId => (BUILTIN_CODES as readonly string[]).includes(code)

/**
 * Résumés des référentiels visibles par l'organisation (livrés + custom).
 * `domaine` (optionnel) filtre sur une filière de contrôle/audit (cyber, LCB-FT…).
 */
export async function listReferentiels(orgId: string, locale: Locale, domaine?: Domaine): Promise<ReferentielSummary[]> {
  const builtins: ReferentielSummary[] = BUILTIN_CODES.map(code => {
    const meta = FRAMEWORK_META[code]
    let nb = 0
    try { nb = getFrameworkControles(code, undefined, locale).length } catch { nb = 0 }
    return {
      code, nom: meta.nom, source: 'BUILTIN', type: meta.cible,
      domaine: coerceDomaine(meta.domaine), version: meta.version || null, nbExigences: nb, actif: true,
    }
  })

  const rows = await prisma.referentiel.findMany({ where: { organizationId: orgId }, orderBy: [{ createdAt: 'desc' }] })
  const customs: ReferentielSummary[] = rows.map(r => ({
    id: r.id,
    code: r.code,
    nom: r.nom,
    source: 'CUSTOM',
    type: r.type,
    domaine: coerceDomaine((r as { domaine?: unknown }).domaine),
    version: r.version,
    nbExigences: Array.isArray(r.exigences) ? (r.exigences as unknown[]).length : 0,
    actif: r.actif,
  }))

  const all = [...customs, ...builtins]
  return domaine ? all.filter(r => r.domaine === domaine) : all
}

/** Exigences (points de contrôle) d'un référentiel, quelle que soit sa source. */
export async function getExigencesFor(code: string, orgId: string, locale: Locale): Promise<Exigence[]> {
  if (isBuiltin(code)) {
    try { return getFrameworkControles(code, undefined, locale) as Exigence[] } catch { return [] }
  }
  const row = await prisma.referentiel.findFirst({ where: { organizationId: orgId, code }, select: { exigences: true } })
  return Array.isArray(row?.exigences) ? (row!.exigences as unknown as Exigence[]) : []
}
