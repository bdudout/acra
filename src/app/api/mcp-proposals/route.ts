// ─── File de propositions MCP (lecture) ──────────────────────────────────────
// Liste les propositions EN_ATTENTE de l'organisation active, pour la file de
// validation UI. Org-scopé : un utilisateur ne voit que les propositions de son
// organisation active. L'acceptation/rejet passe par PATCH /api/mcp-proposals/[id]
// (garde RBAC sur l'analyse cible).

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import type { UserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

// GET /api/mcp-proposals — propositions EN_ATTENTE de l'organisation active.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ proposals: [] })

  const rows = await prisma.mcpProposal.findMany({
    where: { organizationId: orgId, statut: 'EN_ATTENTE' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, type: true, analyseId: true, payload: true, createdAt: true, apiKeyId: true },
  })

  // Enrichit avec le nom de l'analyse cible (org-scopé), sans exposer d'autres orgs.
  const analyseIds = [...new Set(rows.map(r => r.analyseId).filter((v): v is string => !!v))]
  const analyses = analyseIds.length
    ? await prisma.analyse.findMany({
        where: { id: { in: analyseIds }, organizationId: orgId },
        select: { id: true, nom: true },
      })
    : []
  const nomById = new Map(analyses.map(a => [a.id, a.nom]))

  const proposals = rows.map(r => ({
    id: r.id, type: r.type, analyseId: r.analyseId,
    analyseNom: r.analyseId ? (nomById.get(r.analyseId) ?? null) : null,
    payload: r.payload, createdAt: r.createdAt,
  }))
  return NextResponse.json({ proposals })
}
