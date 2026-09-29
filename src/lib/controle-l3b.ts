/**
 * controle-l3b.ts — Contrôle permanent, suite du lot L3 : comparaison N vs N-1, rejeu pré-rempli
 * (B-CTL-5) et rattachement à un tiers / un projet 360 (B-CTL-8). Module PUR.
 */

export interface ExecutionN1 { resultat: string; dateRealisation: Date | string; tailleTestee: number | null; anomaliesTrouvees: number | null }
export type TendanceN1 = 'AMELIORATION' | 'STABLE' | 'DEGRADATION'
export interface ComparaisonN1 { courante: string; precedente: string; tauxCourant: number; tauxPrecedent: number; deltaPts: number; tendance: TendanceN1 }

const jour = (d: Date | string) => new Date(d).toISOString().slice(0, 10)
const r1 = (n: number) => Math.round(n * 10) / 10
const parDateDesc = (a: ExecutionN1, b: ExecutionN1) => new Date(b.dateRealisation).getTime() - new Date(a.dateRealisation).getTime()

/** Taux d'anomalie (%) : sur l'échantillon quand il est renseigné, sinon 100 % si anomalie, 0 % si conforme. */
function taux(e: ExecutionN1): number {
  if (e.tailleTestee && e.tailleTestee > 0 && e.anomaliesTrouvees != null) return r1((e.anomaliesTrouvees / e.tailleTestee) * 100)
  return e.resultat === 'ANOMALIE' ? 100 : 0
}

/** Compare la dernière exécution à la précédente (NON_APPLICABLE ignorées) ; null si moins de deux. */
export function comparerExecutions(executions: ExecutionN1[]): ComparaisonN1 | null {
  const e = executions.filter(x => x.resultat !== 'NON_APPLICABLE').sort(parDateDesc)
  if (e.length < 2) return null
  const [n, n1] = e
  const tauxCourant = taux(n); const tauxPrecedent = taux(n1)
  const deltaPts = r1(tauxCourant - tauxPrecedent)
  return { courante: jour(n.dateRealisation), precedente: jour(n1.dateRealisation), tauxCourant, tauxPrecedent, deltaPts, tendance: deltaPts > 0 ? 'DEGRADATION' : deltaPts < 0 ? 'AMELIORATION' : 'STABLE' }
}

/** Rejeu : le formulaire d'exécution reprend la taille testée de la dernière exécution (à ajuster). */
export function prefillRejeu(executions: ExecutionN1[]): { tailleTestee: string } {
  const derniere = [...executions].sort(parDateDesc)[0]
  return { tailleTestee: derniere?.tailleTestee != null ? String(derniere.tailleTestee) : '' }
}

export interface Rattachements { arrangementTicId?: string | null; projetId?: string | null }

/** Rattachements présents dans le corps (identifiants opaques ≤ 60 car.) ; vide ou invalide → null. */
export function cleanRattachements(body: Record<string, unknown>): Rattachements {
  const out: Rattachements = {}
  for (const k of ['arrangementTicId', 'projetId'] as const) {
    if (!(k in body)) continue
    const v = body[k]
    out[k] = typeof v === 'string' && v.trim() && v.trim().length <= 60 ? v.trim() : null
  }
  return out
}
