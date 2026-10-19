import { NextResponse } from 'next/server'
import { optionsStructure } from '@/lib/org-config.server'
import { z } from 'zod'
import { canCreateAnalyse } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { rateLimit, rateLimitHeaders, LIMIT_EXCEL_PARSE } from '@/lib/rate-limit'
import { checkTabularUpload } from '@/lib/import-file-format'
import { loadTabularWorkbook } from '@/lib/tabular-workbook'
import { importErrorStatus } from '@/lib/import-errors'
import { apercuClasseur } from '@/lib/analysis-import-classeur.server'

const schema = z.object({ filename: z.string().max(255), data: z.string().min(1).max(14_000_000), organizationId: z.string().trim().min(1).max(191).optional() })

/** Prévisualisation Excel sans persistance : première étape obligatoire de l'import historique. */
// Organisation cible du corps (sinon active) : rôle effectif résolu dans le handler (`org: 'none'`).
// Débit `excel-parse` vérifié après le contrôle de format (code dédié `excel_rate_limited`) : gardé ici.
export const POST = withAccess({ org: 'none' }, async (req, { user }) => {
  const userId = user.id
  const globalRole = user.role
  const scope = await getAnalyseScope(userId, globalRole)
  let body: z.infer<typeof schema>
  try { body = schema.parse(await req.json()) } catch { return NextResponse.json({ error: 'excel_file_invalid' }, { status: 400 }) }
  const targetOrganizationId = body.organizationId ?? scope.activeOrgId
  const targetRole = targetOrganizationId ? await getEffectiveRoleForOrg(userId, globalRole, targetOrganizationId) : null
  if (!targetRole || !canCreateAnalyse({ id: userId, role: targetRole }, await optionsStructure(targetOrganizationId))) return NextResponse.json({ error: 'Droit de création d’analyse requis' }, { status: 403 })
  // Format vérifié sur le CONTENU (signature) et l'extension : un .xls — même renommé — reçoit un message dédié.
  const buffer = Buffer.from(body.data, 'base64')
  const formatError = checkTabularUpload(body.filename, buffer.subarray(0, 16))
  if (formatError) return NextResponse.json({ error: formatError }, { status: importErrorStatus(formatError) })
  // Débit + taille décompressée vérifiés AVANT tout chargement ExcelJS (qui
  // décompresse tout en mémoire et bloque l'event loop sur un gros classeur).
  const rl = await rateLimit(`excel-parse:${userId}`, LIMIT_EXCEL_PARSE.limit, LIMIT_EXCEL_PARSE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'excel_rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  try {
    const loaded = await loadTabularWorkbook(buffer, body.filename)
    if (!loaded.ok) return NextResponse.json({ error: loaded.error, details: loaded.details }, { status: loaded.status })
    const { workbook } = loaded
    return NextResponse.json({ filename: body.filename, sheets: apercuClasseur(workbook) })
  } catch { return NextResponse.json({ error: 'excel_workbook_unreadable' }, { status: 422 }) }
})
