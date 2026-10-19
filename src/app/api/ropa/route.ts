import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canCreateAnalyse, canManageRopa } from '@/lib/permissions'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { optionsStructure } from '@/lib/org-config.server'
import { alerteAipd, type StatutAipd } from '@/lib/ropa-aipd'
import { sanitizeTraitement, evaluerTraitement } from '@/lib/ropa'
import { sanitizeDateRevue } from '@/lib/revues'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// GET /api/ropa — registre des traitements de l'org active + évaluation (art. 30 / PIA).
// Sans organisation active : registre vide (pas d'erreur) → session seule, org active résolue ici.
export async function GET() {
  const g = await requireSession()
  if (g.error) return g.error
  const { role: userRole, activeOrgId: orgId } = await getAnalyseScope(g.user.id, g.user.role)
  if (!orgId) return NextResponse.json({ traitements: [], canManage: false })
  if (!canManageRopa(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const rows = await prisma.traitement.findMany({ where: { organizationId: orgId }, orderBy: [{ createdAt: 'desc' }], include: { aipdAnalyse: { select: { id: true, nom: true } } } })
  const traitements = rows.map(r => {
    const evaluation = evaluerTraitement(sanitizeTraitement(r))
    // Suivi de l'AIPD (art. 35-36) : point d'attention du DPO (AIPD requise non engagée, AIPD écartée sans justification).
    return { ...r, evaluation: { ...evaluation, alerteAipd: alerteAipd(evaluation.pia.niveau, r as { aipdStatut: StatutAipd | null; aipdJustification: string }) } }
  })
  const synthese = {
    total: traitements.length,
    complets: traitements.filter(t => t.evaluation.complet).length,
    piaRequis: traitements.filter(t => t.evaluation.pia.requis).length,
    aipdALancer: traitements.filter(t => t.evaluation.alerteAipd === 'A_LANCER').length,
  }
  // Créer l'analyse d'une AIPD : proposé aux seuls rôles qui peuvent créer une analyse (le DPO, en lecture, rattache).
  const peutCreerAnalyse = canCreateAnalyse({ id: '', role: userRole }, await optionsStructure(orgId))
  return NextResponse.json({ traitements, synthese, canManage: true, peutCreerAnalyse })
}

// POST /api/ropa — créer un traitement (DPO / ADMIN).
export const POST = withAccess({ org: 'active', allow: canManageRopa, rateLimit: { bucket: 'ropa' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const body = await req.json().catch(() => ({}))
  const t = sanitizeTraitement(body)
  if (!t.nom.trim()) return NextResponse.json({ error: 'nom_requis' }, { status: 400 })

  const { id: _drop, ...data } = t
  const derniereRevue = sanitizeDateRevue((body as { derniereRevue?: unknown }).derniereRevue, new Date())
  const created = await db.traitement.create({ data: { ...data, organizationId: orgId, createdBy: userId, ...(derniereRevue ? { derniereRevue } : {}) } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'ropa', action: 'create', id: created.id },
  })
  return NextResponse.json(created, { status: 201 })
})
