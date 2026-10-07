// ─── Plans de contrôle types : composition équilibrée par domaine ───
// Un plan type retient UN contrôle du catalogue par domaine du métier (dans l'ordre de priorité), puis des compléments.
// Calculé par ACRA (aucun LLM, aucune écriture) : sert d'ossature, à qualifier par l'organisation.

import { listSectorSuggestions, type SectorCode } from './sector-suggestions'

type Locale = 'fr' | 'en' | 'de' | 'es' | 'it'

interface ProfileDomain { id: string; key: string }
interface Profile { sector: SectorCode; domains: ProfileDomain[]; extras: string[] }

export const CONTROL_PLAN_PROFILES: Record<string, Profile> = {
  MUTUELLE_SANTE: {
    sector: 'ASSURANCE',
    domains: [
      { id: 'governance', key: 'assurance.control.key-functions' },
      { id: 'solvency', key: 'assurance.control.solvency-coverage' },
      { id: 'benefits', key: 'assurance.control.benefits-sample' },
      { id: 'health-data', key: 'assurance.control.health-data-access' },
      { id: 'contributions', key: 'assurance.control.member-contributions' },
      { id: 'advice', key: 'assurance.control.advice-sample' },
      { id: 'complaints', key: 'assurance.control.complaints' },
      { id: 'delegates', key: 'assurance.control.delegated-managers' },
      { id: 'fit-proper', key: 'assurance.control.fit-proper' },
      { id: 'aml', key: 'assurance.control.aml-framework' },
      { id: 'ict', key: 'assurance.control.resilience-testing' },
      { id: 'continuity', key: 'assurance.control.continuity-test' },
      { id: 'asset-freeze', key: 'assurance.control.asset-freeze' },
      { id: 'orsa', key: 'assurance.control.orsa-process' },
      { id: 'reserves', key: 'assurance.control.reserve-backtesting' },
    ],
    extras: [
      'assurance.control.remediation-followup', 'assurance.control.statutes-assembly', 'assurance.control.incident-reporting-drill', 'core.control.access-review',
      'core.control.backup-restore', 'assurance.control.ict-register', 'assurance.control.policies-review',
    ],
  },
}

export interface PlanControl { rank: number; domain: string; key: string; title: string; periodicite?: string; controlType?: string; references: string[] }
export interface ControlPlan { profile: string; controls: PlanControl[]; typeBalance: Record<string, number>; profiles: string[]; note: string }

export function buildControlPlan(profile: string, opts: { count?: number; locale?: Locale }): ControlPlan {
  const profiles = Object.keys(CONTROL_PLAN_PROFILES)
  const note = 'Ossature calculée par ACRA (aucun LLM) : un contrôle par domaine du métier, à qualifier et à compléter par l’organisation ; contenu « à relire par un expert ».'
  const def = CONTROL_PLAN_PROFILES[profile]
  if (!def) return { profile, controls: [], typeBalance: {}, profiles, note }
  const count = Math.min(30, Math.max(1, Math.floor(opts.count ?? def.domains.length)))
  const catalogue = new Map(listSectorSuggestions([def.sector], opts.locale ?? 'fr').map(i => [i.key, i]))
  const slots: Array<{ domain: string; key: string }> = [
    ...def.domains.map(d => ({ domain: d.id, key: d.key })),
    ...def.extras.map(k => ({ domain: k.split('.').pop() ?? k, key: k })),
  ]
  const controls: PlanControl[] = []
  for (const s of slots) {
    const item = catalogue.get(s.key)
    if (!item || controls.length >= count) continue
    controls.push({ rank: controls.length + 1, domain: s.domain, key: s.key, title: item.title, ...(item.periodicite ? { periodicite: item.periodicite } : {}), ...(item.controlType ? { controlType: item.controlType } : {}), references: item.references ?? [] })
  }
  const typeBalance: Record<string, number> = {}
  for (const c of controls) typeBalance[c.controlType ?? 'NON_TYPE'] = (typeBalance[c.controlType ?? 'NON_TYPE'] ?? 0) + 1
  return { profile, controls, typeBalance, profiles, note: `${note} Si le plan ne compte aucun contrôle correctif, remplacer un contrôle par « assurance.control.remediation-followup ».` }
}
