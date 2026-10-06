// ─── Services tiers et entités de tiers (PUR) ─────────────────────────────────
// Un SERVICE TIERS est la relation étudiée dans les analyses (partie prenante : service rendu, prestation, adhérence) ;
// une ENTITÉ DE TIERS est la personne morale (Tier) qui peut porter plusieurs services tiers et des contrats TIC.
// Regroupement des parties prenantes par nom comparable, avec les entités déjà rattachées et les candidates (nom, alias)
// — proposées, jamais appliquées — et disposition du petit graphe d'une entité. Testé : services-tiers.test.ts.
import { comparableTierName, findTierCandidates, type TierLite } from '@/lib/tier-identity'

export interface PartieLite { id: string; nom: string; type: string; tierId: string | null; analyseId: string; analyseNom: string }
export interface ServiceTiers {
  key: string; nom: string; type: string
  partieIds: string[]; analyses: { id: string; nom: string }[]
  /** Entités de tiers déjà rattachées (au moins une occurrence). */
  tierIds: string[]
  /** Occurrences (parties prenantes) sans entité. */
  aRattacher: string[]
  /** Occurrences rattachées, par entité (détachement ciblé). */
  parEntite: Record<string, string[]>
  candidats: { tierId: string; nom: string; reason: 'LEI' | 'NAME' | 'ALIAS' }[]
}

export function regrouperServicesTiers(parties: readonly PartieLite[], tiers: readonly TierLite[]): ServiceTiers[] {
  const groupes = new Map<string, PartieLite[]>()
  for (const p of parties) {
    const key = comparableTierName(p.nom) || p.nom.trim().toLowerCase()
    if (!key) continue
    groupes.set(key, [...(groupes.get(key) ?? []), p])
  }
  const nomTier = new Map(tiers.map(t => [t.id, t.nom]))
  return [...groupes.entries()].map(([key, ps]) => {
    const freq = new Map<string, number>()
    for (const p of ps) freq.set(p.nom.trim(), (freq.get(p.nom.trim()) ?? 0) + 1)
    const nom = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const analyses = [...new Map(ps.map(p => [p.analyseId, { id: p.analyseId, nom: p.analyseNom }])).values()]
    return {
      key, nom, type: ps[0].type,
      partieIds: ps.map(p => p.id), analyses,
      tierIds: [...new Set(ps.flatMap(p => (p.tierId ? [p.tierId] : [])))],
      aRattacher: ps.filter(p => !p.tierId).map(p => p.id),
      parEntite: ps.reduce<Record<string, string[]>>((m, p) => (p.tierId ? { ...m, [p.tierId]: [...(m[p.tierId] ?? []), p.id] } : m), {}),
      candidats: findTierCandidates({ nom }, [...tiers]).map(c => ({ tierId: c.tierId, nom: nomTier.get(c.tierId) ?? '', reason: c.reason })),
    }
  }).sort((a, b) => a.nom.localeCompare(b.nom))
}

export type NoeudType = 'ENTITE' | 'SERVICE' | 'CONTRAT'
export interface Noeud { id: string; type: NoeudType; label: string; x: number; y: number }
export interface Graphe { largeur: number; hauteur: number; noeuds: Noeud[]; liens: { de: string; vers: string }[] }

const LARGEUR = 640, PAS = 44, MARGE = 28

/** Services tiers en colonne à gauche, entité au centre, contrats en colonne à droite ; chaque lien passe par l'entité. */
export function grapheEntite(entite: { nom: string }, services: readonly { key: string; nom: string }[], contrats: readonly { id: string; reference: string }[]): Graphe {
  const lignes = Math.max(1, services.length, contrats.length)
  const hauteur = MARGE * 2 + (lignes - 1) * PAS
  const colonne = (n: number, i: number) => MARGE + ((lignes - 1) * PAS - (n - 1) * PAS) / 2 + i * PAS
  const centre: Noeud = { id: 'entite', type: 'ENTITE', label: entite.nom, x: LARGEUR / 2, y: hauteur / 2 }
  const s = services.map((sv, i) => ({ id: `s:${sv.key}`, type: 'SERVICE' as const, label: sv.nom, x: 110, y: colonne(services.length, i) }))
  const c = contrats.map((ct, i) => ({ id: `c:${ct.id}`, type: 'CONTRAT' as const, label: ct.reference, x: LARGEUR - 110, y: colonne(contrats.length, i) }))
  return {
    largeur: LARGEUR, hauteur,
    noeuds: [...s, centre, ...c],
    liens: [...s.map(n => ({ de: n.id, vers: centre.id })), ...c.map(n => ({ de: centre.id, vers: n.id }))],
  }
}
