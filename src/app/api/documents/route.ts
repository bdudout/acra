import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID, createHash } from 'node:crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validateDocumentMeta, cleanDocumentMeta, mimeAutorise, storageKeyFor, MAX_DOCUMENT_SIZE } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// La bibliothèque documentaire relève de la gouvernance (RSSI / conformité / risques).
export function peutGererDocuments(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'CONFORMITE' || role === 'DPO'
}

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

// GET /api/documents[?referentiel=CODE] — liste des documents de l'organisation.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ active: false, documents: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ active: false, documents: [] })

  const referentiel = new URL(req.url).searchParams.get('referentiel')
  const docs = await prisma.document.findMany({
    where: { organizationId: orgId, ...(referentiel ? { referentielCode: referentiel } : {}) },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true, titre: true, type: true, portee: true, referentielCode: true, risqueId: true,
      version: true, description: true, dateDocument: true, dateRevue: true,
      fichierNom: true, mime: true, taille: true, createdAt: true,
    },
  })
  return NextResponse.json({ active: true, documents: docs, canManage: peutGererDocuments(userRole) })
}

// POST /api/documents — dépôt d'un document (multipart/form-data : champ `file` + métadonnées).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ error: 'org_absente' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })
  if (!peutGererDocuments(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'form_invalide' }, { status: 400 })
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'fichier_requis' }, { status: 400 })
  if (file.size > MAX_DOCUMENT_SIZE) return NextResponse.json({ error: 'fichier_trop_gros' }, { status: 400 })
  if (!mimeAutorise(file.type)) return NextResponse.json({ error: 'mime_interdit' }, { status: 400 })

  const meta = {
    titre: form.get('titre'), type: form.get('type'), portee: form.get('portee'),
    referentielId: form.get('referentielId'), risqueId: form.get('risqueId'),
    version: form.get('version'), description: form.get('description'),
    dateDocument: form.get('dateDocument'), dateRevue: form.get('dateRevue'),
    taille: file.size, mime: file.type,
  }
  const erreur = validateDocumentMeta(meta)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanDocumentMeta(meta as Record<string, unknown>)

  // Si portée REFERENTIEL, vérifier que le référentiel custom existe (les codes
  // builtin sont acceptés tels quels). Empêche les rattachements fantômes.
  if (data.portee === 'REFERENTIEL' && data.referentielId) {
    const known = /^[A-Z0-9_]+$/.test(data.referentielId) // heuristique code builtin (ISO27001…)
    if (!known) {
      const row = await prisma.referentiel.findFirst({ where: { organizationId: orgId, code: data.referentielId }, select: { id: true } })
      if (!row) return NextResponse.json({ error: 'referentiel_introuvable' }, { status: 400 })
    }
  }

  const id = randomUUID()
  const bytes = Buffer.from(await file.arrayBuffer())
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const storageKey = storageKeyFor(orgId, id, file.name)

  const storage = await getDocumentStorage()
  await storage.put(storageKey, bytes, file.type)

  try {
    const created = await prisma.document.create({
      data: {
        id, organizationId: orgId, uploadedBy: userId,
        titre: data.titre, type: data.type, portee: data.portee,
        referentielCode: data.referentielId, risqueId: data.risqueId,
        version: data.version, description: data.description,
        dateDocument: data.dateDocument, dateRevue: data.dateRevue,
        fichierNom: file.name, mime: file.type, taille: file.size, checksum, storageKey,
      },
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', {
      userId, userRole, organizationId: orgId, ip: getClientIp(req),
      details: { scope: 'document', action: 'upload', id, taille: file.size },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    // Rollback du blob si l'insertion échoue (pas de fichier orphelin).
    await storage.delete(storageKey).catch(() => {})
    throw e
  }
}
