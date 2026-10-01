import { populateProjet360 } from '@/lib/projet360.server'
import { resolveProjetSource } from '@/lib/projet360'
import { getServerT } from '@/lib/i18n'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { cleanTags } from '@/lib/analyse-tags'
import { canCreateAnalyse, analyseWhereClause } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { isSousSecteurOfSecteur } from '@/lib/sous-secteurs'
import { MENTIONS_PROTECTION, normalizeMentionProtection } from '@/lib/mention-protection'
import { resolveMethodes, isRiskMethod } from '@/lib/methodes'
import { getActiveMethodes } from '@/lib/interfaces-config.server'
import { checkAnalyseCreation } from '@/lib/analyse-create-guard.server'
import { withRiskSummary } from '@/lib/analyses-summary.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { sanitizeQualification } from '@/lib/qualification'

const createSchema = z.object({
  nom:          z.string().min(1).max(200),
  description:  z.string().max(1000).optional(),
  organisation: z.string().max(200).optional(),
  secteur:      z.string().max(100).optional(),
  sousSecteur:  z.string().max(60).optional(), // id stable de sous-secteur (issue #25)
  tags:         z.array(z.string()).optional(), // tags / programme (regroupement)
  dateEcheance: z.string().optional(),
  socleId:      z.string().cuid().optional(), // analyse socle dont hériter
  isSocle:      z.boolean().optional(),       // marquer cette analyse comme socle
  projetSourceId: z.string().cuid().optional(), // projet 360 dont est issue l'analyse
  mentionProtection: z.enum(MENTIONS_PROTECTION).optional(), // mention de protection (label §3.2)
  methode:      z.string().max(20).optional(), // méthode d'analyse (validée contre l'ensemble effectif)
  qualification: z.record(z.string(), z.union([z.boolean(), z.string()])).optional(),
})

// GET /api/analyses — liste des analyses de l'utilisateur
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'
  const __org = await getAnalyseScope(userId, userRole)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analyses = await prisma.analyse.findMany({
    where: analyseWhereClause(userId, __org.role, __org.scope),
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, nom: true, description: true, organisation: true,
      secteur: true, statut: true, atelierCourant: true, tags: true,
      isSocle: true, socleId: true,
      socle: { select: { id: true, nom: true } },
      createdAt: true, updatedAt: true,
      _count: { select: { sourcesRisque: true, scenariosStrategiques: true, risques: true, mesures: true } },
    },
  })

  // Indicateurs de risque calculés en base (T13) au lieu de renvoyer tous les risques et mesures.
  return NextResponse.json({ analyses: await withRiskSummary(analyses) })
}

// POST /api/analyses — créer une analyse
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'
  // Rôle EFFECTIF dans l'organisation active, organisation active, plafond démo :
  // contrôle partagé avec l'import (lib/analyse-create-guard.server.ts).
  const check = await checkAnalyseCreation(userId, userRole)
  if (!check.ok) {
    const messages = { ROLE: 'Votre rôle ne permet pas de créer des analyses', NO_ORG: 'Aucune organisation active', DEMO_CAP: 'DEMO_ANALYSIS_CAP' } as const
    return NextResponse.json({ error: messages[check.reason] }, { status: 403 })
  }
  const __org = check.scope
  const orgId = check.organizationId

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    // Méthode d'analyse : validée contre l'ensemble EFFECTIF (phase 1 : EBIOS RM
    // seul câblé). Une méthode non proposable retombe sur le défaut — jamais de
    // méthode arbitraire persistée.
    const { available, default: defMethode } = resolveMethodes({ instanceEnabled: await getActiveMethodes() })
    // La qualification peut être saisie dès le choix de méthode. Elle est toujours
    // filtrée avec la configuration effective de l'organisation active.
    const orgConfig = await getOrgConfig(orgId)
    // Projet 360 : piloté par le module d'organisation (onglet Projets), pas par
    // l'activation d'instance des méthodes.
    const methode = data.methode === 'PROJET_360' && orgConfig.projets360Active && orgId
      ? 'PROJET_360'
      : isRiskMethod(data.methode) && available.includes(data.methode) ? data.methode : defMethode
    const qualification = sanitizeQualification(data.qualification, orgConfig.qualificationQuestionnaire)

    // Analyse issue d'un projet 360 : lien ignoré si le module est inactif, 404 si le
    // projet n'est pas accessible (même garde d'accès que la lecture d'une analyse).
    let projetSourceId: string | null = null
    if (data.projetSourceId && methode !== 'PROJET_360') {
      const projet = orgConfig.projets360Active
        ? await prisma.analyse.findFirst({
            where: { AND: [analyseWhereClause(userId, __org.role, __org.scope)], id: data.projetSourceId },
            select: { id: true, methode: true, organizationId: true },
          })
        : null
      const r = resolveProjetSource({ projet, orgId: orgId, projets360Active: orgConfig.projets360Active })
      if (r.status === 'INTROUVABLE') return NextResponse.json({ error: 'Projet introuvable ou accès refusé' }, { status: 404 })
      if (r.status === 'OK') projetSourceId = r.projetId
    }

    // Si un socleId est fourni, vérifier qu'il existe et que l'utilisateur y a accès
    let socleData: { cadrage?: any; sourcesRisque?: any[] } = {}
    if (data.socleId) {
      const socle = await prisma.analyse.findFirst({
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

    const analyse = await prisma.analyse.create({
      data: {
        userId,
        organizationId: orgId,
        nom: data.nom,
        description: data.description,
        organisation: data.organisation,
        secteur: data.secteur,
        // Sous-secteur conservé seulement s'il est cohérent avec le secteur.
        sousSecteur: isSousSecteurOfSecteur(data.secteur, data.sousSecteur) ? data.sousSecteur : null,
        tags: cleanTags(data.tags),
        dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : undefined,
        isSocle: data.isSocle ?? false,
        socleId: data.socleId ?? null,
        projetSourceId,
        mentionProtection: normalizeMentionProtection(data.mentionProtection),
        methode,
        qualification,
        // Cadrage : copier du socle ou créer vide
        cadrage: {
          create: methode === 'PROJET_360' && !socleData.cadrage
            ? { perimetre: data.description ?? null }
            : socleData.cadrage
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

    // Projet 360 : questionnaire pré-rempli d'après les données existantes et risques
    // proposés créés sans doublon (lib/projet360.server).
    let population: { answers: number; risks: number } | null = null
    if (methode === 'PROJET_360' && orgId) {
      population = await populateProjet360(analyse.id, orgId, await getServerT())
    }

    await auditLog('ANALYSE_CREATED', {
      userId, userRole,
      targetId: analyse.id, targetType: 'analyse',
      ip: getClientIp(req),
      details: { nom: analyse.nom, socleId: data.socleId ?? null, ...(projetSourceId ? { projetSourceId } : {}), ...(population ? { methode, population } : {}) },
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
