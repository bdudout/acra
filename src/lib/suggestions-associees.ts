// ─── Suggestions sectorielles : éléments associés aux risques choisis (PUR) ───
// Le registre des risques ne propose que des RISQUES (une cartographie, pas des scénarios) ; sur option, on importe
// aussi ce qui s'y rattache : le processus du risque, les contrôles et audits qui le couvrent, les KRI de son processus.
// Testé : suggestions-associees.test.ts.

export interface ItemAssociable { key: string; kind: 'PROCESS' | 'RISK' | 'CONTROL' | 'KRI' | 'AUDIT' | 'RESILIENCE_TEST'; processKey?: string; riskKeys?: string[] }
export interface OptionsAssocies { processus?: boolean; controles?: boolean; kri?: boolean; audits?: boolean }

export function elementsAssocies(items: readonly ItemAssociable[], risquesChoisis: readonly string[], o: OptionsAssocies, dejaImportes: ReadonlySet<string> = new Set()): string[] {
  const risques = new Set(risquesChoisis)
  const processus = new Set(items.filter(i => i.kind === 'RISK' && risques.has(i.key) && i.processKey).map(i => i.processKey as string))
  const couvre = (i: ItemAssociable) => (i.riskKeys ?? []).some(k => risques.has(k))
  return items.filter(i => !dejaImportes.has(i.key) && (
    (o.processus && i.kind === 'PROCESS' && processus.has(i.key))
    || (o.controles && i.kind === 'CONTROL' && couvre(i))
    || (o.audits && i.kind === 'AUDIT' && couvre(i))
    || (o.kri && i.kind === 'KRI' && !!i.processKey && processus.has(i.processKey))
  )).map(i => i.key)
}
