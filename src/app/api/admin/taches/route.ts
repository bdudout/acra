// ─── Tâches planifiées : état, échecs, relance (super-administrateur) ───────────────────────
// Intégrité (16/10/2026) : un traitement de fond en échec est visible et relançable ; les livraisons
// webhook abandonnées peuvent être remises en file. Cf. lib/taches.server, lib/taches-registre.server.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { canAdminInstance } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { TACHES_PLANIFIEES, estTachePlanifiee, relancerTache } from '@/lib/taches-registre.server'

export const dynamic = 'force-dynamic'
const superAdmin = { org: 'none', allow: (role: Parameters<typeof canAdminInstance>[0]['role']) => canAdminInstance({ id: '', role }) } as const
const SELECT = { statut: true, declencheur: true, debut: true, fin: true, dureeMs: true, erreur: true } as const

// GET /api/admin/taches — état de chaque tâche, dernières exécutions, livraisons webhook en échec.
export const GET = withAccess(superAdmin, async () => {
  const depuis = new Date(Date.now() - 7 * 86_400_000)
  const taches = await Promise.all(TACHES_PLANIFIEES.map(async tache => {
    const [derniere, dernierSucces, echecs7j] = await Promise.all([
      prisma.executionTache.findFirst({ where: { tache }, orderBy: { debut: 'desc' }, select: SELECT }),
      prisma.executionTache.findFirst({ where: { tache, statut: 'OK' }, orderBy: { debut: 'desc' }, select: { debut: true } }),
      prisma.executionTache.count({ where: { tache, statut: 'ECHEC', debut: { gte: depuis } } }),
    ])
    return { tache, derniere, dernierSucces: dernierSucces?.debut ?? null, echecs7j }
  }))
  const [executions, enEchec, enAttente] = await Promise.all([
    prisma.executionTache.findMany({ orderBy: { debut: 'desc' }, take: 50, select: { id: true, tache: true, ...SELECT } }),
    prisma.webhookDelivery.count({ where: { statut: 'ECHEC' } }),
    prisma.webhookDelivery.count({ where: { statut: 'EN_ATTENTE' } }),
  ])
  return NextResponse.json({ taches, executions, webhooks: { enEchec, enAttente }, cronConfigure: Boolean(process.env.CRON_SECRET) })
})

const action = z.union([
  z.object({ action: z.literal('relancer'), tache: z.string().max(60) }),
  z.object({ action: z.literal('relancer-webhooks') }),
])

// POST /api/admin/taches — { action: 'relancer', tache } | { action: 'relancer-webhooks' }
export const POST = withAccess({ ...superAdmin, rateLimit: { bucket: 'admin-taches', limit: 20, windowMs: 60_000 }, body: action }, async (req, { user, body }) => {
  if (body.action === 'relancer-webhooks') {
    const { count } = await prisma.webhookDelivery.updateMany({ where: { statut: 'ECHEC' }, data: { statut: 'EN_ATTENTE', tentatives: 0, prochaineTentative: new Date() } })
    await auditLog('TACHE_PLANIFIEE_RELANCEE', { userId: user.id, userRole: user.role, ip: getClientIp(req), targetType: 'tache', targetId: 'webhooks', details: { remis: count } })
    return NextResponse.json({ ok: true, remis: count })
  }
  if (!estTachePlanifiee(body.tache)) return NextResponse.json({ error: 'tache_inconnue' }, { status: 400 })
  await auditLog('TACHE_PLANIFIEE_RELANCEE', { userId: user.id, userRole: user.role, ip: getClientIp(req), targetType: 'tache', targetId: body.tache, details: { tache: body.tache } })
  const res = await relancerTache(body.tache)
  const resultat = await res.json().catch(() => null)
  return NextResponse.json({ ok: res.ok, statut: res.status, resultat }, { status: res.ok ? 200 : 502 })
})
