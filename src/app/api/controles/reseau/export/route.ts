import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { type UserRole } from '@/lib/permissions'
import { chargerReseau } from '@/lib/controle-reseau.server'
import { buildReseauXlsx } from '@/lib/controle-reseau-xlsx'
import { getServerT } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

// GET /api/controles/reseau/export — tableau contrôle × entité au format Excel (même périmètre que la vue).
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const data = await chargerReseau((session.user as { id: string }).id, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!data) return NextResponse.json({ error: 'Module inactif' }, { status: 403 })
  const t = await getServerT()
  const now = new Date()
  const buf = await buildReseauXlsx(data, { labels: t.controleReseau, organisation: data.organisation, now })
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="controles-reseau-${now.toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
