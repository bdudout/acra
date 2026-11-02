// ─── Points d'accès d'un usage de service TIC (URL, hôte, type, environnement, authentification) ──────────────────────
// Cartographie déclarative : ACRA ne contacte JAMAIS ces adresses (aucun appel sortant, pas de risque SSRF). Les
// identifiants intégrés à une URL sont refusés (aucun secret dans le registre) ; seuls des schémas passifs sont admis.
// L'hôte normalisé sert au repérage des concentrations (plusieurs usages sur le même hôte). Testé : tier-endpoints.test.ts.

export const TYPES_POINT_ACCES = ['WEB', 'API', 'SFTP', 'TENANT_SAAS', 'VPN', 'AUTRE'] as const
export const ENVIRONNEMENTS = ['PRODUCTION', 'RECETTE', 'AUTRE'] as const
export const AUTHENTIFICATIONS = ['SSO', 'MFA', 'LOCALE', 'CERTIFICAT', 'CLE_API', 'AUCUNE'] as const
export type TypePointAcces = typeof TYPES_POINT_ACCES[number]
export type Environnement = typeof ENVIRONNEMENTS[number]
export type Authentification = typeof AUTHENTIFICATIONS[number]

const SCHEMAS = new Set(['http:', 'https:', 'sftp:', 'ftps:', 'ftp:', 'ssh:', 'wss:', 'ws:', 'ldaps:', 'smtps:'])
export const MAX_ADRESSE = 2048
export const MAX_COMMENTAIRE = 1000

type ErreurAdresse = 'adresse_requise' | 'adresse_invalide' | 'identifiants_interdits'
/** Normalise une adresse : URL à schéma passif, ou nom d'hôte / IP avec port facultatif. Fragment retiré. */
export function normaliserAdresse(raw: unknown): { ok: true; adresse: string; hote: string } | { ok: false; error: ErreurAdresse } {
  const brut = typeof raw === 'string' ? raw.trim() : ''
  if (!brut) return { ok: false, error: 'adresse_requise' }
  if (brut.length > MAX_ADRESSE || /\s/.test(brut)) return { ok: false, error: 'adresse_invalide' }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) || /^(javascript|data|vbscript|file):/i.test(brut)) {
    let u: URL
    try { u = new URL(brut) } catch { return { ok: false, error: 'adresse_invalide' } }
    if (!SCHEMAS.has(u.protocol) || !u.hostname) return { ok: false, error: 'adresse_invalide' }
    if (u.username || u.password) return { ok: false, error: 'identifiants_interdits' }
    u.hash = ''
    return { ok: true, adresse: u.toString().replace(/\/$/, u.pathname === '/' && !u.search ? '' : '/'), hote: u.hostname.toLowerCase() }
  }
  // Hôte seul (nom DNS ou IPv4), port facultatif.
  const m = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*)(:(\d{1,5}))?$/i.exec(brut)
  if (!m || (m[6] && Number(m[6]) > 65535)) return { ok: false, error: 'adresse_invalide' }
  return { ok: true, adresse: brut.toLowerCase(), hote: m[1].toLowerCase() }
}

export interface PointAccesSaisi {
  adresse: string; hote: string; type: TypePointAcces; environnement: Environnement | null; authentification: Authentification | null; commentaire: string | null
}
type ErreurPoint = ErreurAdresse | 'type_invalide' | 'environnement_invalide' | 'authentification_invalide' | 'commentaire_trop_long'
const parmi = <T extends string>(liste: readonly T[], v: unknown): T | null | undefined =>
  v === undefined || v === null || v === '' ? null : (liste as readonly unknown[]).includes(v) ? (v as T) : undefined

/** Lit un point d'accès complet (création ou remplacement) ; toute valeur inconnue est refusée. */
export function lirePointAcces(body: Record<string, unknown>): { ok: true; data: PointAccesSaisi } | { ok: false; error: ErreurPoint } {
  const a = normaliserAdresse(body.adresse); if (!a.ok) return a
  const type = parmi(TYPES_POINT_ACCES, body.type)
  if (!type) return { ok: false, error: 'type_invalide' }
  const environnement = parmi(ENVIRONNEMENTS, body.environnement); if (environnement === undefined) return { ok: false, error: 'environnement_invalide' }
  const authentification = parmi(AUTHENTIFICATIONS, body.authentification); if (authentification === undefined) return { ok: false, error: 'authentification_invalide' }
  const commentaire = typeof body.commentaire === 'string' && body.commentaire.trim() ? body.commentaire.trim() : null
  if (commentaire && commentaire.length > MAX_COMMENTAIRE) return { ok: false, error: 'commentaire_trop_long' }
  return { ok: true, data: { adresse: a.adresse, hote: a.hote, type, environnement, authentification, commentaire } }
}
