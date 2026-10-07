// ─── Contrôles de référence en réseau (PUR) ───────────────────────────────────
// Un contrôle de l'organisation mère marqué « de référence » est décliné (copie liée, `Controle.referenceId`) dans
// chaque entité descendante ; les entités saisissent leurs exécutions, la mère consolide.
// Spec : docs/specs/protection-sociale-specs.md (P3). Module pur → testé (controle-reseau.test.ts).

import { etatEcheance, prochaineEcheance, type Periodicite } from '@/lib/controle'

/** Champs de définition recopiés dans une déclinaison (pas les rattachements propres à la mère). */
export const CHAMPS_DECLINES = [
  'intitule', 'description', 'niveau', 'periodicite', 'tailleEchantillon', 'referentielCode', 'exigenceRefs', 'checklist',
  'typeControle', 'modeControle', 'cle', 'methodeEchantillon',
] as const

/**
 * Entités où créer la déclinaison : descendants STRICTS de la mère, parmi les cibles demandées (déjà filtrées sur ce
 * que l'utilisateur voit), qui n'en ont pas encore une. N'écrase jamais une déclinaison existante.
 */
export function planDeclinaison(
  merePath: string,
  orgs: readonly { id: string; path: string }[],
  cibles: readonly string[],
  dejaDeclinees: readonly string[],
): string[] {
  const deja = new Set(dejaDeclinees)
  const demandees = new Set(cibles)
  return orgs
    .filter(o => demandees.has(o.id) && o.path !== merePath && o.path.startsWith(merePath) && !deja.has(o.id))
    .map(o => o.id)
}

export function donneesDeclinaison(ref: { id: string } & Record<string, unknown>, organizationId: string): Record<string, unknown> {
  const data: Record<string, unknown> = { organizationId, referenceId: ref.id, estReference: false }
  for (const k of CHAMPS_DECLINES) if (ref[k] !== undefined) data[k] = ref[k]
  return data
}

export type EtatCellule = 'A_VENIR' | 'DU' | 'EN_RETARD' | 'JAMAIS' | 'INACTIF'
export interface Cellule {
  organizationId: string
  controleId: string
  dernierResultat: string | null
  derniereExecution: Date | null
  etat: EtatCellule
  /** % d'exécutions conformes parmi conformes + anomalies ; null sans exécution comptable. */
  taux: number | null
}
export interface Synthese { entites: number; conformes: number; anomalies: number; enRetard: number; sansExecution: number; taux: number | null }

const pct = (c: number, a: number) => (c + a ? Math.round((100 * c) / (c + a)) : null)

/** Consolidation d'un contrôle de référence : une cellule par entité ; synthèse sur les déclinaisons actives. */
export function consolider(
  declinaisons: readonly { id: string; organizationId: string; actif: boolean; periodicite: string; createdAt: Date; executions: readonly { resultat: string; dateRealisation: Date }[] }[],
  now: Date,
): { cellules: Cellule[]; synthese: Synthese } {
  const synthese: Synthese = { entites: 0, conformes: 0, anomalies: 0, enRetard: 0, sansExecution: 0, taux: null }
  let totC = 0, totA = 0
  const cellules = declinaisons.map(d => {
    const execs = [...d.executions].sort((a, b) => new Date(b.dateRealisation).getTime() - new Date(a.dateRealisation).getTime())
    const derniere = execs[0] ?? null
    const c = execs.filter(e => e.resultat === 'CONFORME').length
    const a = execs.filter(e => e.resultat === 'ANOMALIE').length
    let etat: EtatCellule
    if (!d.actif) etat = 'INACTIF'
    else if (!derniere) etat = 'JAMAIS'
    else etat = etatEcheance(prochaineEcheance(d.periodicite as Periodicite, derniere.dateRealisation, d.createdAt), now)
    if (d.actif) {
      synthese.entites++
      totC += c; totA += a
      if (derniere?.resultat === 'CONFORME') synthese.conformes++
      if (derniere?.resultat === 'ANOMALIE') synthese.anomalies++
      if (etat === 'EN_RETARD') synthese.enRetard++
      if (etat === 'JAMAIS') synthese.sansExecution++
    }
    return { organizationId: d.organizationId, controleId: d.id, dernierResultat: derniere?.resultat ?? null, derniereExecution: derniere ? new Date(derniere.dateRealisation) : null, etat, taux: pct(c, a) }
  })
  synthese.taux = pct(totC, totA)
  return { cellules, synthese }
}
