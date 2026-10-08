// ─── Import vers le référentiel des entités (consolidation, lot E2) ───────────
// Origine : fichier CSV / XLSX (colonnes nom, code, type, parent, alias) ou connecteur (REST / LDAP, liste complète).
// `dryRun` : aperçu des écarts sans écriture ; sinon application des choix de l'ADMIN (créations, renommages retenus,
// clôtures cochées) dans une transaction verrouillée par organisation, plan recalculé sur l'état courant.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { contexteEntites } from '@/lib/entites.server'
import { TYPES_ENTITE, type EntiteRef } from '@/lib/entites'
import { mapEntiteColumns, planifierImportEntites, MAX_LIGNES_IMPORT_ENTITES, type LigneImportEntite, type OptionsImport } from '@/lib/entites-import'
import { configConnecteur, connecteurConfigure, lireConnecteur } from '@/lib/entity-sync.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXCEL_PARSE } from '@/lib/rate-limit'
import { checkTabularUpload } from '@/lib/import-file-format'
import { importErrorStatus } from '@/lib/import-errors'
import { loadTabularWorkbook } from '@/lib/tabular-workbook'
import { detectHistoricHeaderLayout } from '@/lib/historic-import'
import { readDataRows, readSheetSample } from '@/lib/excel-grid'

export const dynamic = 'force-dynamic'

const ids = z.array(z.string().max(64)).max(MAX_LIGNES_IMPORT_ENTITES)
const schema = z.object({
  origine: z.enum(['FICHIER', 'CONNECTEUR']),
  filename: z.string().max(255).optional(), data: z.string().max(14_000_000).optional(),
  typeParDefaut: z.enum(TYPES_ENTITE),
  listeComplete: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  creerQuandMeme: z.array(z.number().int().positive()).max(MAX_LIGNES_IMPORT_ENTITES).optional(),
  renommer: ids.optional(), clore: ids.optional(),
})

const SELECT = { id: true, nom: true, type: true, alias: true, codeExterne: true, parentId: true, source: true, valideAu: true } as const
type Ligne = { id: string; nom: string; type: string; alias: unknown; codeExterne: string | null; parentId: string | null; source: string; valideAu: Date | null }
const versRef = (rows: Ligne[]): EntiteRef[] => rows.map(r => ({ ...r, alias: Array.isArray(r.alias) ? (r.alias as string[]) : [] }))

type Lecture = { ok: true; lignes: LigneImportEntite[]; colonnes?: ReturnType<typeof mapEntiteColumns> } | { ok: false; res: NextResponse }

