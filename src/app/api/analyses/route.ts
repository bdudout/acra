import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { canCreateAnalyse, analyseWhereClause } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { auditLog, getClientIp } from '@/lib/logger'

const createSchema = z.object({
  nom:          z.string().min(1).max(200),
  description:  z.string().max(1000).optional(),
  organisation: z.string().max(200).optional(),
  secteur:      z.string().max(100).optional(),
  dateEcheance: z.string().optional(),
  socleId:      z.string().cuid().optional(), // analyse socle dont hériter
  isSocle:      z.boolean().optional(),       // marquer cette analyse comme socle
})

// GET /api/analyses — liste des analyses de l'utilisateur
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'
  const __org = await getAnalyseScope(userId, userRole)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analyses = await (prisma.analyse as any).findMany({
    where: analyseWhereClause(userId, __org.role, __org.scope),
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, nom: true, description: true, organisation: true,
      secteur: true, statut: true, atelierCourant: true,
      isSocle: true, socleId: true,
      socle: { select: { id: true, nom: true } },
      createdAt: true, updatedAt: true,
      _count: { select: { sourcesRisque: true, scenariosStrategiques: true, risques: true, mesures: true } },
      risques: { select: { niveauRisque: true, strategie: true } },
      mesures: { select: { statut: true, priorite: true } },
    },
  })

  return NextResponse.json({ analyses })
}

// POST /api/analyses — créer une analyse
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'
  const __org = await getAnalyseScope(userId, userRole)

  // Le rôle EFFECTIF dans l'organisation active gouverne le droit de créer.
  if (!canCreateAnalyse({ id: userId, role: __org.role })) {
    return NextResponse.json({ error: 'Votre rôle ne permet pas de créer des analyses' }, { status: 403 })
  }
  if (!__org.activeOrgId) {
    return NextResponse.json({ error: 'Aucune organisation active' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    // Si un socleId est fourni, vérifier qu'il existe et que l'utilisateur y a accès
    let socleData: { cadrage?: any; sourcesRisque?: any[] } = {}
    if (data.socleId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const socle = await (prisma.analyse as any).findFirst({
        where: {
          id: data.socleId,
          isSocle: true,
          OR: [
            { userId },
            { accesUtilisateurs: { some: { userId } } },
          ],
        },
        include: {
          cadrage: true,
          sourcesRisque: true,
        },
      })
      if (!socle) {
        return NextResponse.json({ error: 'Analyse socle introuvable ou accès refusé' }, { status: 404 })
      }
      socleData = socle
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analyse = await (prisma.analyse as any).create({
      data: {
        userId,
        organizationId: __org.activeOrgId,
        nom: data.nom,
        description: data.description,
        organisation: data.organisation,
        secteur: data.secteur,
        dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : undefined,
        isSocle: data.isSocle ?? false,
        socleId: data.socleId ?? null,
        // Cadrage : copier du socle ou créer vide
        cadrage: {
          create: socleData.cadrage
            ? {
                perimetre:      socleData.cadrage.perimetre,
                objectifsEtude: socleData.cadrage.objectifsEtude,
                missions:       socleData.cadrage.missions,
                valeursMetier:  socleData.cadrage.valeursMetier,
                biensSupports:  socleData.cadrage.biensSupports,
                // NB: events redoutés et socle de sécurité NE sont PAS hérités —
                // ils dépendent du contexte de chaque analyse.
              }
            : {},
        },
      },
    })

    // Copier les sources de risque du socle si présentes
    if (socleData.sourcesRisque?.length) {
      await prisma.sourceRisque.createMany({
        data: socleData.sourcesRisque.map((sr: any) => {
          const { id: _id, analyseId: _aid, createdAt: _ca, updatedAt: _ua, ...rest } = sr
          return { ...rest, analyseId: analyse.id }
        }),
      })
    }

    await auditLog('ANALYSE_CREATED', {
      userId, userRole,
      targetId: analyse.id, targetType: 'analyse',
      ip: getClientIp(req),
      details: { nom: analyse.nom, socleId: data.socleId ?? null },
    })
    return NextResponse.json({ analyse }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
