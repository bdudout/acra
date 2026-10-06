// ─── Données et services d'un projet 360 et leur criticité ───────────────────
// GET  : tableau du projet (lecture du projet).
// PUT  { actifs } : enregistre le tableau assaini (édition du projet, non gelé) — Cadrage.valeursMetier du projet.
// POST { sourceAnalyseId } : importe les valeurs métier d'une analyse cyber (filtre commun lib/projet360-sources),
//      sans écraser une ligne déjà saisie (même intitulé). Logique pure : lib/actifs-projet.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { guardDirectRisk, guardLectureProjet360 } from '@/lib/analyse-direct-risk.server'
import { sourcesCyberWhere } from '@/lib/projet360-sources.server'
import { actifsDepuisValeursMetier, fusionnerActifs, sanitizeActifsProjet, type ActifProjet } from '@/lib/actifs-projet'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

async function utilisateur() {
  const u = (await getServerSession(authOptions))?.user as { id?: string; role?: string } | undefined
  return u?.id ? { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole } : null
}
const lire = async (analyseId: string) => sanitizeActifsProjet((await prisma.cadrage.findUnique({ where: { analyseId }, select: { valeursMetier: true } }))?.valeursMetier)
const ecrire = (analyseId: string, actifs: ActifProjet[]) => prisma.cadrage.upsert({
  where: { analyseId }, update: { valeursMetier: actifs as object[] }, create: { analyseId, valeursMetier: actifs as object[] },
})

export async function GET(_req: NextRequest, { params }: Params) {
  const u = await utilisateur()
  if (!u) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const g = await guardLectureProjet360((await params).id, u.userId, u.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json({ actifs: await lire(g.analyse.id) })
}

async function edition(params: Params['params']) {
  const u = await utilisateur()
  if (!u) return { ok: false as const, res: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const g = await guardDirectRisk((await params).id, u.userId, u.role)
  if (!g.ok) return { ok: false as const, res: NextResponse.json({ error: g.error }, { status: g.status }) }
  if (g.analyse.methode !== 'PROJET_360') return { ok: false as const, res: NextResponse.json({ error: 'methode_non_360' }, { status: 400 }) }
  return { ok: true as const, u, g }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const c = await edition(params)
  if (!c.ok) return c.res
  const body = await req.json().catch(() => ({})) as { actifs?: unknown }
  const actifs = sanitizeActifsProjet(body.actifs)
  await ecrire(c.g.analyse.id, actifs)
  await auditLog('WORKSHOP_SAVED', {
    userId: c.u.userId, userRole: c.g.role, organizationId: c.g.analyse.organizationId, targetId: c.g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'actifs-projet', action: 'save', n: actifs.length },
  })
  return NextResponse.json({ actifs })
}

export async function POST(req: NextRequest, { params }: Params) {
  const c = await edition(params)
  if (!c.ok) return c.res
  const orgId = c.g.analyse.organizationId
  const body = await req.json().catch(() => ({})) as { sourceAnalyseId?: unknown }
  const sourceId = typeof body.sourceAnalyseId === 'string' ? body.sourceAnalyseId : ''
  const source = sourceId && orgId ? await prisma.analyse.findFirst({
    where: { ...(await sourcesCyberWhere(c.u.userId, c.u.role, { id: c.g.analyse.id, organizationId: orgId })), id: sourceId },
    select: { id: true, nom: true, cadrage: { select: { valeursMetier: true, evenementsRedoutes: true } } },
  }) : null
  if (!source) return NextResponse.json({ error: 'Analyse source introuvable' }, { status: 404 })
  const { actifs, ajoutes } = fusionnerActifs(await lire(c.g.analyse.id), actifsDepuisValeursMetier(source.cadrage?.valeursMetier, source.cadrage?.evenementsRedoutes, source.nom))
  if (ajoutes) await ecrire(c.g.analyse.id, actifs)
  await auditLog('WORKSHOP_SAVED', {
    userId: c.u.userId, userRole: c.g.role, organizationId: orgId, targetId: c.g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'actifs-projet', action: 'import', sourceAnalyseId: source.id, ajoutes },
  })
  return NextResponse.json({ actifs, ajoutes })
}
