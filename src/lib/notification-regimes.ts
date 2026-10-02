/**
 * notification-regimes.ts — Régimes de notification d'incident configurables. Module PUR.
 *
 * Un incident peut relever de PLUSIEURS obligations à la fois (NIS2, RGPD, exigence
 * interne, contrat client…), chacune avec sa propre horloge. Un RÉGIME =
 * { code, autorité, déclencheur, phases[ { délai, point de départ } ] }. Le catalogue
 * livré est surchargeable par organisation (activation, délais) et complétable par des
 * régimes personnalisés — sans code. DORA (art. 19) garde son moteur dédié
 * (`dora-reporting.ts`, règle « le plus tôt des deux délais »).
 *
 * Sources des délais livrés (à citer avec leur version) :
 *  - NIS2 — Directive (UE) 2022/2555, art. 23 § 4 : alerte précoce ≤ 24 h, notification
 *    d'incident ≤ 72 h après avoir eu connaissance de l'incident important, rapport final
 *    au plus tard un mois après la notification d'incident (EUR-Lex, vérifié FR/EN/DE/ES).
 *  - RGPD — Règlement (UE) 2016/679, art. 33 § 1 : notification à l'autorité de contrôle
 *    dans les meilleurs délais et, si possible, 72 h après en avoir pris connaissance.
 *  - « Interne » : valeurs d'exemple, modifiables — aucune source réglementaire.
 * Outil d'aide au SUIVI : ne vaut pas déclaration.
 */

/** `jOuvres` : jours ouvrés (samedi et dimanche exclus ; pas de calendrier de jours fériés — à ajuster si besoin). */
export interface Delai { h?: number; mois?: number; jours?: number; jOuvres?: number }
/** `apres` : 'CONNAISSANCE' (détection) ou le code d'une phase précédente du même régime. */
export interface RegimePhase { code: string; labelKey?: string; label?: string; delai: Delai; apres: string }

export const DECLENCHEURS = ['TOUJOURS', 'INCIDENT_SIGNIFICATIF', 'DONNEES_PERSONNELLES', 'CONTRACTUEL', 'MANUEL'] as const
export type Declencheur = (typeof DECLENCHEURS)[number]

export interface Regime {
  code: string
  labelKey?: string
  label?: string
  autorite?: string
  declencheur: Declencheur
  actif: boolean
  phases: RegimePhase[]
  custom?: boolean
}

/** Attributs de l'incident qui pilotent l'applicabilité des régimes. */
export interface IncidentAttributs {
  significatif?: boolean
  donneesPersonnelles?: boolean
  contractuel?: boolean
  /** Régimes ajoutés à la main (quel que soit le déclencheur). */
  regimes?: string[]
}

/** Nettoie les attributs stockés sur l'incident (booléens vrais uniquement, codes de régime valides). */
export function sanitizeAttributs(input: unknown): IncidentAttributs {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const o = input as Record<string, unknown>
  const out: IncidentAttributs = {}
  if (o.significatif === true) out.significatif = true
  if (o.donneesPersonnelles === true) out.donneesPersonnelles = true
  if (o.contractuel === true) out.contractuel = true
  if (Array.isArray(o.regimes)) {
    const r = [...new Set(o.regimes.filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x.trim())).map(x => x.trim()))].slice(0, 12)
    if (r.length) out.regimes = r
  }
  return out
}

