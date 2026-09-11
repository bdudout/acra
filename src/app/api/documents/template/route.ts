import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID, createHash } from 'node:crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { storageKeyFor } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { getDocumentTemplate, templateFilename } from '@/lib/document-templates'
import { peutGererDocuments } from '../route'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/documents/template — insère un MODÈLE d'annexe (PAS, DPA, réversibilité,
// PCA/PRA…) comme un vrai document Markdown éditable de la bibliothèque. Le contenu
// vient du catalogue serveur (jamais du client). Idempotent : refuse (409) si un
// document du même titre existe déjà. Réservé à la gouvernance documentaire.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'org_absente' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })
  if (!peutGererDocuments(scope.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const template = getDocumentTemplate(String(body?.templateId ?? ''))
  if (!template) return NextResponse.json({ error: 'template_inconnu' }, { status: 400 })

  // Un document du même titre existe déjà → ne pas dupliquer.
  const existant = await prisma.document.findFirst({
    where: { organizationId: orgId, titre: template.titre },
    select: { id: true },
  })
  if (existant) return NextResponse.json({ error: 'document_existant', existant }, { status: 409 })

  const id = randomUUID()
  const bytes = Buffer.from(template.contenu, 'utf-8')
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const fichierNom = templateFilename(template)
  const storageKey = storageKeyFor(orgId, id, fichierNom)

  const storage = await getDocumentStorage()
  await storage.put(storageKey, bytes, 'text/markdown')

  try {
    const created = await prisma.document.create({
      data: {
        id, organizationId: orgId, uploadedBy: userId,
        titre: template.titre, type: template.type, portee: 'ORG',
        description: template.description,
        fichierNom, mime: 'text/markdown', taille: bytes.length, checksum, storageKey,
      },
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', {
      userId, userRole: scope.role, organizationId: orgId, ip: getClientIp(req),
      details: { scope: 'document', action: 'insert-template', template: template.id, id },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    await storage.delete(storageKey).catch(() => {})
    throw e
  }
}
