import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { OPERATIONAL_PROFILE_CATALOGS, sanitizeOperationalProfileEntries, type OperationalProfileFramework } from '@/lib/operational-profiles'
import { auditLog, getClientIp } from '@/lib/logger'

const PREFIX = 'OP_PROFILE:'
const isFramework = (value: unknown): value is OperationalProfileFramework => value === 'NIST_CSF_2_0' || value === 'NCSC_CAF_V4'
const canManage = (role: UserRole | null) => !!role && (isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'CONFORMITE')

/** Transforme un écart de profil en action unifiée, traçable au point source. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (!canManage(scope.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!(await getOrgConfig(scope.activeOrgId)).profilsOperationnelsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { framework?: unknown; ref?: unknown; titre?: unknown; description?: unknown; responsable?: unknown }
  if (!isFramework(body.framework) || typeof body.ref !== 'string') return NextResponse.json({ error: 'Point de profil invalide' }, { status: 400 })
  const item = OPERATIONAL_PROFILE_CATALOGS[body.framework].items.find(value => value.ref === body.ref)
  if (!item) return NextResponse.json({ error: 'Point de profil invalide' }, { status: 400 })
  const profile = await prisma.conformite.findUnique({ where: { organizationId_referentiel_entite: { organizationId: scope.activeOrgId, referentiel: `${PREFIX}${body.framework}`, entite: '' } }, select: { id: true, entries: true } })
  const entry = sanitizeOperationalProfileEntries(body.framework, profile?.entries).find(value => value.ref === item.ref)
  if (!entry || !['PARTIEL', 'NON_COUVERT'].includes(entry.statut)) return NextResponse.json({ error: 'Ce point ne présente pas un écart actionnable' }, { status: 400 })
  const titre = typeof body.titre === 'string' && body.titre.trim() ? body.titre.trim().slice(0, 200) : `${body.framework === 'NIST_CSF_2_0' ? 'NIST CSF' : 'NCSC CAF'} ${item.ref} — combler l’écart`
  const action = await prisma.planAction.create({ data: { organizationId: scope.activeOrgId, titre, description: typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : entry.commentaire, porteur: typeof body.responsable === 'string' ? body.responsable.trim().slice(0, 120) : entry.responsable, createdById: userId, liens: { create: { type: 'OPERATIONAL_PROFILE', targetId: profile?.id ?? `${PREFIX}${body.framework}`, ref: item.ref, label: `${body.framework} ${item.ref}` } } } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole: scope.role ?? 'LECTEUR', ip: getClientIp(req), details: { scope: 'operational-profile', action: 'promote', framework: body.framework, ref: item.ref, planActionId: action.id } })
  return NextResponse.json(action, { status: 201 })
}
