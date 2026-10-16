import { NextResponse } from 'next/server'
import { randomUUID, createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import { storageKeyFor } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { getDocumentTemplate, templateFilename, DOCX_MIME } from '@/lib/document-templates'
import { markdownToDocxBuffer } from '@/lib/markdown-docx'
import { peutGererDocuments } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/documents/template — insère un MODÈLE d'annexe (PAS, DPA, réversibilité,
// PCA/PRA…) comme un vrai document Markdown éditable de la bibliothèque. Le contenu
// vient du catalogue serveur (jamais du client). Idempotent : refuse (409) si un
// document du même titre existe déjà. Réservé à la gouvernance documentaire.
export const POST = withAccess({ org: 'active', allow: peutGererDocuments, rateLimit: { bucket: 'documents' } }, async (req, { user, role, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })

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
  // Génère un vrai .docx (annexe joignable à un contrat) à partir du Markdown du modèle.
  const bytes = await markdownToDocxBuffer(template.titre, template.contenu)
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const fichierNom = templateFilename(template)
  const storageKey = storageKeyFor(orgId, id, fichierNom)

  const storage = await getDocumentStorage()
  await storage.put(storageKey, bytes, DOCX_MIME)

  try {
    const created = await prisma.document.create({
      data: {
        id, organizationId: orgId, uploadedBy: userId,
        titre: template.titre, type: template.type, portee: 'ORG',
        description: template.description,
        fichierNom, mime: DOCX_MIME, taille: bytes.length, checksum, storageKey,
      },
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', {
      userId, userRole: role, organizationId: orgId, ip: getClientIp(req),
      details: { scope: 'document', action: 'insert-template', template: template.id, id },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    await storage.delete(storageKey).catch(() => {})
    throw e
  }
})
