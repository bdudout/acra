import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { executeAnalysisImport, parseAnalysisImportRequest } from '@/lib/analysis-import'
import { auditLog, getClientIp } from '@/lib/logger'
import { estMultipart, traiterFichierV2 } from '@/lib/import-v2-fichier.server'

export const dynamic = 'force-dynamic'

/**
 * Import d'analyses v2 : contrat canonique (JSON) + idempotence obligatoire par organisation ; ou fichier + profil en
 * multipart/form-data (B-IMP-72, lib/import-v2-fichier.server).
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'write')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (estMultipart(req)) return traiterFichierV2(req, auth, 'IMPORT')
  if (!auth.actorUserId) return NextResponse.json({ error: 'api_key_without_organization_member' }, { status: 422 })
  try {
    const input = parseAnalysisImportRequest(await req.json())
    const result = await executeAnalysisImport(input, { organizationId: auth.organizationId, userId: auth.actorUserId, source: 'API_V2' })
    const imported = result as { analyseId: string; replayed: boolean }
    await auditLog('ANALYSE_CREATED', { userId: `apikey:${auth.keyId}`, userRole: 'API', organizationId: auth.organizationId, targetId: imported.analyseId, targetType: 'analysis-import', ip: getClientIp(req), details: { source: 'API_V2', replayed: result.replayed } })
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import invalide'
    return NextResponse.json({ error: message === 'IDEMPOTENCY_KEY_REUSED' ? message : 'Import invalide', details: message === 'IDEMPOTENCY_KEY_REUSED' ? undefined : message }, { status: message === 'IDEMPOTENCY_KEY_REUSED' ? 409 : 400 })
  }
}
