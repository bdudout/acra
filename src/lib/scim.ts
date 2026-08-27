// ─── SCIM 2.0 — cœur pur (provisioning/déprovisioning) ───────────────────────
// Mapping entre les ressources SCIM (RFC 7643/7644) envoyées par l'IdP
// (SailPoint / Azure AD / Okta) et le modèle utilisateur ACRA. Logique PURE et
// testable ; la persistance + l'auth Bearer vivent dans les routes /api/scim.

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User'
export const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse'
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error'
export const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp'

export interface AcraUserFields { email: string; name: string | null; active: boolean }

const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const coerceBool = (v: unknown, dflt = true): boolean => {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return !/^(false|0|no)$/i.test(v.trim())
  return dflt
}

/** Nom d'affichage : displayName, sinon name.formatted, sinon givenName + familyName. */
function pickName(r: Record<string, any>): string | null {
  if (asStr(r.displayName)) return asStr(r.displayName)
  const n = r.name
  if (n && typeof n === 'object') {
    if (asStr(n.formatted)) return asStr(n.formatted)
    const parts = [asStr(n.givenName), asStr(n.familyName)].filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
  return null
}

/** E-mail : userName (usuel), sinon emails[primary] ou premier emails[]. */
function pickEmail(r: Record<string, any>): string | null {
  const un = asStr(r.userName)
  if (un.includes('@')) return un.toLowerCase()
  if (Array.isArray(r.emails)) {
    const primary = r.emails.find((e: any) => e && e.primary && asStr(e.value))
    const any = r.emails.find((e: any) => e && asStr(e.value))
    const v = asStr((primary ?? any)?.value)
    if (v.includes('@')) return v.toLowerCase()
  }
  return null
}

/** Ressource SCIM User → champs ACRA. Null si aucun e-mail exploitable. */
export function scimUserToAcra(resource: unknown): AcraUserFields | null {
  if (!resource || typeof resource !== 'object') return null
  const r = resource as Record<string, any>
  const email = pickEmail(r)
  if (!email) return null
  return { email, name: pickName(r), active: coerceBool(r.active, true) }
}

export interface AcraUserLike { id: string; email: string; name: string | null; isActive: boolean }

/** Utilisateur ACRA → ressource SCIM User. */
export function acraUserToScim(u: AcraUserLike) {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: u.id,
    userName: u.email,
    displayName: u.name ?? undefined,
    name: u.name ? { formatted: u.name } : undefined,
    emails: [{ value: u.email, primary: true }],
    active: u.isActive,
    meta: { resourceType: 'User' },
  }
}

/** Parse un filtre SCIM `userName eq "valeur"` (seul filtre supporté) → e-mail. */
export function parseScimUserNameFilter(filter: unknown): string | null {
  if (typeof filter !== 'string') return null
  const m = filter.match(/^\s*userName\s+eq\s+"([^"]+)"\s*$/i)
  return m ? m[1].trim().toLowerCase() : null
}

export interface ScimPatchOp { op?: string; path?: string; value?: unknown }

/**
 * Applique des opérations SCIM PATCH aux champs ACRA (surtout `active` pour le
 * déprovisioning). Supporte `replace` avec path='active' ou un objet value.
 * Ops/paths inconnus ignorés (pas d'erreur).
 */
export function applyScimPatch(current: { active: boolean; name: string | null }, operations: ScimPatchOp[]): { active: boolean; name: string | null } {
  let { active, name } = current
  for (const op of operations ?? []) {
    if (asStr(op.op).toLowerCase() !== 'replace') continue
    const path = asStr(op.path).toLowerCase()
    if (path === 'active') { active = coerceBool(op.value, active) }
    else if (path === 'displayname') { name = asStr(op.value) || name }
    else if (!path && op.value && typeof op.value === 'object') {
      const v = op.value as Record<string, any>
      if ('active' in v) active = coerceBool(v.active, active)
      if (asStr(v.displayName)) name = asStr(v.displayName)
    }
  }
  return { active, name }
}

/** Enveloppe SCIM ListResponse. */
export function scimListResponse<T>(resources: T[], total?: number) {
  return {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults: total ?? resources.length,
    startIndex: 1,
    itemsPerPage: resources.length,
    Resources: resources,
  }
}

/** Enveloppe SCIM Error. */
export function scimError(status: number, detail: string) {
  return { schemas: [SCIM_ERROR_SCHEMA], status: String(status), detail }
}
