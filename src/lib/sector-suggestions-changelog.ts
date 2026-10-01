// ─── Historique du catalogue sectoriel : ce qui a été ajouté à chaque version ──────────────────────────────────────────────
// Sert à signaler « nouveautés depuis la version que vous avez importée » : on n'écrase rien, on propose seulement.
// Règle : toute évolution du catalogue (CATALOGUE_PACK_VERSION) ajoute UNE entrée ici avec les clés ajoutées (un test le vérifie).

export const CATALOGUE_CHANGELOG: { version: string; added: string[] }[] = [
  { version: '1.1', added: [
      'assurance.risk.customer-data',
      'assurance.risk.reserve',
      'commerce.risk.loyalty',
      'commerce.risk.pricing',
      'core.process.buy.order',
      'core.process.buy.review',
      'core.process.buy.sourcing',
      'core.process.deliver.aftersales',
      'core.process.deliver.orders',
      'core.process.digital.backup',
      'core.process.digital.iam',
      'core.process.digital.monitor',
      'core.process.digital.patch',
      'core.process.finance.accounting',
      'core.process.finance.payments',
      'core.process.finance.treasury',
      'core.process.govern.compliance',
      'core.process.govern.crisis',
      'core.process.govern.strategy',
      'core.process.people.hiring',
      'core.process.people.payroll',
      'core.process.people.skills',
      'core.risk.backup-failure',
      'core.risk.detection-gap',
      'core.risk.leavers',
      'core.risk.privileged-access',
      'core.risk.supplier-contract',
      'core.risk.unpatched',
      'finance.risk.card-data',
      'finance.risk.sanction-screening',
      'industrie.risk.remote-maintenance',
      'industrie.risk.safety',
      'public.risk.open-data',
      'public.risk.stale-data',
      'saas.risk.secrets',
      'saas.risk.tenant-restore',
      'sante.risk.consent',
      'sante.risk.device',
      'services.risk.client-access',
      'services.risk.subcontractor',
    ] },
  { version: '1.2', added: [
      'core.control.access-review',
      'core.control.backup-restore',
      'core.control.leavers',
      'core.control.patch-follow-up',
      'core.control.payment-validation',
      'core.control.privileged-review',
      'core.control.security-alerts',
      'core.control.supplier-clauses',
      'core.control.supplier-review',
    ] },
  { version: '1.3', added: [
      'core.kri.backup-success',
      'core.kri.leaver-accounts',
      'core.kri.overdue-patches',
      'core.kri.payment-exceptions',
      'core.kri.phishing-click',
      'core.kri.privileged-accounts',
      'core.kri.restore-age',
      'core.kri.security-incidents',
      'core.kri.supplier-without-clauses',
    ] },
  { version: '1.4', added: [
      'core.audit.access',
      'core.audit.backup',
      'core.audit.payments',
      'core.audit.suppliers',
    ] },
]

const parts = (v: string) => v.split('.').map(n => Number.parseInt(n, 10) || 0)
/** -1 | 0 | 1 selon l'ordre numérique des versions « majeure.mineure ». */
export function compareCatalogueVersions(a: string, b: string): number {
  const [am, an] = parts(a), [bm, bn] = parts(b)
  return am !== bm ? Math.sign(am - bm) : Math.sign((an ?? 0) - (bn ?? 0))
}

/** Plus petite version déjà importée par l'organisation (référence de comparaison) ; null si rien n'a été importé. */
export function oldestImportedVersion(versions: readonly (string | null | undefined)[]): string | null {
  const valid = versions.filter((v): v is string => typeof v === 'string' && /^\d+\.\d+$/.test(v))
  return valid.length ? valid.reduce((min, v) => (compareCatalogueVersions(v, min) < 0 ? v : min)) : null
}

/** Clés ajoutées APRÈS la version de référence et pas encore importées : des propositions, jamais des modifications de l'existant. */
export function newSince(since: string | null, existingKeys: readonly string[]): string[] {
  if (!since) return []
  const have = new Set(existingKeys)
  return CATALOGUE_CHANGELOG.filter(entry => compareCatalogueVersions(entry.version, since) > 0).flatMap(entry => entry.added).filter(key => !have.has(key))
}
