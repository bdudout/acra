// ─── Sélecteur du socle de conformité : référentiels recommandés d'abord (n° 53) — PUR ───
// Les référentiels recommandés pour le secteur de l'organisation (`recommendedFrameworksForSector`,
// déjà utilisé pour le pré-cochage de l'atelier 1) sont présentés en tête, dans l'ordre de
// recommandation ; les autres suivent dans leur ordre d'origine. Testé : socle-referentiels.test.ts.

export function grouperReferentielsSocle<T extends { code: string }>(referentiels: T[], recommandes: readonly string[]): { recommandes: T[]; autres: T[] } {
  const parCode = new Map(referentiels.map(r => [r.code, r]))
  const enTete = recommandes.map(c => parCode.get(c)).filter((r): r is T => !!r)
  const pris = new Set(enTete.map(r => r.code))
  return { recommandes: enTete, autres: referentiels.filter(r => !pris.has(r.code)) }
}
