import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { prepareImport, type ImportItemError } from '@/lib/api-import'
import { validateRiskItemInput, cleanRiskItem } from '@/lib/risk-item'
import { validateControleInput, cleanControleInput } from '@/lib/controle'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/v1/import — import EN MASSE de risques et/ou contrôles (scope write).
// Body : { risks?: [...], controls?: [...] }. Chaque item est validé par la lib
// métier ; les invalides sont remontés par index (l'import continue). Porté à
// l'organisation de la clé.
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'write')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const cfg = await getOrgConfig(auth.organizationId)
  const body = await req.json().catch(() => ({}))

  const created: Record<string, number> = {}
  const skipped: Record<string, number> = {}
  const errors: (ImportItemError & { resource: string })[] = []

  // ── Risques ────────────────────────────────────────────────────────────────
  if (Array.isArray(body.risks)) {
    if (!cfg.registreRisquesActive) {
      errors.push({ resource: 'risks', index: -1, error: 'module_inactif' })
    } else {
      const p = prepareImport(body.risks, validateRiskItemInput, cleanRiskItem)
      if (p.valid.length) {
        await prisma.riskItem.createMany({ data: p.valid.map(v => ({ ...v, organizationId: auth.organizationId, provenance: 'API' })) })
      }
      created.risks = p.valid.length
      skipped.risks = p.skipped
      p.errors.forEach(e => errors.push({ resource: 'risks', ...e }))
    }
  }

  // ── Contrôles ────────────────────────────────────────────────────────────────
  if (Array.isArray(body.controls)) {
    if (!cfg.controlePermanentActive) {
      errors.push({ resource: 'controls', index: -1, error: 'module_inactif' })
    } else {
      const p = prepareImport(body.controls, validateControleInput, cleanControleInput)
      if (p.valid.length) {
        await prisma.controle.createMany({ data: p.valid.map(v => ({ ...v, organizationId: auth.organizationId })) as never })
      }
      created.controls = p.valid.length
      skipped.controls = p.skipped
      p.errors.forEach(e => errors.push({ resource: 'controls', ...e }))
    }
  }

  const totalCreated = Object.values(created).reduce((s, n) => s + n, 0)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: `apikey:${auth.keyId}`, userRole: 'API', organizationId: auth.organizationId, ip: getClientIp(req),
    details: { scope: 'api-import', created, skipped, errors: errors.length },
  })
  return NextResponse.json({ created, skipped, errors }, { status: totalCreated > 0 || errors.length === 0 ? 201 : 400 })
}
