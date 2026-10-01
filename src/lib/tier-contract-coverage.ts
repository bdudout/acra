/**
 * Couverture d'un contrat TIC groupe et usages concrets de ses services.
 * Fonctions pures : les routes fournissent les rôles effectifs et les IDs
 * d'organisation/processus résolus côté serveur, jamais ceux du seul client.
 */

import { isAdminRole, type UserRole } from '@/lib/permissions'

export type BeneficiaryStatus = 'PROPOSED' | 'CONFIRMED' | 'REJECTED'

type TransitionInput = {
  groupOrgId: string
  beneficiaryOrgId: string
  groupRootOfBeneficiary: string
  actorOrgId: string
  actorRole: UserRole
  action: 'PROPOSE' | 'CONFIRM' | 'REJECT'
  currentStatus: BeneficiaryStatus | null
}

type TransitionResult =
  | { ok: true; nextStatus: BeneficiaryStatus }
  | { ok: false; error: 'outside_group' | 'not_group_admin' | 'not_beneficiary_admin' | 'not_proposed' | 'already_confirmed' }

/** L'ADMIN groupe propose ; l'ADMIN de la filiale confirme ou refuse. */
export function decideBeneficiaryTransition(input: TransitionInput): TransitionResult {
  if (input.groupRootOfBeneficiary !== input.groupOrgId) return { ok: false, error: 'outside_group' }
  if (input.action === 'PROPOSE') {
    if (input.actorOrgId !== input.groupOrgId || !isAdminRole(input.actorRole)) {
      return { ok: false, error: 'not_group_admin' }
    }
    if (input.currentStatus === 'CONFIRMED') return { ok: false, error: 'already_confirmed' }
    return { ok: true, nextStatus: 'PROPOSED' }
  }
  if (input.actorOrgId !== input.beneficiaryOrgId || !isAdminRole(input.actorRole)) {
    return { ok: false, error: 'not_beneficiary_admin' }
  }
  if (input.currentStatus !== 'PROPOSED') return { ok: false, error: 'not_proposed' }
  return { ok: true, nextStatus: input.action === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED' }
}

type UsageInput = {
  organizationId: string
  processOrganizationId: string | null
  serviceId: string
  serviceAccessible: boolean
  useCase: string
  contractService: { id: string; contractId: string; serviceId: string } | null
  contractOwnerOrganizationId?: string | null
  beneficiary: { contractId: string; organizationId: string; status: BeneficiaryStatus } | null
}

type UsageResult =
  | { ok: true; coverage: 'CONFIRMED' | 'UNCONFIRMED' }
  | { ok: false; error: 'use_case_required' | 'service_not_accessible' | 'process_outside_organization' | 'service_not_covered' | 'beneficiary_contract_mismatch' | 'beneficiary_not_confirmed' }

/**
 * Un usage a sa propre finalité et son processus ; le type TIC de l'offre n'est
 * jamais une clé d'unicité. Sans contrat connu, l'usage est conservable mais
 * explicitement non couvert.
 */
export function validateServiceUsage(input: UsageInput): UsageResult {
  if (!input.useCase.trim()) return { ok: false, error: 'use_case_required' }
  if (!input.serviceAccessible) return { ok: false, error: 'service_not_accessible' }
  if (input.processOrganizationId !== null && input.processOrganizationId !== input.organizationId) {
    return { ok: false, error: 'process_outside_organization' }
  }
  if (!input.contractService) return { ok: true, coverage: 'UNCONFIRMED' }
  if (input.contractService.serviceId !== input.serviceId) return { ok: false, error: 'service_not_covered' }
  if (input.contractOwnerOrganizationId === input.organizationId) return { ok: true, coverage: 'CONFIRMED' }
  if (!input.beneficiary || input.beneficiary.contractId !== input.contractService.contractId) {
    return { ok: false, error: 'beneficiary_contract_mismatch' }
  }
  if (input.beneficiary.organizationId !== input.organizationId || input.beneficiary.status !== 'CONFIRMED') {
    return { ok: false, error: 'beneficiary_not_confirmed' }
  }
  return { ok: true, coverage: 'CONFIRMED' }
}
