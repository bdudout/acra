// ─── Activité MCP de l'organisation active (administrateur) ───────────────────
// Clés d'API au scope `mcp` et leur état, appels d'outils journalisés sur 30 jours (MCP_TOOL_INVOKED), propositions
// déposées par clé, et état des interrupteurs (instance, organisation). Lecture seule ; la révocation passe par
// DELETE /api/config/api-keys/[id]. Synthèse : lib/mcp/activity.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { isMcpEnabled } from '@/lib/interfaces-config.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { parseAppelMcp, syntheseActiviteMcp, type AppelMcp } from '@/lib/mcp/activity'

export const dynamic = 'force-dynamic'
const JOURS = 30
/** Plafond de lignes de journal lues (garde-fou ; au-delà, les plus anciennes de la fenêtre sont ignorées). */
const MAX_APPELS = 50_000

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const user = session.user as { id: string; role?: string }
  const scope = await getAnalyseScope(user.id, (user.role ?? 'ANALYSTE') as UserRole)
  if (!isAdminRole(scope.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })

  const maintenant = new Date()
  const [cles, journal, propositions, instanceActive, cfg] = await Promise.all([
    prisma.apiKey.findMany({
      where: { organizationId: orgId }, orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId, action: 'MCP_TOOL_INVOKED', createdAt: { gte: new Date(maintenant.getTime() - JOURS * 86_400_000) } },
      orderBy: { createdAt: 'desc' }, take: MAX_APPELS, select: { details: true, createdAt: true },
    }),
    prisma.mcpProposal.findMany({ where: { organizationId: orgId }, select: { apiKeyId: true, statut: true } }),
    isMcpEnabled(),
    getOrgConfig(orgId),
  ])
  const appels = journal.map(l => parseAppelMcp(l.details, l.createdAt)).filter((a): a is AppelMcp => a !== null)
  return NextResponse.json({
    instanceActive, orgActive: cfg.mcpActive, jours: JOURS,
    ...syntheseActiviteMcp({ cles, appels, propositions, maintenant, jours: JOURS }),
  })
}
