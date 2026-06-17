import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitHeaders, LIMIT_SEARCH } from '@/lib/rate-limit'
import { auditLog } from '@/lib/logger'
import {
  DEFAULT_TYPES_IMPACTS, DEFAULT_REFERENTIELS, DEFAULT_STRATEGIES,
  type TypeImpact, type ReferentielActif, type StrategieTraitement,
} from '@/lib/org-config-defaults'
import { sanitizeExemples, getCategoryDef, type ExempleCategoryKey } from '@/lib/exemples-ateliers'

const DEFAULT_ENTITES = ['DSI', 'Métier', 'Risques', 'RH', 'Juridique']

async function getOrCreate() {
  return prisma.organizationConfig.upsert({
    where: { id: 'global' },
    create: { id: 'global', entitesMesures: DEFAULT_ENTITES },
    update: {},
  })
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'impact'
}

// GET /api/admin/organization-config — accessible à tous les utilisateurs authentifiés
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id

  // Rate limiting : 60 req/min par utilisateur (partagé avec LIMIT_SEARCH)
  const rl = rateLimit(`org-config:${userId}`, LIMIT_SEARCH.limit, LIMIT_SEARCH.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez dans une minute.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
    )
  }

  const config = await getOrCreate()
  const typesImpacts = config.typesImpacts as unknown as TypeImpact[]
  const referentielsActifs = config.referentielsActifs as unknown as ReferentielActif[]
  const strategies = (config as any).strategiesTraitement as unknown as StrategieTraitement[]
  const exemples = (config as any).exemplesAteliers
  return NextResponse.json({
    entitesMesures: (config.entitesMesures as string[]) ?? DEFAULT_ENTITES,
    typesImpacts: typesImpacts?.length ? typesImpacts : DEFAULT_TYPES_IMPACTS,
    referentielsActifs: referentielsActifs?.length ? referentielsActifs : DEFAULT_REFERENTIELS,
    strategiesTraitement: strategies?.length ? strategies : DEFAULT_STRATEGIES,
    exemplesAteliers: (exemples && typeof exemples === 'object' && !Array.isArray(exemples)) ? exemples : {},
    qualificationActive: Boolean((config as any).qualificationActive),
    conformiteActive: Boolean((config as any).conformiteActive),
    conseilsAteliersActive: (config as any).conseilsAteliersActive !== false, // activé par défaut
  })
}

// PUT /api/admin/organization-config — ADMIN uniquement
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId   = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  if (userRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const body = await req.json()

  // Construit dynamiquement les champs fournis (mise à jour partielle)
  const data: Record<string, unknown> = {}

  if (Array.isArray(body.entitesMesures)) {
    data.entitesMesures = body.entitesMesures
      .map((e: unknown) => String(e).trim().slice(0, 50))
      .filter(Boolean)
      .slice(0, 30)
  }

  if (Array.isArray(body.typesImpacts)) {
    // [{id?, label, icon}] — label requis ; id auto-généré si absent ; max 30
    const seen = new Set<string>()
    data.typesImpacts = body.typesImpacts
      .map((t: any) => {
        const label = String(t?.label ?? '').trim().slice(0, 60)
        if (!label) return null
        let id = String(t?.id ?? '').trim() || slugify(label)
        while (seen.has(id)) id = `${id}-2`
        seen.add(id)
        return { id, label, icon: String(t?.icon ?? '🎯').slice(0, 4) }
      })
      .filter(Boolean)
      .slice(0, 30)
  }

  if (Array.isArray(body.referentielsActifs)) {
    data.referentielsActifs = body.referentielsActifs
      .map((r: any) => {
        const nom = String(r?.nom ?? '').trim().slice(0, 100)
        if (!nom) return null
        return { nom, description: String(r?.description ?? '').trim().slice(0, 200), actif: r?.actif !== false }
      })
      .filter(Boolean)
      .slice(0, 50)
  }

  if (Array.isArray(body.strategiesTraitement)) {
    // value/color FIXES (depuis les défauts) ; seuls label/description/conseil sont éditables.
    const edits = new Map<string, any>(body.strategiesTraitement.map((s: any) => [String(s?.value), s]))
    data.strategiesTraitement = DEFAULT_STRATEGIES.map((def) => {
      const e = edits.get(def.value)
      return {
        value: def.value,
        color: def.color,
        label:       (String(e?.label ?? def.label).trim().slice(0, 60))        || def.label,
        description: (String(e?.description ?? def.description).trim().slice(0, 300)) || def.description,
        conseil:     (String(e?.conseil ?? def.conseil).trim().slice(0, 300))    || def.conseil,
      }
    })
  }

  if (body.exemplesAteliers && typeof body.exemplesAteliers === 'object' && !Array.isArray(body.exemplesAteliers)) {
    // Merge par catégorie : une catégorie vidée revient aux défauts (clé supprimée).
    const current = await getOrCreate()
    const stored = (current as any).exemplesAteliers
    const merged: Record<string, unknown> = (stored && typeof stored === 'object' && !Array.isArray(stored)) ? { ...stored } : {}
    for (const [cat, value] of Object.entries(body.exemplesAteliers)) {
      if (!getCategoryDef(cat as ExempleCategoryKey)) continue // ignore les catégories inconnues
      const clean = sanitizeExemples(cat as ExempleCategoryKey, Array.isArray(value) ? value : [])
      if (clean.length === 0) delete merged[cat]
      else merged[cat] = clean
    }
    data.exemplesAteliers = merged
  }

  if (typeof body.qualificationActive === 'boolean') data.qualificationActive = body.qualificationActive
  if (typeof body.conformiteActive === 'boolean') data.conformiteActive = body.conformiteActive
  if (typeof body.conseilsAteliersActive === 'boolean') data.conseilsAteliersActive = body.conseilsAteliersActive

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
  }

  const config = await prisma.organizationConfig.upsert({
    where: { id: 'global' },
    create: { id: 'global', entitesMesures: [], ...data },
    update: data,
  })

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole,
    details: { fields: Object.keys(data) },
  })

  return NextResponse.json({
    entitesMesures: (config.entitesMesures as string[]) ?? [],
    typesImpacts: (config.typesImpacts as unknown as TypeImpact[]) ?? [],
    referentielsActifs: (config.referentielsActifs as unknown as ReferentielActif[]) ?? [],
    strategiesTraitement: ((config as any).strategiesTraitement as unknown as StrategieTraitement[]) ?? DEFAULT_STRATEGIES,
    exemplesAteliers: (config as any).exemplesAteliers ?? {},
    qualificationActive: Boolean((config as any).qualificationActive),
    conformiteActive: Boolean((config as any).conformiteActive),
    conseilsAteliersActive: (config as any).conseilsAteliersActive !== false,
  })
}