async function lireFichier(filename: string | undefined, data: string | undefined): Promise<Lecture> {
  if (!filename || !data) return { ok: false, res: NextResponse.json({ error: 'excel_file_invalid' }, { status: 400 }) }
  const buffer = Buffer.from(data, 'base64')
  const formatError = checkTabularUpload(filename, buffer.subarray(0, 16))
  if (formatError) return { ok: false, res: NextResponse.json({ error: formatError }, { status: importErrorStatus(formatError) }) }
  try {
    const loaded = await loadTabularWorkbook(buffer, filename)
    if (!loaded.ok) return { ok: false, res: NextResponse.json({ error: loaded.error, details: loaded.details }, { status: loaded.status }) }
    const sheet = loaded.workbook.worksheets.find(ws => ws.rowCount > 0)
    if (!sheet) return { ok: false, res: NextResponse.json({ error: 'excel_no_importable_sheet' }, { status: 400 }) }
    const layout = detectHistoricHeaderLayout(readSheetSample(sheet, 20, 100))
    const headers = layout.columns.map(c => c.key)
    const colonnes = mapEntiteColumns(headers)
    if (!colonnes.nom) return { ok: false, res: NextResponse.json({ error: 'name_column_missing', headers }, { status: 400 }) }
    const lu = readDataRows(sheet, layout, { max: MAX_LIGNES_IMPORT_ENTITES })
    if (lu.truncated) return { ok: false, res: NextResponse.json({ error: 'excel_too_many_rows', details: sheet.name }, { status: 413 }) }
    const cell = (row: Record<string, string>, h?: string) => (h ? (row[h] ?? '').trim() : '')
    const lignes = lu.rows.flatMap((row, i) => {
      const v = { nom: cell(row, colonnes.nom), code: cell(row, colonnes.code), type: cell(row, colonnes.type), parent: cell(row, colonnes.parent), alias: cell(row, colonnes.alias) }
      if (!Object.values(v).some(Boolean)) return [] // ligne vide ignorée
      return [{ line: lu.rowNumbers[i], nom: v.nom, code: v.code || undefined, type: v.type || undefined, parent: v.parent || undefined, alias: v.alias || undefined }]
    })
    return { ok: true, lignes, colonnes }
  } catch { return { ok: false, res: NextResponse.json({ error: 'excel_workbook_unreadable' }, { status: 422 }) } }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const c = await contexteEntites()
  if ('error' in c) return c.error
  if (!c.admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const rl = await rateLimit(`excel-parse:${c.userId}`, LIMIT_EXCEL_PARSE.limit, LIMIT_EXCEL_PARSE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'excel_rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'excel_file_invalid' }, { status: 400 })
  const body = parsed.data

  let lecture: Lecture
  if (body.origine === 'CONNECTEUR') {
    const cfg = configConnecteur((await prisma.organizationConfig.findUnique({ where: { id: c.orgId }, select: { entitesSyncConfig: true } }))?.entitesSyncConfig)
    if (!connecteurConfigure(cfg)) return NextResponse.json({ error: 'connector_not_configured' }, { status: 400 })
    try {
      const noms = await lireConnecteur(cfg)
      lecture = { ok: true, lignes: noms.slice(0, MAX_LIGNES_IMPORT_ENTITES).map((nom, i) => ({ line: i + 1, nom })) }
    } catch { return NextResponse.json({ error: 'connector_unreachable' }, { status: 422 }) }
  } else lecture = await lireFichier(body.filename, body.data)
  if (!lecture.ok) return lecture.res

  // Le connecteur renvoie la liste complète de l'annuaire ; un fichier, seulement si l'administrateur le précise.
  const opts: OptionsImport = { typeParDefaut: body.typeParDefaut, listeComplete: body.origine === 'CONNECTEUR' || !!body.listeComplete, creerQuandMeme: body.creerQuandMeme, renommer: body.renommer, clore: body.clore }
  const source = body.origine === 'CONNECTEUR' ? 'ANNUAIRE' : 'IMPORT'
  if (body.dryRun) {
    const plan = planifierImportEntites(lecture.lignes, versRef(await prisma.entite.findMany({ where: { organizationId: c.orgId }, select: SELECT })), opts)
    return NextResponse.json({ colonnes: lecture.colonnes, lignes: plan.lignes, disparues: plan.disparues, compte: plan.compte })
  }

  const lignes = lecture.lignes
  const resultat = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${c.orgId}), hashtext('entites-import'))::text`
    const plan = planifierImportEntites(lignes, versRef(await tx.entite.findMany({ where: { organizationId: c.orgId }, select: SELECT })), opts)
    const idsParLigne = new Map<number, string>()
    for (const l of plan.aCreer) {
      const cree = await tx.entite.create({ data: {
        organizationId: c.orgId, nom: l.nom, type: l.type, codeExterne: l.code ?? null, alias: l.alias, source,
        parentId: l.parentLigne !== undefined ? idsParLigne.get(l.parentLigne) ?? null : l.parentExistantId ?? null,
      } })
      idsParLigne.set(l.line, cree.id)
    }
    for (const r of plan.aRenommer) await tx.entite.update({ where: { id: r.id }, data: { nom: r.nom } })
    if (plan.aClore.length) await tx.entite.updateMany({ where: { id: { in: plan.aClore }, organizationId: c.orgId }, data: { valideAu: new Date(new Date().toISOString().slice(0, 10)) } })
    return plan
  })
  await auditLog('ENTITE_REFERENTIEL_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'entite', details: { action: 'import', origine: body.origine, fichier: body.filename?.slice(0, 120), crees: resultat.aCreer.length, renommees: resultat.aRenommer.length, closes: resultat.aClore.length } })
  return NextResponse.json({ lignes: resultat.lignes, compte: resultat.compte, crees: resultat.aCreer.length, renommees: resultat.aRenommer.length, closes: resultat.aClore.length }, { status: resultat.aCreer.length || resultat.aRenommer.length || resultat.aClore.length ? 201 : 200 })
}
