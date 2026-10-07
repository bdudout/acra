// ─── Registre des systèmes d'IA de l'organisation active ──────────────────────
// GET  — systèmes avec classe indicative (règlement (UE) 2024/1689, à vérifier), revue en retard et champs à compléter,
//        synthèse, analyses liables (lecture : gouvernance, contrôle, audit). POST — créer un système (gouvernance).
//        Module registreIaActive requis.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { analysesLiables, iaContext } from '@/lib/registre-ia.server'
import { champsManquantsIa, classeIndicative, revueEnRetard, sanitizeSystemeIa } from '@/lib/registre-ia'

export const dynamic = 'force-dynamic'

export async function GET() {
  const got = await iaContext(); if ('error' in got) return got.error
  const { ctx } = got
  const [rows, analyses] = await Promise.all([
    prisma.systemeIA.findMany({ where: { organizationId: ctx.orgId }, orderBy: [{ nom: 'asc' }] }),
    analysesLiables(ctx),
  ])
  const now = new Date()
  const systemes = rows.map(r => {
    const s = sanitizeSystemeIa(r)
    return { ...r, classe: classeIndicative(s.usage, s.typeDecision), revueEnRetard: revueEnRetard(r.derniereRevue, now, s.statut), manquants: champsManquantsIa(s) }
  })
  const actifs = systemes.filter(s => s.statut !== 'RETIRE')
  return NextResponse.json({
    canManage: ctx.canManage, systemes, analyses,
    synthese: { total: systemes.length, hautRisque: actifs.filter(s => s.classe === 'HAUT_RISQUE_PROBABLE').length, revuesEnRetard: actifs.filter(s => s.revueEnRetard).length, aCompleter: systemes.filter(s => s.manquants.length).length },
  })
}

export async function POST(req: NextRequest) {
  const got = await iaContext({ ecriture: true }); if ('error' in got) return got.error
  const { ctx } = got
  const s = sanitizeSystemeIa(await req.json().catch(() => ({})))
  if (!s.nom) return NextResponse.json({ error: 'nom_requis' }, { status: 400 })
  if (s.analyseId && !(await analysesLiables(ctx)).some(a => a.id === s.analyseId)) return NextResponse.json({ error: 'analyse_inconnue' }, { status: 400 })
  const created = await prisma.systemeIA.create({ data: { ...s, organizationId: ctx.orgId, createdBy: ctx.userId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'registre-ia', action: 'create', id: created.id } })
  return NextResponse.json(created, { status: 201 })
}
