// ─── MCP — proposition de création d'un projet 360 (PUR) ──────────────────────
// Ce qu'un assistant peut proposer pour lancer un projet : les champs du formulaire « Lancer un projet 360 »
// (nom, description / périmètre, objectifs, secteur, sous-secteurs, patterns d'architecture, mise en service). Rien
// n'est créé avant qu'un humain habilité accepte la proposition (ancre : l'organisation de la clé). Testé :
// mcp-projet360.test.ts.
import { normalizePatterns, validateInitialAnalysisContext } from '@/lib/patterns-archi'
import { normalizeSousSecteurs } from '@/lib/sous-secteurs'

export interface Projet360ProposalPayload {
  nom: string
  description: string | null
  objectifs: string | null
  secteur: string
  sousSecteurs: string[]
  patternsArchi: string[]
  /** Date de mise en service (AAAA-MM-JJ). */
  miseEnService: string | null
}

const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function sanitizeProjet360Proposal(input: unknown, opts: { patternsMax: number }): Projet360ProposalPayload {
  const o = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
  const secteur = texte(o.secteur, 120)
  const date = typeof o.miseEnService === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.miseEnService) && !Number.isNaN(Date.parse(o.miseEnService)) ? o.miseEnService : null
  return {
    nom: texte(o.nom, 200),
    description: texte(o.description, 1000) || null,
    objectifs: texte(o.objectifs, 2000) || null,
    secteur,
    sousSecteurs: normalizeSousSecteurs(secteur, o.sousSecteurs),
    patternsArchi: normalizePatterns(o.patternsArchi, { max: opts.patternsMax }),
    miseEnService: date,
  }
}

/** Valide comme le formulaire : nom, secteur et au moins un pattern d'architecture. */
export function isProjet360ProposalValid(p: Projet360ProposalPayload): boolean {
  return p.nom.length > 0 && validateInitialAnalysisContext({ secteur: p.secteur, patterns: p.patternsArchi }) === null
}
