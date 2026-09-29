/**
 * champs-perso.ts — Champs personnalisés par module (lot L5). Module PUR.
 *
 * Absorbe le « il nous faut aussi ce champ » sans migration : l'ADMIN de l'organisation définit, par
 * module (incident, contrôle, mission d'audit), jusqu'à 20 champs typés (texte, nombre, liste, date,
 * oui/non), éventuellement requis et restreints à certains rôles. Les valeurs sont stockées dans une
 * colonne JSON `champs` de l'objet et validées contre les définitions à chaque écriture.
 */

export const CHAMPS_MODULES = ['incident', 'controle', 'mission', 'constat'] as const
export type ChampsModule = (typeof CHAMPS_MODULES)[number]
export const CHAMP_TYPES = ['TEXTE', 'NOMBRE', 'LISTE', 'DATE', 'OUINON'] as const
export type ChampType = (typeof CHAMP_TYPES)[number]
export const MAX_CHAMPS_PAR_MODULE = 20
const MAX_OPTIONS = 20
const MAX_TEXTE = 500

/** Rôles pouvant être visés par une restriction (rôles applicatifs connus). */
export const ROLES_CHAMP = ['ADMIN', 'SUPER_ADMIN', 'RSSI', 'RISK_MANAGER', 'CONFORMITE', 'DPO', 'CONTROLEUR', 'AUDITEUR', 'DIRECTION_METIER', 'ANALYSTE', 'METIER', 'LECTEUR'] as const

export interface ChampDef { code: string; label: string; type: ChampType; options?: string[]; requis?: boolean; roles?: string[] }
export type ChampsConfig = Partial<Record<ChampsModule, ChampDef[]>>
export type ChampsValeurs = Record<string, string | number | boolean>

const CODE_RE = /^[a-z][a-z0-9_]{0,39}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Nettoie la configuration : modules connus, codes valides et uniques, types connus, plafonds. */
export function sanitizeChampsConfig(input: unknown): ChampsConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: ChampsConfig = {}
  for (const mod of CHAMPS_MODULES) {
    const raw = (input as Record<string, unknown>)[mod]
    if (!Array.isArray(raw)) continue
    const defs: ChampDef[] = []
    const seen = new Set<string>()
    for (const r of raw) {
      if (defs.length >= MAX_CHAMPS_PAR_MODULE) break
      if (!r || typeof r !== 'object') continue
      const o = r as Record<string, unknown>
      const code = typeof o.code === 'string' ? o.code.trim() : ''
      const label = typeof o.label === 'string' ? o.label.trim().slice(0, 80) : ''
      const type = (CHAMP_TYPES as readonly string[]).includes(o.type as string) ? (o.type as ChampType) : null
      if (!CODE_RE.test(code) || seen.has(code) || !label || !type) continue
      const def: ChampDef = { code, label, type }
      if (type === 'LISTE') {
        const opts = [...new Set((Array.isArray(o.options) ? o.options : []).filter((x): x is string => typeof x === 'string').map(x => x.trim().slice(0, 80)).filter(Boolean))].slice(0, MAX_OPTIONS)
        if (opts.length === 0) continue
        def.options = opts
      }
      if (o.requis === true) def.requis = true
      const roles = Array.isArray(o.roles) ? [...new Set(o.roles.filter((x): x is string => typeof x === 'string' && (ROLES_CHAMP as readonly string[]).includes(x)))] : []
      if (roles.length) def.roles = roles
      seen.add(code); defs.push(def)
    }
    if (defs.length) out[mod] = defs
  }
  return out
}

/** Définitions accessibles (lecture ET écriture) à un rôle : sans `roles`, tout le monde. */
export function defsAccessibles(defs: ChampDef[], role: string): ChampDef[] {
  return defs.filter(d => !d.roles || d.roles.includes(role))
}

/** Valeurs nettoyées : champs définis seulement, converties selon leur type ; invalides écartées. */
export function sanitizeValeurs(defs: ChampDef[], input: unknown): ChampsValeurs {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const raw = input as Record<string, unknown>
  const out: ChampsValeurs = {}
  for (const d of defs) {
    const v = raw[d.code]
    if (v === undefined || v === null || v === '') continue
    switch (d.type) {
      case 'TEXTE': if (typeof v === 'string' && v.trim()) out[d.code] = v.trim().slice(0, MAX_TEXTE); break
      case 'NOMBRE': { const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.')); if (Number.isFinite(n)) out[d.code] = n; break }
      case 'LISTE': if (typeof v === 'string' && d.options?.includes(v)) out[d.code] = v; break
      case 'DATE': if (typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(new Date(v).getTime())) out[d.code] = v; break
      case 'OUINON': if (typeof v === 'boolean') out[d.code] = v; break
    }
  }
  return out
}

/** Valeurs visibles par un rôle (les champs restreints sont retirés à la lecture). */
export function valeursVisibles(defs: ChampDef[], valeurs: unknown, role: string): ChampsValeurs {
  const ok = new Set(defsAccessibles(defs, role).map(d => d.code))
  return Object.fromEntries(Object.entries(sanitizeValeurs(defs, valeurs)).filter(([k]) => ok.has(k)))
}

/** Codes des champs REQUIS (et accessibles au rôle) non renseignés. */
export function champsRequisManquants(defs: ChampDef[], valeurs: ChampsValeurs, role: string): string[] {
  return defsAccessibles(defs, role).filter(d => d.requis && valeurs[d.code] === undefined).map(d => d.code)
}

/**
 * Fusion à l'écriture : les champs ACCESSIBLES au rôle sont remplacés par les valeurs entrantes (absents =
 * effacés) ; les champs réservés à d'autres rôles sont conservés tels quels (jamais écrasés ni divulgués).
 */
export function fusionnerChamps(defs: ChampDef[], existant: unknown, entrant: unknown, role: string): ChampsValeurs {
  const accessibles = defsAccessibles(defs, role)
  const ok = new Set(accessibles.map(d => d.code))
  const conserves = Object.fromEntries(Object.entries(sanitizeValeurs(defs, existant)).filter(([k]) => !ok.has(k)))
  return { ...conserves, ...sanitizeValeurs(accessibles, entrant) }
}

/** Copie d'un objet avec ses champs personnalisés réduits à ce que le rôle peut voir (réponses d'API). */
export function avecChampsVisibles<T extends { champs?: unknown }>(obj: T, defs: ChampDef[], role: string): T {
  return { ...obj, champs: valeursVisibles(defs, obj.champs, role) }
}

// ─── Exports et rapports ─────────────────────────────────────────────────────

/** Champs sans restriction de rôle : les seuls admis dans un rapport figé (lu par tous les destinataires). */
export function champsPublics(defs: ChampDef[]): ChampDef[] {
  return defs.filter(d => !d.roles)
}

/** En-têtes et valeurs des champs personnalisés pour un export, limités à ce que le rôle peut voir. */
export function colonnesChampsExport(defs: ChampDef[], valeurs: unknown, role: string, oui_non: { oui: string; non: string }): { entetes: string[]; valeurs: (string | number)[] } {
  const acc = defsAccessibles(defs, role)
  const v = valeursVisibles(defs, valeurs, role)
  return {
    entetes: acc.map(d => d.label),
    valeurs: acc.map(d => { const x = v[d.code]; return x === undefined ? '' : typeof x === 'boolean' ? (x ? oui_non.oui : oui_non.non) : x }),
  }
}
