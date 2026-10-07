// ─── MCP — application d'une proposition PSSI acceptée ────────────────────────
// Crée, dans une seule transaction : le référentiel personnalisé de type PSSI (ses exigences deviennent un
// référentiel de mesures), le document Markdown de la bibliothèque rattaché à ce référentiel (portée REFERENTIEL),
// le suivi de conformité de l'organisation (si demandé et si la conformité est portée par l'organisation), et marque
// la proposition acceptée. Le fichier est déposé avant la transaction et retiré si elle échoue (pas d'orphelin).
import { randomUUID, createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { storageKeyFor } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { pssiDocument, type PssiProposalPayload } from './pssi-proposal'

export type PssiImportResult =
  | { ok: true; referentielId: string; documentId: string; conformiteId: string | null }
  | { ok: false; error: string; status: number }

export async function importerPssi(
  p: PssiProposalPayload,
  ctx: { organizationId: string; userId: string; proposalId: string; note?: string; suiviConformite: boolean },
): Promise<PssiImportResult> {
  const r = p.referentiel
  const pris = await prisma.referentiel.findFirst({ where: { organizationId: ctx.organizationId, code: r.code }, select: { id: true } })
  if (pris) return { ok: false, error: 'code_existant', status: 409 }

  const doc = pssiDocument(p)
  const bytes = Buffer.from(doc.contenu, 'utf8')
  const documentId = randomUUID()
  const storageKey = storageKeyFor(ctx.organizationId, documentId, doc.nom)
  const storage = await getDocumentStorage()
  await storage.put(storageKey, bytes, 'text/markdown')
  try {
    return await prisma.$transaction(async tx => {
      const ref = await tx.referentiel.create({
        data: {
          organizationId: ctx.organizationId, createdBy: ctx.userId,
          code: r.code, nom: r.nom, type: r.type, domaine: r.domaine, version: r.version, description: r.description,
          exigences: r.exigences as unknown as Prisma.InputJsonValue,
          missions: r.missions as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
      await tx.document.create({
        data: {
          id: documentId, organizationId: ctx.organizationId, uploadedBy: ctx.userId,
          titre: r.nom, type: 'PSSI', portee: 'REFERENTIEL', referentielCode: r.code,
          version: r.version, description: r.description, dateDocument: p.date ? new Date(p.date) : null,
          fichierNom: doc.nom, mime: 'text/markdown', taille: bytes.length,
          checksum: createHash('sha256').update(bytes).digest('hex'), storageKey,
        },
      })
      const conformite = ctx.suiviConformite
        ? await tx.conformite.upsert({
          where: { organizationId_referentiel_entite: { organizationId: ctx.organizationId, referentiel: r.code, entite: '' } },
          create: { organizationId: ctx.organizationId, referentiel: r.code, entite: '', entries: [] },
          update: {},
          select: { id: true },
        })
        : null
      await tx.mcpProposal.update({
        where: { id: ctx.proposalId },
        data: { statut: 'ACCEPTEE', reviewedById: ctx.userId, reviewedAt: new Date(), appliedId: ref.id, reviewNote: (ctx.note ?? '').slice(0, 2000) || null },
      })
      return { ok: true as const, referentielId: ref.id, documentId, conformiteId: conformite?.id ?? null }
    })
  } catch (e) {
    await storage.delete(storageKey).catch(() => {})
    // Création concurrente du même code entre la vérification et la transaction.
    if ((e as { code?: string }).code === 'P2002') return { ok: false, error: 'code_existant', status: 409 }
    throw e
  }
}