export const CATALOGUE_REGIMES: Regime[] = [
  {
    code: 'NIS2', labelKey: 'notifRegimes.NIS2.label', declencheur: 'INCIDENT_SIGNIFICATIF', actif: false,
    phases: [
      { code: 'ALERTE_PRECOCE', labelKey: 'notifRegimes.NIS2.phases.ALERTE_PRECOCE', delai: { h: 24 }, apres: 'CONNAISSANCE' },
      { code: 'NOTIFICATION', labelKey: 'notifRegimes.NIS2.phases.NOTIFICATION', delai: { h: 72 }, apres: 'CONNAISSANCE' },
      { code: 'RAPPORT_FINAL', labelKey: 'notifRegimes.NIS2.phases.RAPPORT_FINAL', delai: { mois: 1 }, apres: 'NOTIFICATION' },
    ],
  },
  {
    code: 'RGPD_33', labelKey: 'notifRegimes.RGPD_33.label', declencheur: 'DONNEES_PERSONNELLES', actif: false,
    phases: [{ code: 'NOTIFICATION', labelKey: 'notifRegimes.RGPD_33.phases.NOTIFICATION', delai: { h: 72 }, apres: 'CONNAISSANCE' }],
  },
  {
    // Cyber Resilience Act — Règlement (UE) 2024/2847, art. 14 (obligations de notification applicables depuis le 11 septembre 2026) :
    // alerte précoce ≤ 24 h, notification ≤ 72 h, rapport final ≤ 1 mois après la notification (incident grave ; pour une vulnérabilité
    // activement exploitée : 14 jours après la mise à disposition d'une mesure corrective — à adapter dans la configuration).
    code: 'CRA_14', labelKey: 'notifRegimes.CRA_14.label', declencheur: 'MANUEL', actif: false,
    phases: [
      { code: 'ALERTE_PRECOCE', labelKey: 'notifRegimes.CRA_14.phases.ALERTE_PRECOCE', delai: { h: 24 }, apres: 'CONNAISSANCE' },
      { code: 'NOTIFICATION', labelKey: 'notifRegimes.CRA_14.phases.NOTIFICATION', delai: { h: 72 }, apres: 'CONNAISSANCE' },
      { code: 'RAPPORT_FINAL', labelKey: 'notifRegimes.CRA_14.phases.RAPPORT_FINAL', delai: { mois: 1 }, apres: 'NOTIFICATION' },
    ],
  },
  {
    // États-Unis — SEC, Form 8-K item 1.05 : 4 jours ouvrés après la détermination du caractère significatif (matérialité) de l'incident.
    code: 'SEC_8K', labelKey: 'notifRegimes.SEC_8K.label', declencheur: 'MANUEL', actif: false,
    phases: [{ code: 'FORM_8K', labelKey: 'notifRegimes.SEC_8K.phases.FORM_8K', delai: { jOuvres: 4 }, apres: 'CONNAISSANCE' }],
  },
  {
    // États-Unis — NYDFS, 23 NYCRR 500.17 : notification au Superintendent ≤ 72 h après la détermination de l'incident de cybersécurité.
    code: 'NYDFS_500_17', labelKey: 'notifRegimes.NYDFS_500_17.label', declencheur: 'MANUEL', actif: false,
    phases: [{ code: 'NOTIFICATION', labelKey: 'notifRegimes.NYDFS_500_17.phases.NOTIFICATION', delai: { h: 72 }, apres: 'CONNAISSANCE' }],
  },
  {
    // États-Unis — HIPAA, 45 CFR 164.404 et 164.408 : notification des personnes (et du HHS à partir de 500 personnes) ≤ 60 jours après la découverte.
    code: 'HIPAA_BREACH', labelKey: 'notifRegimes.HIPAA_BREACH.label', declencheur: 'MANUEL', actif: false,
    phases: [{ code: 'NOTIFICATION', labelKey: 'notifRegimes.HIPAA_BREACH.phases.NOTIFICATION', delai: { jours: 60 }, apres: 'CONNAISSANCE' }],
  },
  {
    code: 'INTERNE', labelKey: 'notifRegimes.INTERNE.label', declencheur: 'TOUJOURS', actif: false,
    phases: [
      { code: 'INFORMER_DIRECTION', labelKey: 'notifRegimes.INTERNE.phases.INFORMER_DIRECTION', delai: { h: 4 }, apres: 'CONNAISSANCE' },
      { code: 'COMPTE_RENDU_COMITE', labelKey: 'notifRegimes.INTERNE.phases.COMPTE_RENDU_COMITE', delai: { mois: 1 }, apres: 'CONNAISSANCE' },
    ],
  },
]

// ─── Configuration d'organisation ────────────────────────────────────────────

export interface RegimePhaseConfig { code: string; label?: string; delaiH?: number; delaiMois?: number; apres?: string }
export interface RegimeConfigEntry {
  code: string; actif?: boolean; label?: string; autorite?: string; declencheur?: Declencheur; phases?: RegimePhaseConfig[]
}

