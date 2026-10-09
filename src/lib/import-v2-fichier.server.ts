// ─── API v2 : import d'un FICHIER (xlsx / csv) avec un profil — multipart/form-data (B-IMP-72) ─────────────────────────
// Champs : `file` (obligatoire), `profileRef` (identifiant d'un profil livré ou nom d'un mapping enregistré de l'organisation
// de la clé — prioritaire), `profile` (profil au format d'export, JSON), `idempotencyKey` (import seulement). Même lecture
// que l'interface (lib/analysis-import-classeur.server) ; aucune décision humaine en API : les lignes « à confirmer »
// (valeur obligatoire manquante) ne sont pas importées et sont comptées dans `lines`. Limites : 10 Mo, 500 lignes par
// feuille, 30 lectures de classeur / 10 min par clé. Idempotence et 409 inchangés.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitHeaders, LIMIT_EXCEL_PARSE } from '@/lib/rate-limit'
import { checkTabularUpload } from '@/lib/import-file-format'
import { loadTabularWorkbook } from '@/lib/tabular-workbook'
import { importErrorStatus } from '@/lib/import-errors'
import { apercuClasseur, paquetsClasseur, repartirClasseur } from '@/lib/analysis-import-classeur.server'
import { etatsLignes, selectionDepuisProfil } from '@/lib/import-v2-profil'
import { executeAnalysisImport, parseAnalysisImportRequest, summarizeAnalysisImport, truncateImportRequest } from '@/lib/analysis-import'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { groupTruncations, type Truncation } from '@/lib/import-truncate'
import { auditLog, getClientIp } from '@/lib/logger'

export const TAILLE_MAX_FICHIER = 10 * 1024 * 1024
type Auth = { organizationId: string; keyId: string; actorUserId: string | null }

/** Requête multipart ? (sinon : paquet canonique JSON, inchangé). */
export const estMultipart = (req: NextRequest) => (req.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')

/** Erreurs codées de la lecture d'un classeur → code et statut HTTP (mêmes codes que l'interface). */
function erreurClasseur(error: unknown): { error: string; details?: string; status: number } {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('MAPPING_INCOMPLET')) return { error: 'excel_mapping_incomplete', details: message, status: 400 }
  if (message === 'NO_IMPORTABLE_SHEET') return { error: 'excel_no_importable_sheet', status: 400 }
  if (message.startsWith('TOO_MANY_ROWS:')) return { error: 'excel_too_many_rows', details: message.slice('TOO_MANY_ROWS:'.length), status: 413 }
  if (message.startsWith('duplicate_external_id:')) return { error: 'excel_duplicate_reference', details: message, status: 422 }
  return { error: 'excel_import_invalid', status: 422 }
}

export async function traiterFichierV2(req: NextRequest, auth: Auth, mode: 'APERCU' | 'IMPORT'): Promise<NextResponse> {
  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'excel_file_invalid' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 })
  if (file.size > TAILLE_MAX_FICHIER) return NextResponse.json({ error: 'excel_file_too_large' }, { status: 413 })
  const idempotencyKey = mode === 'IMPORT' ? z.string().trim().min(8).max(120).safeParse(form.get('idempotencyKey')) : null
  if (idempotencyKey && !idempotencyKey.success) return NextResponse.json({ error: 'idempotency_key_required' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const formatError = checkTabularUpload(file.name, buffer.subarray(0, 16))
  if (formatError) return NextResponse.json({ error: formatError }, { status: importErrorStatus(formatError) })
  // Débit vérifié AVANT tout chargement du classeur (décompression en mémoire).
  const rl = await rateLimit(`excel-parse:apikey:${auth.keyId}`, LIMIT_EXCEL_PARSE.limit, LIMIT_EXCEL_PARSE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'excel_rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const loaded = await loadTabularWorkbook(buffer, file.name)
  if (!loaded.ok) return NextResponse.json({ error: loaded.error, details: loaded.details }, { status: loaded.status })

  // Profil : référence (profil livré ou mapping de l'organisation de la clé) > profil fourni > détection automatique.
  let profilInline: unknown
  const brut = form.get('profile')
  if (typeof brut === 'string' && brut.trim()) {
    try { profilInline = JSON.parse(brut) } catch { return NextResponse.json({ error: 'profile_invalid' }, { status: 400 }) }
  }
  const profilRef = typeof form.get('profileRef') === 'string' ? String(form.get('profileRef')) : null
  try {
    const apercu = apercuClasseur(loaded.workbook)
    const enregistres = profilRef ? await prisma.analysisImportMapping.findMany({ where: { OR: [{ organizationId: auth.organizationId }, { organizationId: null }] }, select: { name: true, mappings: true } }) : []
    const sel = selectionDepuisProfil({ profilRef, profilInline }, apercu, enregistres)
    if (!sel.ok) return NextResponse.json({ error: sel.error }, { status: 400 })
    const partition = repartirClasseur(loaded.workbook, sel.selection)
    const lines = etatsLignes(partition.decisions)
    const packageData = paquetsClasseur(partition, file.name)
    const profile = { source: sel.source, ...(profilRef ? { ref: profilRef } : {}) }
    const truncationWarnings = (items: { truncated?: Truncation[] }[]) => groupTruncations(items.flatMap(i => i.truncated ?? [])).map(g => `text_truncated:${g.field}:${g.count}:${g.max}`)

    if (mode === 'APERCU') {
      const echelles = await getEffectiveScaleConfig(auth.organizationId)
      const prepared = packageData.map((item, index) => truncateImportRequest({ ...item, idempotencyKey: `apercu-v2-${index}` }))
      return NextResponse.json({
        valid: true, mode: 'FILE', profile, lines,
        sheets: apercu.map(s => ({ name: s.name, role: sel.selection.sheetTypes[s.name] ?? s.detection.type, mapping: sel.selection.mappings[s.name] ?? {}, rows: s.rows })),
        decisions: partition.decisions.slice(0, 1000),
        analyses: prepared.map(p => summarizeAnalysisImport(parseAnalysisImportRequest(p.data), echelles)),
        warnings: truncationWarnings([...packageData, ...prepared]),
      })
    }

    if (!auth.actorUserId) return NextResponse.json({ error: 'api_key_without_organization_member' }, { status: 422 })
    const key = idempotencyKey!.data!
    const prepared = packageData.map((item, index) => truncateImportRequest({ ...item, idempotencyKey: packageData.length === 1 ? key : `${key}:${index}` }))
    const results = await Promise.all(prepared.map(item => executeAnalysisImport(parseAnalysisImportRequest(item.data), { organizationId: auth.organizationId, userId: auth.actorUserId!, source: 'API_V2' })))
    for (const r of results) {
      await auditLog('ANALYSE_CREATED', { userId: `apikey:${auth.keyId}`, userRole: 'API', organizationId: auth.organizationId, targetId: (r as { analyseId: string }).analyseId, targetType: 'analysis-import', ip: getClientIp(req), details: { source: 'API_V2', format: 'file', profile: sel.source, replayed: r.replayed } })
    }
    return NextResponse.json({ results, imported: results.length, ...results[0], profile, lines, decisions: partition.decisions.slice(0, 1000), warnings: [...(results[0]?.warnings ?? []), ...truncationWarnings([...packageData, ...prepared])] }, { status: results.every(r => r.replayed) ? 200 : 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'IDEMPOTENCY_KEY_REUSED') return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REUSED' }, { status: 409 })
    const e = erreurClasseur(error)
    return NextResponse.json({ error: e.error, ...(e.details ? { details: e.details } : {}) }, { status: e.status })
  }
}
