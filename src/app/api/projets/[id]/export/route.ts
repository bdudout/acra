// ─── Export PowerPoint d'un projet 360 ────────────────────────────────────────
// GET /api/projets/[id]/export?lang=fr — revue de projet : vision, avancement sur les risques et sur les plans
// d'action, plans par priorité. Même chargement et mêmes droits que la page du projet (lib/projet-vue.server) :
// projet inaccessible → 404. Rendu : lib/projet-pptx.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { UserRole } from '@/lib/permissions'
import { getT, LOCALES, type Locale } from '@/lib/i18n'
import { chargerVueProjet } from '@/lib/projet-vue.server'
import { donneesProjetPptx, labelsProjetPptx, renderProjetPptx } from '@/lib/projet-pptx'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

/** Nom de fichier sûr : minuscules, sans accents ni caractères spéciaux. */
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'projet'

export async function GET(req: NextRequest, { params }: Params) {
  const u = (await getServerSession(authOptions))?.user as { id?: string; role?: string } | undefined
  if (!u?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const lang = req.nextUrl?.searchParams.get('lang') ?? ''
  const locale: Locale = (LOCALES as string[]).includes(lang) ? lang as Locale : 'fr'
  const role = (u.role ?? 'ANALYSTE') as UserRole
  const { id } = await params
  const v = await chargerVueProjet(id, u.id, role, locale)
  if (!v) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  const t = getT(locale)
  const buffer = await renderProjetPptx(donneesProjetPptx({ vue: v.vue, plans: v.plans, parDomaine: v.parDomaine, t, locale, now: new Date() }), labelsProjetPptx(t))
  await auditLog('EXPORT', { userId: u.id, userRole: role, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { scope: 'projet-pptx', locale } })
  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="acra-projet-${slug(v.vue.nom)}.pptx"`,
      'Cache-Control': 'no-store',
    },
  })
}