const CODE_RE = /^[A-Za-z0-9_-]{1,40}$/
export const MAX_REGIMES_PERSO = 12
const MAX_PHASES = 6
const MAX_DELAI_H = 24 * 366
const MAX_DELAI_MOIS = 12

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const s = v.trim().slice(0, max)
  return s || undefined
}
const bounded = (v: unknown, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : undefined

function cleanPhases(input: unknown, requireLabel: boolean): RegimePhaseConfig[] {
  if (!Array.isArray(input)) return []
  const out: RegimePhaseConfig[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (out.length >= MAX_PHASES) break
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const code = typeof o.code === 'string' ? o.code.trim() : ''
    if (!CODE_RE.test(code) || seen.has(code)) continue
    const label = str(o.label, 120)
    if (requireLabel && !label) continue
    const delaiH = bounded(o.delaiH, MAX_DELAI_H)
    const delaiMois = delaiH === undefined ? bounded(o.delaiMois, MAX_DELAI_MOIS) : undefined
    if (requireLabel && delaiH === undefined && delaiMois === undefined) continue
    const apresRaw = typeof o.apres === 'string' ? o.apres : 'CONNAISSANCE'
    const apres = apresRaw === 'CONNAISSANCE' || seen.has(apresRaw) ? apresRaw : 'CONNAISSANCE'
    seen.add(code)
    out.push({ code, ...(label ? { label } : {}), ...(delaiH !== undefined ? { delaiH } : {}), ...(delaiMois !== undefined ? { delaiMois } : {}), apres })
  }
  return out
}

/** Nettoie la configuration d'organisation (activation, délais, régimes personnalisés). */
export function sanitizeRegimesConfig(input: unknown): RegimeConfigEntry[] {
  if (!Array.isArray(input)) return []
  const out: RegimeConfigEntry[] = []
  const seen = new Set<string>()
  let customs = 0
  const catalogue = new Set(CATALOGUE_REGIMES.map(r => r.code))
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const code = typeof o.code === 'string' ? o.code.trim() : ''
    if (!CODE_RE.test(code) || seen.has(code)) continue
    const actif = o.actif === true
    if (catalogue.has(code)) {
      seen.add(code)
      const phases = cleanPhases(o.phases, false).map(({ code: c, delaiH, delaiMois }) => ({ code: c, ...(delaiH !== undefined ? { delaiH } : {}), ...(delaiMois !== undefined ? { delaiMois } : {}) }))
      out.push({ code, actif, ...(phases.length ? { phases } : {}) })
      continue
    }
    if (customs >= MAX_REGIMES_PERSO) continue
    const label = str(o.label, 120)
    const phases = cleanPhases(o.phases, true)
    if (!label || phases.length === 0) continue
    const declencheur = (DECLENCHEURS as readonly string[]).includes(o.declencheur as string) ? (o.declencheur as Declencheur) : 'MANUEL'
    const autorite = str(o.autorite, 120)
    seen.add(code); customs++
    out.push({ code, actif, label, ...(autorite ? { autorite } : {}), declencheur, phases })
  }
  return out
}

const toDelai = (p: { delaiH?: number; delaiMois?: number }): Delai | null =>
  p.delaiH !== undefined ? { h: p.delaiH } : p.delaiMois !== undefined ? { mois: p.delaiMois } : null

/** Catalogue livré + configuration de l'organisation → liste effective des régimes. */
export function resolveRegimes(config: unknown): Regime[] {
  const entries = sanitizeRegimesConfig(config)
  const byCode = new Map(entries.map(e => [e.code, e]))
  const base = CATALOGUE_REGIMES.map((r): Regime => {
    const e = byCode.get(r.code)
    return {
      ...r,
      actif: e?.actif ?? false,
      phases: r.phases.map(p => {
        const o = e?.phases?.find(x => x.code === p.code)
        const d = o ? toDelai(o) : null
        return d ? { ...p, delai: d } : { ...p }
      }),
    }
  })
  const customs = entries.filter(e => !CATALOGUE_REGIMES.some(r => r.code === e.code)).map((e): Regime => ({
    code: e.code, label: e.label, autorite: e.autorite, declencheur: e.declencheur ?? 'MANUEL', actif: e.actif ?? false, custom: true,
    phases: (e.phases ?? []).map(p => ({ code: p.code, label: p.label, delai: toDelai(p) ?? { h: 24 }, apres: p.apres ?? 'CONNAISSANCE' })),
  }))
  return [...base, ...customs]
}

/** Un régime s'applique s'il est actif et que son déclencheur est vrai (ou ajouté à la main). */
export function regimeApplicable(regime: Regime, attrs: IncidentAttributs): boolean {
  if (!regime.actif) return false
  if (attrs.regimes?.includes(regime.code)) return true
  switch (regime.declencheur) {
    case 'TOUJOURS': return true
    case 'INCIDENT_SIGNIFICATIF': return attrs.significatif === true
    case 'DONNEES_PERSONNELLES': return attrs.donneesPersonnelles === true
    case 'CONTRACTUEL': return attrs.contractuel === true
    default: return false
  }
}

// ─── Notifications soumises ──────────────────────────────────────────────────

export interface NotificationSoumise { regime: string; phase: string; soumisLe: string; reference?: string }

