/**
 * tests-resilience.ts — Programme de tests de résilience opérationnelle numérique
 * (DORA, Règlement (UE) 2022/2554, art. 24 à 26) et rapport sur le réexamen du
 * cadre de gestion du risque lié aux TIC (art. 6 § 5). Module PUR.
 *
 * Types de tests : ceux énumérés à l'article 25 § 1 + le TLPT (art. 26) ; leurs
 * libellés officiels (EUR-Lex, 5 langues) sont dans l'i18n (t.testsResilience.types).
 * Spec : docs/specs/tests-resilience-dora.md.
 */

export const TEST_RESILIENCE_TYPES = [
  'VULNERABILITY', 'OPEN_SOURCE', 'NETWORK_SECURITY', 'GAP_ANALYSIS', 'PHYSICAL_SECURITY',
  'QUESTIONNAIRE_SCAN', 'SOURCE_CODE', 'SCENARIO', 'COMPATIBILITY', 'PERFORMANCE',
  'END_TO_END', 'PENETRATION', 'TLPT',
] as const
export type TestResilienceType = (typeof TEST_RESILIENCE_TYPES)[number]
export const TEST_RESILIENCE_STATUTS = ['PLANIFIE', 'EN_COURS', 'REALISE', 'ANNULE'] as const
export type TestResilienceStatut = (typeof TEST_RESILIENCE_STATUTS)[number]
export const TESTEURS = ['INTERNE', 'EXTERNE'] as const

export interface Constat { description: string; severite: number; corrige: boolean }

export interface TestResilienceInput {
  annee: number
  intitule: string
  type: TestResilienceType
  perimetre: string | null
  fonctionCritique: boolean
  processusId: string | null
  riskItemIds: string[]
  testeur: (typeof TESTEURS)[number]
  independant: boolean
  statut: TestResilienceStatut
  datePrevue: Date | null
  dateRealisation: Date | null
  resultat: string | null
  constats: Constat[]
}

