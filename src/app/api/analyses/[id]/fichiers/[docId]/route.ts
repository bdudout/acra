// ─── Un fichier d'un projet 360 : téléchargement (lecture du projet), suppression (édition) ─
// Le fichier doit appartenir au projet ciblé (sinon 404, sans divulgation).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { guardDirectRisk, guardLectureProjet360 } from '@/lib/analyse-direct-risk.server'
import { sanitizeFilename } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; docId: string }> }

async function utilisateur() {
  const u = (await getServerSession(authOptions))?.user as { id?: string; role?: string } | undefined
  return u?.id ? { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole } : null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const u = await utilisateur()
  if (!u) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, docId } = await params
  const g = await guardLectureProjet360(id, u.userId, u.role)
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
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const u = await utilisateur()
  if (!u) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, docId } = await params
  const g = await guardDirectRisk(id, u.userId, u.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const doc = g.analyse.organizationId ? await prisma.document.findFirst({ where: { id: docId, organizationId: g.analyse.organizationId, analyseId: g.analyse.id }, select: { id: true, storageKey: true } }) : null
  if (!doc) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  await prisma.document.delete({ where: { id: doc.id } })
  await (await getDocumentStorage()).delete(doc.storageKey).catch(() => {}) // blob best-effort (la métadonnée fait foi)
  await auditLog('WORKSHOP_SAVED', {
    userId: u.userId, userRole: g.role, organizationId: g.analyse.organizationId, targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'fichier-projet', action: 'delete', id: doc.id },
  })
  return NextResponse.json({ ok: true })
}