/** Nettoie la liste stockée (une soumission par régime × phase, dernière valeur gardée). */
export function sanitizeNotifications(input: unknown): NotificationSoumise[] {
  if (!Array.isArray(input)) return []
  const map = new Map<string, NotificationSoumise>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const regime = typeof o.regime === 'string' ? o.regime.trim() : ''
    const phase = typeof o.phase === 'string' ? o.phase.trim() : ''
    if (!CODE_RE.test(regime) || !CODE_RE.test(phase)) continue
    const d = typeof o.soumisLe === 'string' ? new Date(o.soumisLe) : null
    if (!d || Number.isNaN(d.getTime())) continue
    const reference = str(o.reference, 120)
    map.set(`${regime}/${phase}`, { regime, phase, soumisLe: d.toISOString(), ...(reference ? { reference } : {}) })
  }
  return [...map.values()].slice(0, 50)
}

export function marquerSoumis(list: NotificationSoumise[], n: { regime: string; phase: string; soumisLe: Date; reference?: string }): NotificationSoumise[] {
  return sanitizeNotifications([...list, { regime: n.regime, phase: n.phase, soumisLe: n.soumisLe.toISOString(), reference: n.reference }])
}

export function retirerSoumission(list: NotificationSoumise[], regime: string, phase: string): NotificationSoumise[] {
  return list.filter(x => !(x.regime === regime && x.phase === phase))
}

// ─── Horloges ────────────────────────────────────────────────────────────────

export type HorlogeStatut = 'A_FAIRE' | 'SOUMIS' | 'EN_RETARD' | 'EN_ATTENTE'
export interface HorlogePhase {
  code: string; labelKey?: string; label?: string
  echeance: Date | null; statut: HorlogeStatut
  soumisLe: Date | null; reference?: string
  /** Soumise après l'échéance. */
  tardive: boolean
  /** Point de départ du délai (connaissance ou soumission de la phase précédente) : sert à dimensionner les relances. */
  ancre?: Date | null
}
export interface HorlogeRegime { regime: string; labelKey?: string; label?: string; autorite?: string; phases: HorlogePhase[] }

function ajouter(d: Date, delai: Delai): Date {
  const r = new Date(d.getTime())
  if (delai.mois) r.setUTCMonth(r.getUTCMonth() + delai.mois)
  if (delai.jours) r.setUTCDate(r.getUTCDate() + delai.jours)
  if (delai.jOuvres) {
    let restant = delai.jOuvres
    while (restant > 0) { r.setUTCDate(r.getUTCDate() + 1); const j = r.getUTCDay(); if (j !== 0 && j !== 6) restant-- }
  }
  if (delai.h) r.setTime(r.getTime() + delai.h * 3600_000)
  return r
}

/**
 * Horloges de tous les régimes applicables à un incident. `connaissance` = date à
 * laquelle l'entité a eu connaissance de l'incident (détection). Sans elle, aucune
 * échéance n'est inventée (statut EN_ATTENTE) ; une phase qui suit une autre attend
 * la soumission de celle-ci.
 */
export function calculerHorloges(
  inc: { connaissance: Date | null; attributs: IncidentAttributs; notifications: NotificationSoumise[] },
  regimes: Regime[],
  now: Date,
): HorlogeRegime[] {
  return regimes.filter(r => regimeApplicable(r, inc.attributs)).map(r => {
    const soumis = (code: string) => inc.notifications.find(n => n.regime === r.code && n.phase === code)
    const phases = r.phases.map((p): HorlogePhase => {
      const ancre = p.apres === 'CONNAISSANCE' ? inc.connaissance : (() => { const s = soumis(p.apres); return s ? new Date(s.soumisLe) : null })()
      const echeance = ancre ? ajouter(ancre, p.delai) : null
      const s = soumis(p.code)
      const soumisLe = s ? new Date(s.soumisLe) : null
      const tardive = !!(soumisLe && echeance && soumisLe.getTime() > echeance.getTime())
      const statut: HorlogeStatut = soumisLe ? 'SOUMIS' : !echeance ? 'EN_ATTENTE' : now.getTime() > echeance.getTime() ? 'EN_RETARD' : 'A_FAIRE'
      return { code: p.code, labelKey: p.labelKey, label: p.label, echeance, statut, soumisLe, ...(s?.reference ? { reference: s.reference } : {}), tardive, ancre }
    })
    return { regime: r.code, labelKey: r.labelKey, label: r.label, autorite: r.autorite, phases }
  })
}
