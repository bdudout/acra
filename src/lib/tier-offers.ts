// ─── Offres d'un prestataire, couverture contractuelle et usages (PUR) ────────────────────────────────────────────────────
// `TierService` = offre identifiable (« SignNow Signature ») ; `typeService` n'est qu'une catégorie, jamais une clé d'unicité :
// deux offres de même catégorie restent deux offres. Un usage hors contrat reste visible « couverture à confirmer ».

import { TYPES_SERVICE_TIC } from './registre-tic'

export const MAX_SERVICE_NAME = 200
export const MAX_SERVICE_DESCRIPTION = 10000

export type ServiceInputError = 'nom_requis' | 'nom_trop_long' | 'type_invalide' | 'description_trop_longue'
export function cleanServiceInput(body: { nom?: unknown; typeService?: unknown; description?: unknown }):
  { ok: true; value: { nom: string; typeService: string; description: string | null } } | { ok: false; error: ServiceInputError } {
  const nom = String(body.nom ?? '').trim()
  if (!nom) return { ok: false, error: 'nom_requis' }
  if (nom.length > MAX_SERVICE_NAME) return { ok: false, error: 'nom_trop_long' }
  const typeService = body.typeService === undefined || body.typeService === null || body.typeService === '' ? 'AUTRE' : String(body.typeService)
  if (!(TYPES_SERVICE_TIC as readonly string[]).includes(typeService)) return { ok: false, error: 'type_invalide' }
  const description = String(body.description ?? '').trim()
  if (description.length > MAX_SERVICE_DESCRIPTION) return { ok: false, error: 'description_trop_longue' }
  return { ok: true, value: { nom, typeService, description: description || null } }
}

/** Ajouts / retraits d'offres couvertes par un contrat ; un retrait encore utilisé par des usages est bloqué. */
export function planCoverageChange(current: readonly string[], requested: readonly string[], usagesByService: Record<string, number>) {
  const next = [...new Set(requested.filter(Boolean))]
  const toAdd = next.filter(id => !current.includes(id))
  const removals = current.filter(id => !next.includes(id))
  const blocked = removals.filter(id => (usagesByService[id] ?? 0) > 0).map(serviceId => ({ serviceId, usages: usagesByService[serviceId] }))
  return { toAdd, toRemove: removals.filter(id => !(usagesByService[id] > 0)), blocked }
}

export type UsageCoverage = 'CONFIRMED' | 'UNCONFIRMED'
/** Couverture d'un usage : contrat de l'organisation, ou contrat groupe dont elle est bénéficiaire CONFIRMÉE ; sinon à confirmer. */
export function usageCoverage(input: { organizationId: string; contractService: { ownerOrganizationId: string; beneficiaryStatus: 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | null } | null }): UsageCoverage {
  const c = input.contractService
  if (!c) return 'UNCONFIRMED'
  if (c.ownerOrganizationId === input.organizationId) return 'CONFIRMED'
  return c.beneficiaryStatus === 'CONFIRMED' ? 'CONFIRMED' : 'UNCONFIRMED'
}
