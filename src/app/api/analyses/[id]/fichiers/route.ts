// ─── Fichiers d'un projet 360 (schémas, documents d'architecture, documents projet) ─
// GET  : liste des fichiers du projet (lecture du projet).
// POST : dépôt multipart { file, type?, titre? } (édition du projet, non gelé) — mêmes contrôles que la GED (taille,
//        MIME autorisé, signature du contenu) ; rattaché à l'analyse (Document.analyseId), hors bibliothèque documentaire.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID, createHash } from 'node:crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { guardDirectRisk, guardLectureProjet360 } from '@/lib/analyse-direct-risk.server'
import { mimeAutorise, contentMatchesMime, storageKeyFor, sanitizeFilename, MAX_DOCUMENT_SIZE } from '@/lib/document'
import { nettoyerFichierProjet } from '@/lib/fichiers-projet'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

const FICHIER_SELECT = { id: true, titre: true, type: true, fichierNom: true, mime: true, taille: true, createdAt: true } as const

async function utilisateur() {
  const u = (await getServerSession(authOptions))?.user as { id?: string; role?: string } | undefined
  return u?.id ? { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole } : null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const u = await utilisateur()
  if (!u) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const g = await guardLectureProjet360((await params).id, u.userId, u.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!g.analyse.organizationId) return NextResponse.json({ fichiers: [] })
  const fichiers = await prisma.document.findMany({ where: { organizationId: g.analyse.organizationId, analyseId: g.analyse.id }, select: FICHIER_SELECT, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ fichiers })
}

export async function POST(req: NextRequest, { params }: Params) {
  const u = await utilisateur()
  if (!u) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const g = await guardDirectRisk((await params).id, u.userId, u.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const orgId = g.analyse.organizationId
  if (g.analyse.methode !== 'PROJET_360' || !orgId) return NextResponse.json({ error: 'methode_non_360' }, { status: 400 })
  const rl = await rateLimit(`fichiers-projet:${u.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'fichier_requis' }, { status: 400 })
  if (file.size > MAX_DOCUMENT_SIZE) return NextResponse.json({ error: 'fichier_trop_gros' }, { status: 400 })
  if (!mimeAutorise(file.type)) return NextResponse.json({ error: 'mime_interdit' }, { status: 400 })
  const bytes = Buffer.from(await file.arrayBuffer())
  if (!contentMatchesMime(file.type, bytes.subarray(0, 1024))) return NextResponse.json({ error: 'mime_interdit' }, { status: 400 })

  const nom = sanitizeFilename(file.name)
  const meta = nettoyerFichierProjet({ type: form?.get('type'), titre: form?.get('titre') }, nom)
  const id = randomUUID()
  const storageKey = storageKeyFor(orgId, id, file.name)
  await (await getDocumentStorage()).put(storageKey, bytes, file.type)
  const fichier = await prisma.document.create({
    data: {
      id, organizationId: orgId, analyseId: g.analyse.id, uploadedBy: u.userId, portee: 'PROJET', type: meta.type, titre: meta.titre,
      fichierNom: nom, mime: file.type, taille: file.size, checksum: createHash('sha256').update(bytes).digest('hex'), storageKey,
    },
    select: FICHIER_SELECT,
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: u.userId, userRole: g.role, organizationId: orgId, targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'fichier-projet', action: 'upload', id, taille: file.size },
  })
  return NextResponse.json({ fichier }, { status: 201 })
}
