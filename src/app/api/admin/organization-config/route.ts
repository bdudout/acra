import { NextRequest, NextResponse } from 'next/server'
import { sanitizeTaxonomie } from '@/lib/taxonomie'
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
import { sanitizeConformiteNiveau, sanitizeSnapshotMode } from '@/lib/conformite-config'
import { sanitizeEchelles } from '@/lib/ecosystem-echelles'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'

const DEFAULT_ENTITES = ['DSI', 'Métier', 'Risques', 'RH', 'Juridique']

// Organisation active (multi-organisation) : la config éditée/lue lui est rattachée.
async function activeOrgId(session: any): Promise<string> {
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  const { activeOrgId } = await getAnalyseScope(userId, userRole)
  return activeOrgId ?? 'global'
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

  // Config EFFECTIVE de l'organisation active (héritage des ancêtres + défauts).
  const cfg = await getOrgConfig(await activeOrgId(session))
  return NextResponse.json({
    entitesMesures: cfg.entitesMesures,
    typesImpacts: cfg.typesImpacts,
    referentielsActifs: cfg.referentielsActifs,
    strategiesTraitement: cfg.strategiesTraitement,
    exemplesAteliers: cfg.exemplesAteliers,
    qualificationActive: cfg.qualificationActive,
    qualificationObligatoire: cfg.qualificationObligatoire,
    conformiteActive: cfg.conformiteActive,
    conformiteNiveau: cfg.conformiteNiveau,
    conformiteSnapshotMode: cfg.conformiteSnapshotMode,
    conseilsAteliersActive: cfg.conseilsAteliersActive,
    acceptationRisquesActive: cfg.acceptationRisquesActive,
    derogationsActive: cfg.derogationsActive,
    derogationDureeDefautJours: cfg.derogationDureeDefautJours,
    derogationAlerteJours: cfg.derogationAlerteJours,
    derogationWorkflow: cfg.derogationWorkflow,
    derogationDoubleRegard: cfg.derogationDoubleRegard,
    derogationSortCatalogue: cfg.derogationSortCatalogue,
    taxonomieRisques: cfg.taxonomieRisques,
    registreRisquesActive: cfg.registreRisquesActive,
    echellesEcosysteme: echellesOut(cfg.echellesEcosysteme),
  })
}

/** Override d'échelles stocké, ou {} (le client résout avec les défauts lib). */
function echellesOut(v: unknown): Record<string, unknown> {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v as Record<string, unknown> : {}
}

// PUT /api/admin/organization-config — ADMIN uniquement
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId   = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  if (!isAdminRole(userRole)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }
  const orgId = await activeOrgId(session)

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
    const current = await prisma.organizationConfig.findUnique({ where: { id: orgId } })
    const stored = (current as any)?.exemplesAteliers
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
  if (typeof body.qualificationObligatoire === 'boolean') data.qualificationObligatoire = body.qualificationObligatoire
  if (typeof body.conformiteActive === 'boolean') data.conformiteActive = body.conformiteActive
  if (typeof body.conformiteNiveau === 'string') data.conformiteNiveau = sanitizeConformiteNiveau(body.conformiteNiveau)
  if (typeof body.conformiteSnapshotMode === 'string') data.conformiteSnapshotMode = sanitizeSnapshotMode(body.conformiteSnapshotMode)
  if (typeof body.conseilsAteliersActive === 'boolean') data.conseilsAteliersActive = body.conseilsAteliersActive
  if (typeof body.acceptationRisquesActive === 'boolean') data.acceptationRisquesActive = body.acceptationRisquesActive
  if (typeof body.derogationsActive === 'boolean') data.derogationsActive = body.derogationsActive
  // Durée par défaut (1 jour à 10 ans) et fenêtre d'alerte (1 à 365 jours), bornées.
  if (typeof body.derogationDureeDefautJours === 'number' && Number.isFinite(body.derogationDureeDefautJours)) {
    data.derogationDureeDefautJours = Math.max(1, Math.min(3650, Math.round(body.derogationDureeDefautJours)))
  }
  if (typeof body.derogationAlerteJours === 'number' && Number.isFinite(body.derogationAlerteJours)) {
    data.derogationAlerteJours = Math.max(1, Math.min(365, Math.round(body.derogationAlerteJours)))
  }
  if (typeof body.derogationWorkflow === 'string' && ['AUTONOME', 'RSSI', 'RSSI_METIER'].includes(body.derogationWorkflow)) {
    data.derogationWorkflow = body.derogationWorkflow
  }
  if (typeof body.derogationDoubleRegard === 'boolean') data.derogationDoubleRegard = body.derogationDoubleRegard
  if (typeof body.derogationSortCatalogue === 'boolean') data.derogationSortCatalogue = body.derogationSortCatalogue
  if (typeof body.registreRisquesActive === 'boolean') data.registreRisquesActive = body.registreRisquesActive
  // Taxonomie de risques : nettoyée avant stockage ([] ⇒ retour au défaut Bâle).
  if (Array.isArray(body.taxonomieRisques)) data.taxonomieRisques = sanitizeTaxonomie(body.taxonomieRisques)

  if (body.echellesEcosysteme && typeof body.echellesEcosysteme === 'object' && !Array.isArray(body.echellesEcosysteme)) {
    // Validation/normalisation pure (renumérotation, bornage, ≥2 niveaux) ; {} ⇒ repli défauts.
    data.echellesEcosysteme = sanitizeEchelles(body.echellesEcosysteme)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
  }

  const config = await prisma.organizationConfig.upsert({
    where: { id: orgId },
    create: { id: orgId, entitesMesures: [], ...data },
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
    qualificationObligatoire: Boolean((config as any).qualificationObligatoire),
    conformiteActive: Boolean((config as any).conformiteActive),
    conformiteNiveau: sanitizeConformiteNiveau((config as any).conformiteNiveau),
    conformiteSnapshotMode: sanitizeSnapshotMode((config as any).conformiteSnapshotMode),
    conseilsAteliersActive: (config as any).conseilsAteliersActive !== false,
    echellesEcosysteme: echellesOut((config as any).echellesEcosysteme),
  })
}
