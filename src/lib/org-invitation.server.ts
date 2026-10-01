// ─── Rattachement d'un compte à une organisation : direct ou par invitation (T23) ──
// Couche serveur de lib/membership-mode.ts. Point UNIQUE de création d'une invitation,
// de son aperçu et de son acceptation (compte existant ou nouveau compte).

import bcrypt from 'bcryptjs'
import type { OrgScope, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isSignupOpen } from '@/lib/demo-server'
import { sendEmail } from '@/lib/email'
import { orgInvitationEmail, memberAddedEmail } from '@/lib/email-i18n'
import { auditLog } from '@/lib/logger'
import { loadPasswordPolicy } from '@/lib/password-policy.server'
import { validatePassword } from '@/lib/password-policy'
import {
  resolveMembershipMode, newInvitationToken, hashInvitationToken, invitationState, invitationMatchesEmail,
  INVITATION_TTL_DAYS, type MembershipMode,
} from '@/lib/membership-mode'

/** Mode effectif de l'instance (réglage SUPER_ADMIN, sinon déduit de l'ouverture de l'instance). */
export async function getMembershipMode(): Promise<{ mode: MembershipMode; notify: boolean }> {
  const [cfg, open] = await Promise.all([
    prisma.configuration.findUnique({ where: { id: 'global' }, select: { membershipMode: true, membershipNotify: true } }).catch(() => null),
    isSignupOpen(),
  ])
  return { mode: resolveMembershipMode(cfg?.membershipMode, open), notify: cfg?.membershipNotify !== false }
}

/** URL absolue de l'application, tirée de NEXTAUTH_URL (jamais de l'en-tête Host : injection d'hôte). */
export function appUrl(path: string): string | null {
  const raw = process.env.NEXTAUTH_URL
  if (!raw) return null
  try {
    const origin = new URL(raw)
    if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') return null
    return new URL(path, origin).toString()
  } catch { return null }
}

/**
 * Crée une invitation (et remplace une invitation en attente pour le même e-mail et la
 * même organisation), puis l'envoie. Ne révèle JAMAIS si un compte existe pour l'e-mail.
 */
export async function inviteToOrganization(input: {
  organizationId: string; email: string; role: UserRole; scope: OrgScope; invitedById: string; locale?: string | null
}): Promise<{ emailed: boolean }> {
  const email = input.email.trim().toLowerCase()
  const { token, tokenHash } = newInvitationToken()
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 3600 * 1000)
  const [org, recipient] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { nom: true } }),
    prisma.user.findUnique({ where: { email }, select: { locale: true } }),
  ])
  await prisma.$transaction([
    prisma.orgInvitation.deleteMany({ where: { organizationId: input.organizationId, email, acceptedAt: null } }),
    prisma.orgInvitation.create({ data: { organizationId: input.organizationId, email, role: input.role, scope: input.scope, tokenHash, invitedById: input.invitedById, expiresAt } }),
  ])
  const url = appUrl(`/invitations/${encodeURIComponent(token)}`)
  if (!url) return { emailed: false }
  const mail = orgInvitationEmail(recipient?.locale ?? input.locale, { orgNom: org.nom, url, days: INVITATION_TTL_DAYS })
  const sent = await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
  return { emailed: sent.ok }
}

/** E-mail d'information après un rattachement DIRECT (best-effort). */
export async function notifyMemberAdded(userId: string, organizationId: string): Promise<void> {
  try {
    const [user, org] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { nom: true } }),
    ])
    const url = appUrl('/dashboard')
    if (!user || !org || !url) return
    const mail = memberAddedEmail(user.locale, { orgNom: org.nom, url })
    await sendEmail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html })
  } catch { /* information best-effort : n'empêche jamais le rattachement */ }
}

export type InvitationPreview =
  | { state: 'NOT_FOUND' }
  | { state: 'EXPIRED' | 'USED' }
  | { state: 'VALID'; orgNom: string; email: string; role: UserRole; accountExists: boolean }

