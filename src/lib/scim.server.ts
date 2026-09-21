// ─── SCIM 2.0 — couche serveur (provisioning per-org via OrgMembership) ──────
// Un IdP (SailPoint/Azure AD/Okta) provisionne/déprovisionne les comptes d'UNE
// organisation, authentifié par une clé d'API à scope `provision`. Le compte
// ACRA (User) est partagé entre organisations ; l'appartenance à l'org passe par
// OrgMembership. Déprovisionner = retirer l'appartenance à CETTE org SANS toucher
// à l'identité globale (F02) : une clé d'org ne suspend ni ne réactive un compte
// d'instance, et n'écrase pas son profil global.

import { prisma } from '@/lib/prisma'
import { acraUserToScim, type AcraUserFields } from '@/lib/scim'

/** Rôle par défaut des comptes provisionnés par SCIM (moindre privilège). */
export const SCIM_DEFAULT_ROLE = 'LECTEUR'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/** Un utilisateur (avec appartenance à l'org) → ressource SCIM, ou null. */
export async function scimGetById(orgId: string, id: string) {
  const m = await db.orgMembership.findFirst({ where: { organizationId: orgId, userId: id }, include: { user: true } })
  if (!m) return null
  return acraUserToScim({ id: m.user.id, email: m.user.email, name: m.user.name, isActive: m.user.isActive })
}

/** Recherche par e-mail (filtre userName eq) dans l'org. */
export async function scimFindByEmail(orgId: string, email: string) {
  const m = await db.orgMembership.findFirst({ where: { organizationId: orgId, user: { email } }, include: { user: true } })
  if (!m) return null
  return acraUserToScim({ id: m.user.id, email: m.user.email, name: m.user.name, isActive: m.user.isActive })
}

/**
 * Provisionne un compte dans l'org. Crée l'utilisateur s'il n'existe pas encore
 * (identité alors née de cette org). S'il EXISTE déjà (compte global partagé),
 * on ajoute seulement l'appartenance — sans modifier son identité globale (F02).
 * Renvoie { conflict, resource }. Appartenance déjà présente → conflit.
 */
export async function scimProvision(orgId: string, fields: AcraUserFields): Promise<{ conflict: boolean; resource: ReturnType<typeof acraUserToScim> }> {
  const existingUser = await db.user.findUnique({ where: { email: fields.email } })
  if (existingUser) {
    const membership = await db.orgMembership.findUnique({ where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } } })
    if (membership) {
      return { conflict: true, resource: acraUserToScim({ id: existingUser.id, email: existingUser.email, name: existingUser.name, isActive: existingUser.isActive }) }
    }
    // F02 (CWE-863) : une clé limitée à UNE organisation ne doit PAS écrire sur
    // l'identité GLOBALE d'un compte pré-existant, partagé entre organisations.
    // On ajoute seulement l'appartenance à cette org ; on ne lève PAS une éventuelle
    // suspension d'instance (isActive) et on n'écrase PAS le profil (name). La levée
    // d'une suspension d'instance relève d'un administrateur d'instance, hors SCIM.
    await db.orgMembership.create({ data: { userId: existingUser.id, organizationId: orgId, role: SCIM_DEFAULT_ROLE } })
    return { conflict: false, resource: acraUserToScim({ id: existingUser.id, email: existingUser.email, name: existingUser.name, isActive: existingUser.isActive }) }
  }
  const user = await db.user.create({
    data: { email: fields.email, name: fields.name, isActive: fields.active, role: SCIM_DEFAULT_ROLE, memberships: { create: { organizationId: orgId, role: SCIM_DEFAULT_ROLE } } },
  })
  return { conflict: false, resource: acraUserToScim({ id: user.id, email: user.email, name: user.name, isActive: user.isActive }) }
}

/** Met à jour un compte de l'org (nom, active). active=false → déprovisionne. */
export async function scimUpdate(orgId: string, id: string, fields: { active: boolean; name: string | null }) {
  const m = await db.orgMembership.findFirst({ where: { organizationId: orgId, userId: id }, include: { user: true } })
  if (!m) return null
  if (!fields.active) { await scimDeprovision(orgId, id); return acraUserToScim({ id, email: m.user.email, name: m.user.name, isActive: false }) }
  // F02 (CWE-863) : active=true garantit l'APPARTENANCE à l'org (déjà présente ici),
  // mais ne modifie PAS l'identité globale — pas de levée de suspension d'instance
  // ni d'écrasement du profil depuis une clé d'org. No-op au niveau global.
  return acraUserToScim({ id: m.user.id, email: m.user.email, name: m.user.name, isActive: m.user.isActive })
}

/**
 * Déprovisionne : retire l'appartenance à CETTE org. Si c'était la dernière,
 * désactive le compte globalement. Renvoie false si l'utilisateur n'était pas
 * dans l'org.
 */
export async function scimDeprovision(orgId: string, id: string): Promise<boolean> {
  const m = await db.orgMembership.findFirst({ where: { organizationId: orgId, userId: id } })
  if (!m) return false
  await db.orgMembership.delete({ where: { userId_organizationId: { userId: id, organizationId: orgId } } })
  // F02 (CWE-863) : retirer l'appartenance à CETTE org ne doit PAS suspendre
  // l'identité GLOBALE (qui peut être utilisée hors SCIM / par un admin d'instance).
  // La suspension d'instance reste une décision d'administrateur d'instance.
  return true
}
