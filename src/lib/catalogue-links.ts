/**
 * Liens « couvre ce risque » des contrôles-types et des missions d'audit types du catalogue.
 * Servent à l'entrée « par risque » du catalogue de contrôles et des modèles de mission : un
 * contrôle importé est rattaché au risque correspondant SEULEMENT si l'organisation l'a déjà dans
 * son registre (même clé de catalogue) — jamais de risque créé implicitement.
 */
export const CONTROL_RISKS: Record<string, string[]> = {
  'core.control.access-review': ['core.risk.privileged-access', 'core.risk.leavers', 'core.risk.segregation'],
  'core.control.privileged-review': ['core.risk.privileged-access'],
  'core.control.leavers': ['core.risk.leavers'],
  'core.control.backup-restore': ['core.risk.backup-failure', 'core.risk.ransomware'],
  'core.control.patch-follow-up': ['core.risk.unpatched'],
  'core.control.security-alerts': ['core.risk.detection-gap'],
  'core.control.payment-validation': ['core.risk.payment-fraud', 'core.risk.internal-fraud'],
  'core.control.supplier-clauses': ['core.risk.supplier-contract'],
  'core.control.supplier-review': ['core.risk.supplier-outage'],
  'finance.control.reconciliation': ['finance.risk.reconciliation'],
  'finance.control.sanctions-alerts': ['finance.risk.sanction-screening'],
  'assurance.control.claims-sample': ['assurance.risk.claim-fraud'],
  'assurance.control.pricing-change': ['assurance.risk.pricing'],
  'energie.control.ot-access': ['energie.risk.scada', 'energie.risk.contractor-access'],
  'energie.control.field-permits': ['energie.risk.field-safety'],
  'transport.control.maintenance-due': ['transport.risk.maintenance'],
  'transport.control.cycle-count': ['transport.risk.stock-error'],
  'telecom.control.sim-swap': ['telecom.risk.sim-swap'],
  'telecom.control.revenue-assurance': ['telecom.risk.revenue-leak'],
  'sante.control.record-access': ['sante.risk.patient-data'],
  'sante.control.specimen-identity': ['sante.risk.result-error'],
  'industrie.control.remote-access': ['industrie.risk.remote-maintenance'],
  'industrie.control.batch-release': ['industrie.risk.quality'],
  'public.control.grant-sample': ['public.risk.grant-error'],
  'public.control.open-data-review': ['public.risk.open-data'],
  'commerce.control.price-changes': ['commerce.risk.pricing'],
  'commerce.control.inventory-count': ['commerce.risk.stock'],
  'saas.control.release-review': ['saas.risk.release'],
  'saas.control.support-access': ['saas.risk.support-access'],
  'services.control.engagement-acceptance': ['services.risk.scope'],
  'services.control.unbilled-work': ['services.risk.billing'],
}

export const AUDIT_RISKS: Record<string, string[]> = {
  'core.audit.access': ['core.risk.privileged-access', 'core.risk.leavers'],
  'core.audit.backup': ['core.risk.backup-failure', 'core.risk.ransomware'],
  'core.audit.suppliers': ['core.risk.supplier-outage', 'core.risk.supplier-contract'],
  'core.audit.payments': ['core.risk.payment-fraud'],
  'finance.audit.payment-chain': ['finance.risk.payment-routing', 'finance.risk.reconciliation'],
  'assurance.audit.claims': ['assurance.risk.claim-fraud', 'assurance.risk.claim-delay'],
  'energie.audit.operations': ['energie.risk.scada', 'energie.risk.outage'],
  'transport.audit.continuity': ['transport.risk.planning-outage', 'transport.risk.delay'],
  'telecom.audit.network-change': ['telecom.risk.config-change', 'telecom.risk.outage'],
  'sante.audit.records': ['sante.risk.patient-data', 'sante.risk.consent'],
  'public.audit.grants': ['public.risk.grant-error'],
  'saas.audit.change': ['saas.risk.release', 'saas.risk.secrets'],
  'industrie.audit.ot': ['industrie.risk.ot-stop', 'industrie.risk.remote-maintenance'],
  'commerce.audit.online-sales': ['commerce.risk.customer-data', 'commerce.risk.pricing'],
  'services.audit.confidentiality': ['services.risk.confidentiality', 'services.risk.client-access'],
}
