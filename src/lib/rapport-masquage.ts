/**
 * rapport-masquage.ts — Masquage des données identifiantes et gabarits de rapport (lot L2, suite). PUR.
 * - `masquerContenu` : rapport destiné à l'externe (régulateur, prestataire) — les colonnes qui
 *   nomment des personnes ou des objets internes deviennent des pseudonymes cohérents (#1, #2…).
 * - Gabarits : titre, introduction et sections à masquer, surchargeables par organisation
 *   (`OrganizationConfig.rapportsConfig`). L'édition figée n'est jamais modifiée.
 */

import { RAPPORT_CODES, type Bloc, type RapportContenu } from './rapport-model'

/** Colonnes (suffixe de `rapports.cols.*`) contenant des noms de personnes ou d'objets internes. */
export const COLONNES_IDENTIFIANTES = ['incident', 'controle', 'responsable', 'mission', 'constat', 'univers', 'entite'] as const

export function masquerContenu(c: RapportContenu): RapportContenu {
  const ident = new Set<string>(COLONNES_IDENTIFIANTES)
  const pseudo = new Map<string, Map<string, string>>()
  const sections = c.sections.map(s => ({
    ...s,
    blocs: s.blocs.map((b): Bloc => {
      if (b.type !== 'tableau') return b
      const idx = b.colonnes.map((col, i) => (ident.has(col.replace('rapports.cols.', '')) ? i : -1)).filter(i => i >= 0)
      if (!idx.length) return b
      const lignes = b.lignes.map(l => l.map((cell, i) => {
        if (!idx.includes(i) || typeof cell !== 'string' || !cell) return cell
        const m = pseudo.get(b.colonnes[i]) ?? new Map<string, string>()
        pseudo.set(b.colonnes[i], m)
        if (!m.has(cell)) m.set(cell, `#${m.size + 1}`)
        return m.get(cell)!
      }))
      return { ...b, lignes }
    }),
  }))
  return { ...c, sections }
}

export interface GabaritRapport { titre?: string; introduction?: string; sectionsMasquees?: string[] }
export type GabaritsRapports = Record<string, GabaritRapport>

/** Assainit la configuration des gabarits (codes de rapport connus, textes bornés). */
export function sanitizeGabarits(input: unknown): GabaritsRapports {
  const out: GabaritsRapports = {}
  if (!input || typeof input !== 'object') return out
  for (const [code, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!(RAPPORT_CODES as readonly string[]).includes(code) || !raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const g: GabaritRapport = {}
    if (typeof o.titre === 'string' && o.titre.trim()) g.titre = o.titre.trim().slice(0, 150)
    if (typeof o.introduction === 'string' && o.introduction.trim()) g.introduction = o.introduction.trim().slice(0, 2000)
    if (Array.isArray(o.sectionsMasquees)) {
      const s = [...new Set(o.sectionsMasquees.filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x)))].slice(0, 30)
      if (s.length) g.sectionsMasquees = s
    }
    if (Object.keys(g).length) out[code] = g
  }
  return out
}

/** Applique le gabarit (retrait de sections) sans toucher l'édition figée ; titre et introduction sont rendus par l'UI. */
export function appliquerGabarit(c: RapportContenu, g: GabaritRapport | undefined): RapportContenu {
  if (!g?.sectionsMasquees?.length) return c
  return { ...c, sections: c.sections.filter(s => !g.sectionsMasquees!.includes(s.id)) }
}

// ─── Configuration des rapports de l'organisation ────────────────────────────

export interface RapportsConfig { gabarits: GabaritsRapports }

export function sanitizeRapportsConfig(input: unknown): RapportsConfig {
  const o = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  return { gabarits: sanitizeGabarits(o.gabarits) }
}
