// ─── Fichiers d'un projet 360 (schémas, documents d'architecture, documents projet) ─
// GET  : liste des fichiers du projet (lecture du projet).
// POST : dépôt multipart { file, type?, titre? } (édition du projet, non gelé) — mêmes contrôles que la GED (taille,
//        MIME autorisé, signature du contenu) ; rattaché à l'analyse (Document.analyseId), hors bibliothèque documentaire.
// Session et rate limit : withAccess (org 'none') ; gardes de lib inchangées (guardLectureProjet360 / guardDirectRisk).
import { NextResponse } from 'next/server'
import { randomUUID, createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { guardDirectRisk, guardLectureProjet360 } from '@/lib/analyse-direct-risk.server'
import { mimeAutorise, contentMatchesMime, storageKeyFor, sanitizeFilename, MAX_DOCUMENT_SIZE } from '@/lib/document'
import { nettoyerFichierProjet } from '@/lib/fichiers-projet'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const FICHIER_SELECT = { id: true, titre: true, type: true, fichierNom: true, mime: true, taille: true, createdAt: true } as const

export const GET = withAccess({ org: 'none' }, async (_req, { user, params }) => {
  const g = await guardLectureProjet360(params.id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!g.analyse.organizationId) return NextResponse.json({ fichiers: [] })
  const fichiers = await prisma.document.findMany({ where: { organizationId: g.analyse.organizationId, analyseId: g.analyse.id }, select: FICHIER_SELECT, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ fichiers })
})

export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'fichiers-projet' } }, async (req, { user, params }) => {
  const g = await guardDirectRisk(params.id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const orgId = g.analyse.organizationId
  if (g.analyse.methode !== 'PROJET_360' || !orgId) return NextResponse.json({ error: 'methode_non_360' }, { status: 400 })

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
      id, organizationId: orgId, analyseId: g.analyse.id, uploadedBy: user.id, portee: 'PROJET', type: meta.type, titre: meta.titre,
      fichierNom: nom, mime: file.type, taille: file.size, checksum: createHash('sha256').update(bytes).digest('hex'), storageKey,
    },
    select: FICHIER_SELECT,
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: g.role, organizationId: orgId, targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'fichier-projet', action: 'upload', id, taille: file.size },
  })
  return NextResponse.json({ fichier }, { status: 201 })
})
