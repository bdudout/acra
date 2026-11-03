// ─── Cartographie des dépendances des fonctions critiques ou importantes (DORA art. 8 et 28) ─────────────────────────
// Pour chaque processus classé CRITIQUE ou IMPORTANTE : délais (RTO, RPO, tolérance d'impact), dépendances TIC (usages de
// services de tiers, points d'accès), contrôles, risques, incidents — et les ÉCARTS qui fragilisent la résilience.
// Concentration : un même prestataire ou un même hôte derrière plusieurs fonctions. Logique pure, testée
// (dependances-critiques.test.ts) ; la route ne fait que charger les données.

export interface UsageDep {
  id: string; useCase: string; tiersId: string; tiersNom: string; offre: string
  criticite: string | null; couvert: boolean; evalue: boolean
  exposeInternet: boolean | null; perimetrePci: boolean | null; avecSi: boolean | null; interconnexion: string | null
  hotes: string[]
}
export interface FonctionDep {
  id: string; nom: string; criticiteDora: string; proprietaire: string | null
  rtoMinutes: number | null; rpoMinutes: number | null; toleranceImpactMinutes: number | null
  nbControles: number; nbRisques: number; nbIncidents12m: number
  usages: UsageDep[]
}
export type CodeEcart =
  | 'SANS_PROPRIETAIRE' | 'TOLERANCE_NON_DEFINIE' | 'RTO_NON_DEFINI' | 'RPO_NON_DEFINI' | 'RTO_AU_DELA_TOLERANCE'
  | 'AUCUNE_DEPENDANCE_TIC' | 'USAGE_SANS_CONTRAT' | 'USAGE_SOUS_QUALIFIE' | 'USAGE_NON_EVALUE' | 'USAGE_EXPOSE_VIA_INTERNET'
  | 'AUCUN_CONTROLE'
export interface Ecart { code: CodeEcart; gravite: 'ELEVEE' | 'MOYENNE' | 'INFO'; usageId?: string }

function ecartsFonction(f: FonctionDep): Ecart[] {
  const e: Ecart[] = []
  if (!f.proprietaire?.trim()) e.push({ code: 'SANS_PROPRIETAIRE', gravite: 'MOYENNE' })
  if (f.toleranceImpactMinutes == null) e.push({ code: 'TOLERANCE_NON_DEFINIE', gravite: 'MOYENNE' })
  if (f.rtoMinutes == null) e.push({ code: 'RTO_NON_DEFINI', gravite: 'MOYENNE' })
  if (f.rpoMinutes == null) e.push({ code: 'RPO_NON_DEFINI', gravite: 'MOYENNE' })
  // La reprise visée arrive après le seuil tolérable : l'impact dépasserait la tolérance même si le plan fonctionne.
  if (f.rtoMinutes != null && f.toleranceImpactMinutes != null && f.rtoMinutes > f.toleranceImpactMinutes) e.push({ code: 'RTO_AU_DELA_TOLERANCE', gravite: 'ELEVEE' })
  if (!f.usages.length) e.push({ code: 'AUCUNE_DEPENDANCE_TIC', gravite: 'INFO' })
  for (const u of f.usages) {
    if (!u.couvert) e.push({ code: 'USAGE_SANS_CONTRAT', gravite: 'ELEVEE', usageId: u.id })
    if (u.criticite !== 'CRITIQUE' && u.criticite !== 'IMPORTANTE') e.push({ code: 'USAGE_SOUS_QUALIFIE', gravite: 'MOYENNE', usageId: u.id })
    if (!u.evalue) e.push({ code: 'USAGE_NON_EVALUE', gravite: 'MOYENNE', usageId: u.id })
    if (u.exposeInternet === true && u.interconnexion === 'INTERNET') e.push({ code: 'USAGE_EXPOSE_VIA_INTERNET', gravite: 'MOYENNE', usageId: u.id })
  }
  if (f.nbControles === 0) e.push({ code: 'AUCUN_CONTROLE', gravite: 'MOYENNE' })
  return e
}

export function analyserDependances(fonctions: FonctionDep[]) {
  const resultat = fonctions.map(f => ({ ...f, ecarts: ecartsFonction(f) }))
  const parTiers = new Map<string, { tiersNom: string; fonctions: Set<string> }>()
  const parHote = new Map<string, Set<string>>()
  for (const f of fonctions) for (const u of f.usages) {
    const t = parTiers.get(u.tiersId) ?? { tiersNom: u.tiersNom, fonctions: new Set<string>() }
    t.fonctions.add(f.nom); parTiers.set(u.tiersId, t)
    for (const h of u.hotes) { const s = parHote.get(h) ?? new Set<string>(); s.add(f.nom); parHote.set(h, s) }
  }
  const parCode: Partial<Record<CodeEcart, number>> = {}
  for (const f of resultat) for (const e of f.ecarts) parCode[e.code] = (parCode[e.code] ?? 0) + 1
  return {
    fonctions: resultat,
    concentration: {
      tiers: [...parTiers].filter(([, v]) => v.fonctions.size > 1).map(([tiersId, v]) => ({ tiersId, tiersNom: v.tiersNom, fonctions: [...v.fonctions].sort() })),
      hotes: [...parHote].filter(([, v]) => v.size > 1).map(([hote, v]) => ({ hote, fonctions: [...v].sort() })),
    },
    synthese: {
      fonctions: fonctions.length,
      avecEcarts: resultat.filter(f => f.ecarts.some(e => e.gravite !== 'INFO')).length,
      ecartsEleves: resultat.reduce((n, f) => n + f.ecarts.filter(e => e.gravite === 'ELEVEE').length, 0),
      parCode,
    },
  }
}
