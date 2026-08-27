// ─── SCIM 2.0 — couche serveur (provisioning per-org via OrgMembership) ──────
// Un IdP (SailPoint/Azure AD/Okta) provisionne/déprovisionne les comptes d'UNE
// organisation, authentifié par une clé d'API à scope `provision`. Le compte
// ACRA (User) est partagé entre organisations ; l'appartenance à l'org passe par
// OrgMembership. Déprovisionner = retirer l'appartenance à CETTE org (et
// désactiver le compte s'il ne reste aucune appartenance).

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
 * Provisionne un compte dans l'org. Crée l'utilisateur si nécessaire, ajoute
 * l'appartenance (rôle par défaut), réactive le compte. Renvoie { resource, created }.
 * Si l'utilisateur a DÉJÀ une appartenance à cette org → conflit (created=false, existing).
 */
export async function scimProvision(orgId: string, fields: AcraUserFields): Promise<{ conflict: boolean; resource: ReturnType<typeof acraUserToScim> }> {
  const existingUser = await db.user.findUnique({ where: { email: fields.email } })
  if (existingUser) {
    const membership = await db.orgMembership.findUnique({ where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } } })
    if (membership) {
      return { conflict: true, resource: acraUserToScim({ id: existingUser.id, email: existingUser.email, name: existingUser.name, isActive: existingUser.isActive }) }
    }
    await db.orgMembership.create({ data: { userId: existingUser.id, organizationId: orgId, role: SCIM_DEFAULT_ROLE } })
    const u = await db.user.update({ where: { id: existingUser.id }, data: { isActive: true, ...(fields.name ? { name: fields.name } : {}) } })
    return { conflict: false, resource: acraUserToScim({ id: u.id, email: u.email, name: u.name, isActive: u.isActive }) }
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
  const u = await db.user.update({ where: { id }, data: { isActive: true, ...(fields.name != null ? { name: fields.name } : {}) } })
  return acraUserToScim({ id: u.id, email: u.email, name: u.name, isActive: u.isActive })
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
  const remaining = await db.orgMembership.count({ where: { userId: id } })
  if (remaining === 0) await db.user.update({ where: { id }, data: { isActive: false } }).catch(() => {})
  return true
}
