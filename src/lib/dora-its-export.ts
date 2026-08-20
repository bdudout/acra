// ─── Export ITS — registre de déclaration des incidents TIC majeurs (DORA art.19) ─
// Structure, pour chaque incident MAJEUR, l'état des trois phases de déclaration
// (initiale / intermédiaire / finale) avec leurs échéances et statuts, au format
// tabulaire attendu par le reporting prudentiel. Réutilise le moteur
// `dora-reporting.ts` (aucun recalcul dupliqué). Logique PURE et testée.

import { type IncidentReporting, type DoraPhase } from './dora-reporting'
import { toCsvCell } from './spreadsheet-safe'

export interface DoraItsIncident {
  id: string
  intitule: string
  dateDetection: Date | string | null
  doraClasseMajeurLe: Date | string | null
}

/** Un incident est déclarable ITS lorsqu'il est classé « majeur » (art. 19). */
export function estDeclarableIts(reporting: IncidentReporting): boolean {
  return reporting.classe === 'MAJEUR'
}

function iso(v: Date | string | null): string {
  if (v == null) return ''
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16).replace('T', ' ')
}

export const DORA_ITS_CSV_HEADER = [
  'Référence', 'Intitulé', 'Classification', 'Détection', 'Classification majeur',
  'Initiale — échéance', 'Initiale — statut',
  'Intermédiaire — échéance', 'Intermédiaire — statut',
  'Finale — échéance', 'Finale — statut',
] as const

function phase(reporting: IncidentReporting, p: DoraPhase) {
  return reporting.echeances.find(e => e.phase === p)
}

export function buildDoraItsRow(inc: DoraItsIncident, reporting: IncidentReporting): string[] {
  const ini = phase(reporting, 'INITIALE')
  const inter = phase(reporting, 'INTERMEDIAIRE')
  const fin = phase(reporting, 'FINALE')
  return [
    toCsvCell(inc.id.slice(0, 8)),
    toCsvCell(inc.intitule),
    toCsvCell(reporting.classe),
    toCsvCell(iso(inc.dateDetection)),
    toCsvCell(iso(inc.doraClasseMajeurLe)),
    toCsvCell(iso(ini?.echeance ?? null)),
    toCsvCell(ini?.statut ?? ''),
    toCsvCell(iso(inter?.echeance ?? null)),
    toCsvCell(inter?.statut ?? ''),
    toCsvCell(iso(fin?.echeance ?? null)),
    toCsvCell(fin?.statut ?? ''),
  ]
}
