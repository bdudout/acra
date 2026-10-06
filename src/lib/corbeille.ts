// ─── Corbeille des éléments supprimés (incidents) — PUR ───────────────────────
// Un incident supprimé n'est pas perdu : son instantané (champs + risques du registre associés) est conservé dans la
// table ElementSupprime pendant RECOVERY_RETENTION_DAYS jours, restaurable par un administrateur avec le MÊME
// identifiant (les liens logiques qui le visent — plans d'action, rapprochements — se reconnectent). Les références
// disparues entre-temps (processus, risque du registre) sont retirées à la restauration. Testé : corbeille.test.ts.
import { isExpired } from '@/lib/recovery'

const DATES = ['dateSurvenance', 'dateDetection', 'qualifieLe', 'clotureLe', 'doraClasseMajeurLe', 'doraInitialeSoumiseLe',
  'doraIntermediaireSoumiseLe', 'doraFinaleSoumiseLe', 'dateReglement', 'createdAt'] as const
const MONTANTS = ['montantBrut', 'recuperations'] as const

export interface InstantaneIncident { incident: Record<string, unknown>; risqueIds: string[] }

/** Instantané JSON d'un incident : dates en ISO, montants (Decimal) en texte, liens vers les risques du registre. */
export function instantaneIncident(incident: Record<string, unknown>, risqueIds: readonly string[]): InstantaneIncident {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(incident)) {
    if (k === 'updatedAt') continue
    if (v instanceof Date) out[k] = v.toISOString()
    else if ((MONTANTS as readonly string[]).includes(k)) out[k] = v == null ? null : String(v)
    else out[k] = v
  }
  return { incident: out, risqueIds: [...risqueIds] }
}

/** Données de recréation : même identifiant, dates reconstituées, références encore existantes seulement. */
export function restaurationIncident(s: InstantaneIncident, existants: { processusIds: readonly string[]; riskItemIds: readonly string[] }) {
  const data: Record<string, unknown> = { ...s.incident }
  delete data.updatedAt
  for (const k of DATES) if (typeof data[k] === 'string') data[k] = new Date(data[k] as string)
  if (data.processusId && !existants.processusIds.includes(String(data.processusId))) data.processusId = null
  if (data.riskItemId && !existants.riskItemIds.includes(String(data.riskItemId))) data.riskItemId = null
  return { data, risqueIds: s.risqueIds.filter(id => existants.riskItemIds.includes(id)) }
}

/** Vrai si l'élément est en corbeille depuis plus longtemps que la rétention (purgeable). */
export const corbeillePurgeable = (supprimeLe: Date, now = new Date()) => isExpired(supprimeLe, now)
