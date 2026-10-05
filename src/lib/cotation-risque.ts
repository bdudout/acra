// ─── Cotation d'un risque : brut → actuel → résiduel (PUR) ─────────────────────
// Brut = sans mesure ; actuel = avec les mesures existantes ; résiduel = cible après traitement. Règles : l'actuel ne
// dépasse pas le brut, le résiduel ne dépasse pas l'actuel (gravité et vraisemblance séparément) ; une baisse se
// propage aux niveaux suivants (cascade) ; alertes de cohérence du traitement. Testé : cotation-risque.test.ts.

export interface GV { g: number; v: number }
export interface CotationRow {
  gravite: number; vraisemblance: number
  graviteActuelle?: number | null; vraisemblanceActuelle?: number | null
  graviteResiduelle?: number | null; vraisemblanceResiduelle?: number | null
  strategie?: string; mesuresCount?: number; plansCount?: number
}
type Patch = Partial<Record<'gravite' | 'vraisemblance' | 'graviteActuelle' | 'vraisemblanceActuelle' | 'graviteResiduelle' | 'vraisemblanceResiduelle', number>> & Record<string, unknown>

/** Valeurs effectives : actuel ← brut, résiduel ← actuel quand absents. */
export function cotations(r: CotationRow): { brut: GV; actuel: GV; residuel: GV } {
  const brut = { g: r.gravite, v: r.vraisemblance }
  const actuel = { g: r.graviteActuelle ?? brut.g, v: r.vraisemblanceActuelle ?? brut.v }
  const residuel = { g: r.graviteResiduelle ?? actuel.g, v: r.vraisemblanceResiduelle ?? actuel.v }
  return { brut, actuel, residuel }
}

/** Valeur maximale sélectionnable à chaque niveau (le brut n'est borné que par l'échelle, 5 au plus). */
export function bornesCotation(r: CotationRow): { brut: GV; actuel: GV; residuel: GV } {
  const c = cotations(r)
  return { brut: { g: 5, v: 5 }, actuel: c.brut, residuel: c.actuel }
}

/**
 * Patch à envoyer pour une modification : les valeurs au-delà de leur borne sont plafonnées, et une baisse se propage
 * (baisser le brut ramène l'actuel et le résiduel s'ils le dépassent ; baisser l'actuel ramène le résiduel).
 */
export function cascadeCotation(r: CotationRow, patch: Patch): Patch {
  const merged = { ...r, ...patch } as CotationRow
  const c = cotations(merged)
  const out: Patch = { ...patch }
  const fixe = (key: keyof Patch, valeur: number, borne: number, defini: boolean) => {
    if (valeur > borne && (defini || key in patch)) out[key] = borne
  }
  // Actuel ≤ brut
  fixe('graviteActuelle', c.actuel.g, c.brut.g, merged.graviteActuelle != null)
  fixe('vraisemblanceActuelle', c.actuel.v, c.brut.v, merged.vraisemblanceActuelle != null)
  // Résiduel ≤ actuel (après correction de l'actuel)
  const actuel = { g: Math.min(c.actuel.g, c.brut.g), v: Math.min(c.actuel.v, c.brut.v) }
  fixe('graviteResiduelle', c.residuel.g, actuel.g, merged.graviteResiduelle != null)
  fixe('vraisemblanceResiduelle', c.residuel.v, actuel.v, merged.vraisemblanceResiduelle != null)
  return out
}

export type ViolationCotation = 'ACTUEL_SUP_BRUT' | 'RESIDUEL_SUP_ACTUEL'
export function violationsCotation(r: CotationRow): ViolationCotation[] {
  const c = cotations(r)
  const out: ViolationCotation[] = []
  if (c.actuel.g > c.brut.g || c.actuel.v > c.brut.v) out.push('ACTUEL_SUP_BRUT')
  if (c.residuel.g > c.actuel.g || c.residuel.v > c.actuel.v) out.push('RESIDUEL_SUP_ACTUEL')
  return out
}

export type AlerteCotation = 'REDUIRE_SANS_MESURE' | 'RESIDUEL_NON_REDUIT' | 'ACCEPTE_HORS_APPETIT'
/** Cohérence du traitement : « Réduire » suppose des mesures et un résiduel plus bas ; accepter au-delà de l'appétit se justifie. */
export function alertesCotation(r: CotationRow, ctx: { decision: 'treat' | 'accept' }): AlerteCotation[] {
  const c = cotations(r)
  const out: AlerteCotation[] = []
  if (r.strategie === 'REDUIRE') {
    if (!(r.mesuresCount ?? 0) && !(r.plansCount ?? 0)) out.push('REDUIRE_SANS_MESURE')
    else if (c.residuel.g * c.residuel.v >= c.actuel.g * c.actuel.v) out.push('RESIDUEL_NON_REDUIT')
  }
  if (r.strategie === 'ACCEPTER' && ctx.decision === 'treat') out.push('ACCEPTE_HORS_APPETIT')
  return out
}
