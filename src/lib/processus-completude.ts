/**
 * Complétude d'un processus de la cartographie (module PUR) : un processus importé du catalogue
 * ou d'un fichier n'a souvent que son nom. On signale ce qu'il reste à renseigner, sans rien
 * présumer : propriétaire et criticité toujours ; délais de reprise (RTO / RPO) dès que le
 * processus est déclaré critique ou important (DORA) ou de criticité élevée (≥ 3).
 */
export type ChampProcessus = 'proprietaire' | 'criticite' | 'rto' | 'rpo'

export function champsManquantsProcessus(p: {
  proprietaire?: string | null; criticite?: number | null; criticiteDora?: string | null
  rtoMinutes?: number | null; rpoMinutes?: number | null
}): ChampProcessus[] {
  const manquants: ChampProcessus[] = []
  if (!p.proprietaire?.trim()) manquants.push('proprietaire')
  if (p.criticite == null) manquants.push('criticite')
  const sensible = p.criticiteDora === 'CRITIQUE' || p.criticiteDora === 'IMPORTANTE' || (p.criticite ?? 0) >= 3
  if (sensible && p.rtoMinutes == null) manquants.push('rto')
  if (sensible && p.rpoMinutes == null) manquants.push('rpo')
  return manquants
}
