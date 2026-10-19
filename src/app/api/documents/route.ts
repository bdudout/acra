import { NextResponse } from 'next/server'
import { randomUUID, createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import { validateDocumentMeta, cleanDocumentMeta, mimeAutorise, contentMatchesMime, storageKeyFor, MAX_DOCUMENT_SIZE } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'
import { lirePagination, paginer, trier, correspond } from '@/lib/pagination'
import { DOCUMENT_TEMPLATES } from '@/lib/document-templates'

export const dynamic = 'force-dynamic'

// La bibliothèque documentaire relève de la gouvernance (RSSI / conformité / risques).
import { peutGererDocuments } from '@/lib/permissions'

// GET /api/documents[?referentiel=CODE] — liste des documents de l'organisation.
// org: 'none' : sans organisation active, réponse « inactive » (et non 400).
// Lot V1 : `?page=N&taille=&tri=&ordre=&q=&type=&portee=` → page seule + `pagination` + `synthese` (sans `page` : liste complète).
const TRIS = ['defaut', 'titre', 'type', 'dateRevue', 'taille', 'createdAt'] as const
const SELECT_DOC = {
  id: true, titre: true, type: true, portee: true, referentielCode: true, risqueId: true,
  version: true, description: true, dateDocument: true, dateRevue: true,
  fichierNom: true, mime: true, taille: true, createdAt: true,
} as const
const TITRES_MODELES = DOCUMENT_TEMPLATES.map(t => t.titre)

export const GET = withAccess({ org: 'none' }, async (req, { user }) => {
  const { role: userRole, activeOrgId: orgId } = await getAnalyseScope(user.id, user.role)
  if (!orgId) return NextResponse.json({ active: false, documents: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ active: false, documents: [] })

  const sp = new URL(req.url).searchParams
  const referentiel = sp.get('referentiel')
  const base = { organizationId: orgId, analyseId: null }
  const pg = lirePagination(sp, { tris: TRIS, triDefaut: 'defaut' })
  if (!pg) {
    const docs = await prisma.document.findMany({
      where: { ...base, ...(referentiel ? { referentielCode: referentiel } : {}) },
      orderBy: [{ createdAt: 'desc' }],
      select: SELECT_DOC,
    })
    return NextResponse.json({ active: true, documents: docs, canManage: peutGererDocuments(userRole) })
  }

  // Requête LÉGÈRE (filtres simples en SQL ; recherche sans casse ni accents, tri et page en mémoire), détail de la seule page.
  const type = sp.get('type') ?? ''
  const portee = sp.get('portee') ?? ''
  const [legers, total, modeles] = await Promise.all([
    prisma.document.findMany({
      where: { ...base, ...(referentiel ? { referentielCode: referentiel } : {}), ...(type ? { type } : {}), ...(portee ? { portee } : {}) },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, titre: true, type: true, fichierNom: true, description: true, dateRevue: true, taille: true, createdAt: true },
    }),
    prisma.document.count({ where: base }),
    // « Déjà ajouté » des modèles d'annexes : sur toute la bibliothèque, pas sur la page.
    prisma.document.findMany({ where: { ...base, titre: { in: TITRES_MODELES } }, select: { titre: true }, distinct: ['titre'] }),
  ])
  const filtres = legers.filter(x => correspond(pg.q, x.titre, x.fichierNom, x.description))
  const cleTri: Record<(typeof TRIS)[number], ((x: (typeof legers)[number]) => unknown) | null> = {
    defaut: null, titre: x => x.titre, type: x => x.type, dateRevue: x => x.dateRevue, taille: x => x.taille, createdAt: x => x.createdAt,
  }
  const k = cleTri[pg.tri]
  const page = paginer(k ? trier(filtres, k, pg.ordre) : filtres, pg)
  const ordre = new Map(page.items.map((x, i) => [x.id, i]))
  const documents = page.items.length
    ? (await prisma.document.findMany({ where: { ...base, id: { in: page.items.map(x => x.id) } }, select: SELECT_DOC }))
      .sort((a, b) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0))
    : []
  return NextResponse.json({
    active: true, documents, canManage: peutGererDocuments(userRole),
    pagination: page.pagination, synthese: { total, titresModeles: modeles.map(m => m.titre) },
  })
})

// POST /api/documents — dépôt d'un document (multipart/form-data : champ `file` + métadonnées).
export const POST = withAccess({ org: 'active', allow: peutGererDocuments, rateLimit: { bucket: 'documents' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })

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
  if (!contentMatchesMime(file.type, bytes.subarray(0, 1024))) return NextResponse.json({ error: 'mime_interdit' }, { status: 400 })
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
})
