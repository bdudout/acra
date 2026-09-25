import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

/** Consulte le reçu et le rapport rejouable d'un import, strictement dans l'organisation de la clé. */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticateApiRequest(req, 'read')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const receipt = await prisma.analysisImport.findFirst({ where: { id, organizationId: auth.organizationId }, select: { id: true, source: true, analyseId: true, response: true, createdAt: true } })
  if (!receipt) return NextResponse.json({ error: 'import_not_found' }, { status: 404 })
  if (req.nextUrl.searchParams.get('format') === 'csv') {
    const response = receipt.response as { nom?: string; created?: Record<string, number> }
    const rows = [['champ', 'valeur'], ['importId', receipt.id], ['analyseId', receipt.analyseId], ['analyse', response.nom ?? ''], ...Object.entries(response.created ?? {}).map(([key, value]) => [key, String(value)])]
    const csv = rows.map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="acra-import-${receipt.id}.csv"` } })
  }
  return NextResponse.json(receipt)
}
