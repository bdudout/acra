/**
 * papiers-travail.ts — Papiers de travail d'une mission d'audit (lot L4, suite). Module PUR.
 * Un papier documente un programme, un test, un entretien ou une analyse (objectif, travaux réalisés,
 * conclusion, référence de la pièce en GED). Cycle : brouillon → soumis → revu. Le préparateur seul
 * modifie un brouillon ; la revue est faite par une AUTRE personne (supervision), qui peut renvoyer
 * le papier avec un commentaire obligatoire.
 */

export const TYPES_PAPIER = ['PROGRAMME', 'TEST', 'ENTRETIEN', 'ANALYSE', 'AUTRE'] as const
export type TypePapier = (typeof TYPES_PAPIER)[number]
export const STATUTS_PAPIER = ['BROUILLON', 'SOUMIS', 'REVU'] as const
export type StatutPapier = (typeof STATUTS_PAPIER)[number]

export interface Papier {
  id: string; type: TypePapier; titre: string; objectif?: string; travaux: string; conclusion?: string; reference?: string
  statut: StatutPapier; preparePar: string; prepareLe: string
  revuePar?: string; revueLe?: string; revueCommentaire?: string
}
export type PapierDonnees = Pick<Papier, 'type' | 'titre' | 'objectif' | 'travaux' | 'conclusion' | 'reference'>

export type CommandePapier =
  | { action: 'AJOUTER'; data: unknown }
  | { action: 'MODIFIER'; id: string; data: unknown }
  | { action: 'SUPPRIMER'; id: string }
  | { action: 'SOUMETTRE'; id: string }
  | { action: 'REVOIR'; id: string; commentaire?: string }
  | { action: 'RENVOYER'; id: string; commentaire?: string }
export type ErreurPapier = 'titre_requis' | 'papier_introuvable' | 'modification_interdite' | 'travaux_requis' | 'revue_meme_personne' | 'commentaire_requis' | 'transition_interdite' | 'trop_de_papiers'
export type ResultatPapier = { ok: true; papiers: Papier[] } | { ok: false; error: ErreurPapier }

const MAX_PAPIERS = 200
const txt = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

function cleanDonnees(input: unknown): PapierDonnees | null {
  const o = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const titre = txt(o.titre, 200)
  if (!titre) return null
  const type = (TYPES_PAPIER as readonly unknown[]).includes(o.type) ? (o.type as TypePapier) : 'AUTRE'
  return { type, titre, travaux: txt(o.travaux, 10000) ?? '', ...(txt(o.objectif, 1000) ? { objectif: txt(o.objectif, 1000) } : {}), ...(txt(o.conclusion, 4000) ? { conclusion: txt(o.conclusion, 4000) } : {}), ...(txt(o.reference, 300) ? { reference: txt(o.reference, 300) } : {}) }
}

/** Lecture défensive de la colonne JSON. */
export function sanitizePapiers(raw: unknown): Papier[] {
  if (!Array.isArray(raw)) return []
  const out: Papier[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const d = cleanDonnees(o)
    if (!d || typeof o.id !== 'string' || typeof o.preparePar !== 'string') continue
    const statut = (STATUTS_PAPIER as readonly unknown[]).includes(o.statut) ? (o.statut as StatutPapier) : 'BROUILLON'
    out.push({
      id: o.id, ...d, statut, preparePar: o.preparePar, prepareLe: typeof o.prepareLe === 'string' ? o.prepareLe : '',
      ...(typeof o.revuePar === 'string' ? { revuePar: o.revuePar } : {}), ...(typeof o.revueLe === 'string' ? { revueLe: o.revueLe } : {}),
      ...(txt(o.revueCommentaire, 2000) ? { revueCommentaire: txt(o.revueCommentaire, 2000) } : {}),
    })
    if (out.length >= MAX_PAPIERS) break
  }
  return out
}

export function appliquerPapiers(papiers: Papier[], cmd: CommandePapier, ctx: { acteur: string; now: Date; newId: () => string }): ResultatPapier {
  const now = ctx.now.toISOString()
  if (cmd.action === 'AJOUTER') {
    const d = cleanDonnees(cmd.data)
    if (!d) return { ok: false, error: 'titre_requis' }
    if (papiers.length >= MAX_PAPIERS) return { ok: false, error: 'trop_de_papiers' }
    return { ok: true, papiers: [...papiers, { id: ctx.newId(), ...d, statut: 'BROUILLON', preparePar: ctx.acteur, prepareLe: now }] }
  }
  const p = papiers.find(x => x.id === cmd.id)
  if (!p) return { ok: false, error: 'papier_introuvable' }
  const remplacer = (n: Papier): ResultatPapier => ({ ok: true, papiers: papiers.map(x => (x.id === p.id ? n : x)) })
  const editable = p.statut === 'BROUILLON' && p.preparePar === ctx.acteur
  switch (cmd.action) {
    case 'MODIFIER': {
      if (!editable) return { ok: false, error: 'modification_interdite' }
      const d = cleanDonnees(cmd.data)
      if (!d) return { ok: false, error: 'titre_requis' }
      const { objectif: _o, conclusion: _c, reference: _r, ...rest } = p
      return remplacer({ ...rest, ...d })
    }
    case 'SUPPRIMER':
      if (!editable) return { ok: false, error: 'modification_interdite' }
      return { ok: true, papiers: papiers.filter(x => x.id !== p.id) }
    case 'SOUMETTRE': {
      if (!editable) return { ok: false, error: 'modification_interdite' }
      if (!p.travaux.trim()) return { ok: false, error: 'travaux_requis' }
      const { revuePar: _a, revueLe: _b, ...rest } = p
      return remplacer({ ...rest, statut: 'SOUMIS' })
    }
    case 'REVOIR':
    case 'RENVOYER': {
      if (p.statut !== 'SOUMIS') return { ok: false, error: 'transition_interdite' }
      if (ctx.acteur === p.preparePar) return { ok: false, error: 'revue_meme_personne' }
      const com = txt(cmd.commentaire, 2000)
      if (cmd.action === 'RENVOYER') {
        if (!com) return { ok: false, error: 'commentaire_requis' }
        return remplacer({ ...p, statut: 'BROUILLON', revueCommentaire: com })
      }
      return remplacer({ ...p, statut: 'REVU', revuePar: ctx.acteur, revueLe: now, ...(com ? { revueCommentaire: com } : {}) })
    }
  }
}
