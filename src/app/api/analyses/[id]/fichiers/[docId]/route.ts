// ─── Un fichier d'un projet 360 : téléchargement (lecture du projet), suppression (édition) ─
// Le fichier doit appartenir au projet ciblé (sinon 404, sans divulgation).
// Session (et rate limit en écriture) : withAccess (org 'none') ; gardes de lib inchangées.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { guardDirectRisk, guardLectureProjet360 } from '@/lib/analyse-direct-risk.server'
import { sanitizeFilename } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id, docId } }) => {
  const g = await guardLectureProjet360(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const doc = g.analyse.organizationId ? await prisma.document.findFirst({ where: { id: docId, organizationId: g.analyse.organizationId, analyseId: g.analyse.id } }) : null
  if (!doc) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  let bytes: Buffer
  try { bytes = await (await getDocumentStorage()).get(doc.storageKey) } catch { return NextResponse.json({ error: 'fichier_absent' }, { status: 410 }) }
  return new NextResponse(bytes as unknown as ArrayBuffer, {
    headers: {
      'Content-Type': doc.mime,
      'Content-Disposition': `attachment; filename="${sanitizeFilename(doc.fichierNom)}"`,
      'Content-Length': String(doc.taille),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  })
})

export const DELETE = withAccess({ org: 'none', rateLimit: { bucket: 'fichiers-projet' } }, async (req, { user, params: { id, docId } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const doc = g.analyse.organizationId ? await prisma.document.findFirst({ where: { id: docId, organizationId: g.analyse.organizationId, analyseId: g.analyse.id }, select: { id: true, storageKey: true } }) : null
  if (!doc) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  await prisma.document.delete({ where: { id: doc.id } })
  await (await getDocumentStorage()).delete(doc.storageKey).catch(() => {}) // blob best-effort (la métadonnée fait foi)
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: g.role, organizationId: g.analyse.organizationId, targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'fichier-projet', action: 'delete', id: doc.id },
  })
  return NextResponse.json({ ok: true })
})