const has = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const date = (v: unknown): Date | null => {
  if (typeof v !== 'string' || !v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function sanitizeConstats(v: unknown): Constat[] {
  if (!Array.isArray(v)) return []
  return v.flatMap(c => {
    if (!c || typeof c !== 'object') return []
    const o = c as Record<string, unknown>
    const description = text(o.description, 1000)
    if (!description) return []
    const n = Number(o.severite)
    return [{ description, severite: Number.isFinite(n) ? Math.min(4, Math.max(1, Math.round(n))) : 2, corrige: o.corrige === true }]
  }).slice(0, 100)
}

/** Valide et nettoie un test du programme. */
export function sanitizeTestResilience(body: unknown): { ok: true; value: TestResilienceInput } | { ok: false; error: 'intitule_requis' | 'type_invalide' | 'annee_invalide' } {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const intitule = text(o.intitule, 300)
  if (!intitule) return { ok: false, error: 'intitule_requis' }
  if (!has(TEST_RESILIENCE_TYPES, o.type)) return { ok: false, error: 'type_invalide' }
  const annee = Number(o.annee)
  if (!Number.isInteger(annee) || annee < 2020 || annee > 2100) return { ok: false, error: 'annee_invalide' }
  const ids = Array.isArray(o.riskItemIds) ? o.riskItemIds.filter((x): x is string => typeof x === 'string' && !!x) : []
  return {
    ok: true,
    value: {
      annee, intitule, type: o.type,
      perimetre: text(o.perimetre, 2000),
      fonctionCritique: o.fonctionCritique === true,
      processusId: text(o.processusId, 64),
      riskItemIds: [...new Set(ids)].slice(0, 50),
      testeur: has(TESTEURS, o.testeur) ? o.testeur : 'INTERNE',
      independant: o.independant !== false,
      statut: has(TEST_RESILIENCE_STATUTS, o.statut) ? o.statut : 'PLANIFIE',
      datePrevue: date(o.datePrevue),
      dateRealisation: date(o.dateRealisation),
      resultat: text(o.resultat, 5000),
      constats: sanitizeConstats(o.constats),
    },
  }
}

// ─── Indicateurs du programme ────────────────────────────────────────────────

export interface TestResilienceLite {
  id: string; annee: number; intitule: string; type: string; statut: string
  fonctionCritique: boolean; independant: boolean; testeur: string
  dateRealisation: Date | null; constats: Constat[]; riskItemIds: string[]
}

const addYears = (d: Date, n: number) => { const x = new Date(d); x.setUTCFullYear(x.getUTCFullYear() + n); return x }
const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Indicateurs d'une année : réalisation (hors annulés), répartition par type,
 * tests réalisés sur des fonctions critiques ou importantes (art. 24 § 6), tests non
 * indépendants (art. 24 § 4), constats ouverts/corrigés, échéance TLPT (tous les
 * trois ans au moins, art. 26 § 1 — calculée sur tout l'historique).
 */
export function programmeStats(tests: TestResilienceLite[], annee: number, now: Date) {
  const year = tests.filter(t => t.annee === annee && t.statut !== 'ANNULE')
  const realises = year.filter(t => t.statut === 'REALISE')
  const parType: Record<string, { planifies: number; realises: number }> = {}
  for (const t of year) {
    const p = parType[t.type] ?? { planifies: 0, realises: 0 }
    p.planifies += 1
    if (t.statut === 'REALISE') p.realises += 1
    parType[t.type] = p
  }
  const constats = year.flatMap(t => t.constats)
  const tlpts = tests.filter(t => t.type === 'TLPT' && t.statut === 'REALISE' && t.dateRealisation).map(t => t.dateRealisation!).sort((a, b) => b.getTime() - a.getTime())
  const dernier = tlpts[0] ?? null
  const echeance = dernier ? addYears(dernier, 3) : null
  return {
    planifies: year.length,
    realises: realises.length,
    tauxRealisation: year.length ? Math.round((realises.length / year.length) * 100) : 0,
    parType,
    fonctionsCritiquesTestees: realises.filter(t => t.fonctionCritique).length,
    nonIndependants: realises.filter(t => !t.independant).length,
    constats: {
      total: constats.length,
      ouverts: constats.filter(c => !c.corrige).length,
      corriges: constats.filter(c => c.corrige).length,
      ouvertsCritiques: constats.filter(c => !c.corrige && c.severite >= 4).length,
    },
    tlpt: { dernier: dernier ? iso(dernier) : null, echeance: echeance ? iso(echeance) : null, enRetard: !!echeance && now.getTime() > echeance.getTime() },
  }
}

// ─── Rapport sur le réexamen du cadre (art. 6 § 5) ───────────────────────────

export interface RapportLabels {
  titre: string; organisation: string; annee: string; programme: string; realisation: string
  parType: string; colType: string; colPlanifies: string; colRealises: string
  fonctionsCritiques: string; constats: string; constatsDetail: string; constatsOuverts: string
  incidents: string; aucunIncident: string; risques: string; aucunRisque: string
  tlpt: string; tlptDetail: string; tlptNone: string; conclusions: string; conclusionsHint: string
  types: Record<string, string>; severite: string
  /** Sections du livrable GRC global (facultatives : omises si la donnée n'est pas fournie). */
  tiers?: string; tiersDetail?: string; regulateur?: string; regulateurDetail?: string; actions?: string; actionsDetail?: string
}

/** Rapport de réexamen en Markdown (converti en .docx par lib/markdown-docx). */
export function buildRapportReexamen(args: {
  organisation: string; annee: number; now: Date
  tests: TestResilienceLite[]
  incidents: { intitule: string; date: string }[]
  risques: { intitule: string; niveauResiduel: number | null }[]
  /** Registre des arrangements TIC (DORA art. 28) ; constats du régulateur ; plans d'action issus des tests. */
  tiers?: { total: number; critiques: number; finProche: number; sansQuestionnaire: number }
  regulateur?: { ouverts: number; echus: number }
  actions?: { total: number; ouvertes: number; enRetard: number }
  labels: RapportLabels
}): string {
  const L = args.labels
  const s = programmeStats(args.tests, args.annee, args.now)
  const cell = (v: string) => v.replace(/\|/g, '/')
  const lines: string[] = [
    `# ${L.titre}`,
    `**${L.organisation} :** ${args.organisation} · **${L.annee} :** ${args.annee}`,
    `## ${L.programme}`,
    L.realisation.replace('{realises}', String(s.realises)).replace('{planifies}', String(s.planifies)).replace('{taux}', String(s.tauxRealisation)),
    L.fonctionsCritiques.replace('{n}', String(s.fonctionsCritiquesTestees)),
    `**${L.tlpt} :** ${s.tlpt.dernier ? L.tlptDetail.replace('{dernier}', s.tlpt.dernier).replace('{echeance}', s.tlpt.echeance!) : L.tlptNone}`,
    `## ${L.parType}`,
    // Tableau d'un seul bloc : les lignes doivent être contiguës (lib/markdown-docx).
    [
      `| ${L.colType} | ${L.colPlanifies} | ${L.colRealises} |`,
      '| --- | --- | --- |',
      ...TEST_RESILIENCE_TYPES.filter(ty => s.parType[ty]).map(ty => `| ${cell(L.types[ty] ?? ty)} | ${s.parType[ty].planifies} | ${s.parType[ty].realises} |`),
    ].join('\n'),
    `## ${L.constats}`,
    L.constatsDetail.replace('{ouverts}', String(s.constats.ouverts)).replace('{corriges}', String(s.constats.corriges)),
  ]
  const ouverts = args.tests.filter(t => t.annee === args.annee && t.statut !== 'ANNULE').flatMap(t => t.constats.filter(c => !c.corrige))
  if (ouverts.length) {
    lines.push(`**${L.constatsOuverts}**`)
    for (const c of ouverts.sort((a, b) => b.severite - a.severite)) lines.push(`- ${c.description} (${L.severite.replace('{n}', String(c.severite))})`)
  }
  const fill = (tpl: string, v: Record<string, number>) => Object.entries(v).reduce((acc, [k, n]) => acc.replace(`{${k}}`, String(n)), tpl)
  if (args.actions && L.actions && L.actionsDetail) lines.push(`## ${L.actions}`, fill(L.actionsDetail, args.actions))
  if (args.tiers && L.tiers && L.tiersDetail) lines.push(`## ${L.tiers}`, fill(L.tiersDetail, args.tiers))
  if (args.regulateur && L.regulateur && L.regulateurDetail) lines.push(`## ${L.regulateur}`, fill(L.regulateurDetail, args.regulateur))
  lines.push(`## ${L.incidents}`)
  if (args.incidents.length) for (const i of args.incidents) lines.push(`- ${i.intitule} (${i.date})`)
  else lines.push(L.aucunIncident)
  lines.push(`## ${L.risques}`)
  if (args.risques.length) for (const r of args.risques) lines.push(`- ${r.intitule} (${r.niveauResiduel ?? '—'})`)
  else lines.push(L.aucunRisque)
  lines.push(`## ${L.conclusions}`, L.conclusionsHint)
  return lines.join('\n\n')
}

// ─── Synchronisation constat ↔ plan d'action ─────────────────────────────────────────────────────────────────────────
/** Actions liées à un constat (ref `constat:<index>`) regroupées par index : ouvertes (non FAIT) et faites. */
export function actionsParConstat(liens: readonly { ref?: string | null; statut: string }[]): Record<number, { ouvertes: number; faites: number }> {
  const out: Record<number, { ouvertes: number; faites: number }> = {}
  for (const l of liens) {
    const m = /^constat:(\d+)$/.exec(l.ref ?? '')
    if (!m) continue
    const i = Number(m[1]); const e = (out[i] ??= { ouvertes: 0, faites: 0 })
    if (l.statut === 'FAIT') e.faites++; else e.ouvertes++
  }
  return out
}

/** Index des constats dont TOUTES les actions sont faites et qui ne sont pas encore corrigés : la clôture est PROPOSÉE, jamais appliquée seule. */
export function constatsAClore(constats: readonly { corrige: boolean }[], par: Record<number, { ouvertes: number; faites: number }>): number[] {
  return constats.flatMap((c, i) => (!c.corrige && par[i] && par[i].ouvertes === 0 && par[i].faites > 0 ? [i] : []))
}
