// ─── Données et services d'un projet 360 et leur criticité ───────────────────
// GET  : tableau du projet (lecture du projet).
// PUT  { actifs } : enregistre le tableau assaini (édition du projet, non gelé) — Cadrage.valeursMetier du projet.
// POST { sourceAnalyseId } : importe les valeurs métier d'une analyse cyber (filtre commun lib/projet360-sources),
//      sans écraser une ligne déjà saisie (même intitulé). Logique pure : lib/actifs-projet.
// Gardes : session (withAccess, org 'none') puis gardes de lib inchangées (guardLectureProjet360 / guardDirectRisk).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { guardDirectRisk, guardLectureProjet360 } from '@/lib/analyse-direct-risk.server'
import { sourcesCyberWhere } from '@/lib/projet360-sources.server'
import { actifsDepuisValeursMetier, fusionnerActifs, sanitizeActifsProjet, type ActifProjet } from '@/lib/actifs-projet'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
const ecriture = { org: 'none', rateLimit: { bucket: 'actifs-projet' } } as const

const lire = async (analyseId: string) => sanitizeActifsProjet((await prisma.cadrage.findUnique({ where: { analyseId }, select: { valeursMetier: true } }))?.valeursMetier)
const ecrire = (analyseId: string, actifs: ActifProjet[]) => prisma.cadrage.upsert({
  where: { analyseId }, update: { valeursMetier: actifs as object[] }, create: { analyseId, valeursMetier: actifs as object[] },
})

export const GET = withAccess({ org: 'none' }, async (_req, { user, params }) => {
  const g = await guardLectureProjet360(params.id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json({ actifs: await lire(g.analyse.id) })
})

async function edition(id: string, user: SessionUser) {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return { ok: false as const, res: NextResponse.json({ error: g.error }, { status: g.status }) }
  if (g.analyse.methode !== 'PROJET_360') return { ok: false as const, res: NextResponse.json({ error: 'methode_non_360' }, { status: 400 }) }
  return { ok: true as const, g }
}

export const PUT = withAccess(ecriture, async (req, { user, params }) => {
  const c = await edition(params.id, user)
  if (!c.ok) return c.res
  const body = await req.json().catch(() => ({})) as { actifs?: unknown }
  const actifs = sanitizeActifsProjet(body.actifs)
  await ecrire(c.g.analyse.id, actifs)
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: c.g.role, organizationId: c.g.analyse.organizationId, targetId: c.g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'actifs-projet', action: 'save', n: actifs.length },
  })
  return NextResponse.json({ actifs })
})

export const POST = withAccess(ecriture, async (req, { user, params }) => {
  const c = await edition(params.id, user)
  if (!c.ok) return c.res
  const orgId = c.g.analyse.organizationId
  const body = await req.json().catch(() => ({})) as { sourceAnalyseId?: unknown }
  const sourceId = typeof body.sourceAnalyseId === 'string' ? body.sourceAnalyseId : ''
  const source = sourceId && orgId ? await prisma.analyse.findFirst({
    where: { ...(await sourcesCyberWhere(user.id, user.role, { id: c.g.analyse.id, organizationId: orgId })), id: sourceId },
    select: { id: true, nom: true, cadrage: { select: { valeursMetier: true, evenementsRedoutes: true } } },
  }) : null
  if (!source) return NextResponse.json({ error: 'Analyse source introuvable' }, { status: 404 })
  const { actifs, ajoutes } = fusionnerActifs(await lire(c.g.analyse.id), actifsDepuisValeursMetier(source.cadrage?.valeursMetier, source.cadrage?.evenementsRedoutes, source.nom))
  if (ajoutes) await ecrire(c.g.analyse.id, actifs)
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: c.g.role, organizationId: orgId, targetId: c.g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'actifs-projet', action: 'import', sourceAnalyseId: source.id, ajoutes },
  })
  return NextResponse.json({ actifs, ajoutes })
})