/** Aperçu d'une invitation pour la page d'acceptation (le jeton prouve la détention de l'e-mail). */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const inv = await prisma.orgInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: { email: true, role: true, expiresAt: true, acceptedAt: true, organization: { select: { nom: true } } },
  })
  if (!inv) return { state: 'NOT_FOUND' }
  const state = invitationState(inv)
  if (state !== 'VALID') return { state }
  const accountExists = !!(await prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } }))
  return { state: 'VALID', orgNom: inv.organization.nom, email: inv.email, role: inv.role, accountExists }
}

export type AcceptResult =
  | { ok: true; organizationId: string }
  | { ok: false; status: 400 | 403 | 404 | 409 | 410; code: 'NOT_FOUND' | 'EXPIRED' | 'USED' | 'EMAIL_MISMATCH' | 'LOGIN_REQUIRED' | 'ACCOUNT_EXISTS' | 'PASSWORD_POLICY' | 'NAME_REQUIRED' }

/**
 * Accepte une invitation. Utilisateur connecté : son e-mail doit être celui de
 * l'invitation. Sans session : création d'un compte UNIQUEMENT si aucun compte
 * n'existe pour cet e-mail (le lien prouve la détention de l'adresse) ; sinon il
 * faut se connecter. Usage unique garanti par une écriture conditionnelle atomique.
 */
export async function acceptInvitation(token: string, actor: { userId: string; email: string | null } | null, newAccount?: { name: string; password: string }, ip?: string): Promise<AcceptResult> {
  const inv = await prisma.orgInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) } })
  if (!inv) return { ok: false, status: 404, code: 'NOT_FOUND' }
  const state = invitationState(inv)
  if (state === 'EXPIRED') return { ok: false, status: 410, code: 'EXPIRED' }
  if (state === 'USED') return { ok: false, status: 409, code: 'USED' }

  let userId: string
  let created = false
  if (actor) {
    if (!invitationMatchesEmail(inv.email, actor.email)) return { ok: false, status: 403, code: 'EMAIL_MISMATCH' }
    userId = actor.userId
  } else {
    const existing = await prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } })
    if (existing) return { ok: false, status: 409, code: 'LOGIN_REQUIRED' }
    if (!newAccount) return { ok: false, status: 400, code: 'NAME_REQUIRED' }
    const name = newAccount.name.trim().slice(0, 100)
    if (name.length < 2) return { ok: false, status: 400, code: 'NAME_REQUIRED' }
    if (validatePassword(newAccount.password, await loadPasswordPolicy()).length > 0) return { ok: false, status: 400, code: 'PASSWORD_POLICY' }
    const passwordHash = await bcrypt.hash(newAccount.password, 12)
    try {
      const user = await prisma.user.create({ data: { email: inv.email, name, passwordHash, role: 'ANALYSTE', emailVerified: new Date() }, select: { id: true } })
      userId = user.id
      created = true
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return { ok: false, status: 409, code: 'ACCOUNT_EXISTS' }
      throw e
    }
  }

  const accepted = await prisma.$transaction(async tx => {
    const claim = await tx.orgInvitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date(), acceptedById: userId } })
    if (claim.count !== 1) return false
    await tx.orgMembership.upsert({
      where: { userId_organizationId: { userId, organizationId: inv.organizationId } },
      create: { userId, organizationId: inv.organizationId, role: inv.role, scope: inv.scope },
      update: { role: inv.role, scope: inv.scope },
    })
    return true
  })
  if (!accepted) return { ok: false, status: 409, code: 'USED' }
  await auditLog('ORG_MEMBER_ADDED', {
    userId, targetId: inv.organizationId, targetType: 'organization', organizationId: inv.organizationId, ip,
    details: { via: 'invitation', invitationId: inv.id, invitedById: inv.invitedById, role: inv.role, scope: inv.scope, accountCreated: created },
  })
  return { ok: true, organizationId: inv.organizationId }
}
