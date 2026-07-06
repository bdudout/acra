import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere } from '@/lib/org-context.server'
import { canEditAnalyse } from '@/lib/permissions'
import {
  cleanSourceRisque,
  cleanPartiePrenante,
  cleanScenarioStrategique,
  cleanScenarioOperationnel,
} from '@/lib/workshop-sanitize'
import { normalizeCategorieMesure } from '@/lib/mesure-categorie'

/**
 * PUT /api/analyses/[id]/workshop/[num]
 *
 * Persists the data for one EBIOS RM workshop (atelier) to the database.
 * Called automatically by the useAutoSave hook in each Atelier component.
 *
 * Route params:
 *  - id  : analyse ID (cuid)
 *  - num : workshop number 1–5
 *
 * Strategy per workshop:
 *  - A1 : upsert Cadrage record; referentielMesures is stored on Analyse directly
 *  - A2 : delete-all + createMany for SourceRisque
 *  - A3 : delete-all + createMany for PartiePrenante + ScenarioStrategique
 *  - A4 : delete-all + createMany for ScenarioOperationnel
 *  - A5 : delete-all + createMany for Risque + Mesure
 *
 * UI-only fields (labels, computed names) are stripped before DB writes via
 * destructuring to avoid Prisma "Unknown argument" errors.
 *
 * After saving, atelierCourant is advanced by 1 (capped at 5) to unlock the
 * next workshop in the progress bar.
 *
 * Requires:
 *  - Valid session (401 otherwise)
 *  - EDITION or APPROBATION permission on the analyse (403 otherwise)
 *  - Analyse must not be in APPROUVE status unless caller is ADMIN (403)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; num: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id: analyseId, num } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'
  const atelierNum = parseInt(num)

  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, userRole, analyseId),
    include: { accesUtilisateurs: true },
  })
  // Analyse en corbeille (soft delete) = introuvable : interdit de sauvegarder dessus.
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  if (!canEditAnalyse({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé — édition non autorisée' }, { status: 403 })
  }

  // Bloquer les modifications si l'analyse est approuvée
  if (analyse.statut === 'APPROUVE' && userRole !== 'ADMIN') {
    return NextResponse.json({ error: 'L\'analyse est approuvée et ne peut plus être modifiée' }, { status: 403 })
  }

  const body = await req.json()

  // Normalise les types de mesures provenant des référentiels (ControlType → TypeMesure).
  // HUMAINE et PHYSIQUE → ORGANISATIONNELLE, TECHNOLOGIQUE → TECHNIQUE.
  // Defense-in-depth : le frontend fait déjà ce mapping, mais on l'assure côté serveur.
  function normalizeMesureType(type: string): string {
    if (type === 'HUMAINE' || type === 'PHYSIQUE') return 'ORGANISATIONNELLE'
    if (type === 'TECHNOLOGIQUE') return 'TECHNIQUE'
    return type
  }

  try {
    // ── Avancement de l'atelier courant (commun à tous les cas) ────────────
    const newAtelier = Math.max(analyse.atelierCourant, Math.min(atelierNum + 1, 5))

    switch (atelierNum) {
      case 1: {
        // A1 : upsert simple — pas de delete, pas besoin de transaction
        const { referentielMesures, ...cadrageData } = body
        await prisma.cadrage.upsert({
          where: { analyseId },
          create: { analyseId, ...cadrageData },
          update: cadrageData,
        })
        await prisma.analyse.update({
          where: { id: analyseId },
          data: {
            atelierCourant: newAtelier,
            updatedAt: new Date(),
            ...(referentielMesures !== undefined ? { referentielMesures } : {}),
          },
        })
        break
      }

      // [F006 corrigé] CWE-915 — A2/A3/A4 passent désormais par une allowlist explicite
      // (src/lib/workshop-sanitize.ts), comme A5 et import/route.ts : seuls les champs du
      // schéma Prisma sont retenus, typés et bornés. Tout champ hors-schéma est ignoré.
      case 2: {
        // A2 : delete+create dans une transaction atomique
        await prisma.$transaction([
          prisma.sourceRisque.deleteMany({ where: { analyseId } }),
          ...(body.sourcesRisque?.length
            ? [prisma.sourceRisque.createMany({
                data: body.sourcesRisque.map((s: any) => cleanSourceRisque(s, analyseId)),
              })]
            : []),
          prisma.analyse.update({
            where: { id: analyseId },
            data: { atelierCourant: newAtelier, updatedAt: new Date() },
          }),
        ])
        break
      }

      case 3: {
        // A3 : parties prenantes + scénarios stratégiques en une seule transaction
        await prisma.$transaction([
          prisma.partiePrenante.deleteMany({ where: { analyseId } }),
          ...(body.partiesPrenantes?.length
            ? [prisma.partiePrenante.createMany({
                data: body.partiesPrenantes.map((p: any) => cleanPartiePrenante(p, analyseId)),
              })]
            : []),
          prisma.scenarioStrategique.deleteMany({ where: { analyseId } }),
          ...(body.scenariosStrategiques?.length
            ? [prisma.scenarioStrategique.createMany({
                data: body.scenariosStrategiques.map((s: any) => cleanScenarioStrategique(s, analyseId)),
              })]
            : []),
          prisma.analyse.update({
            where: { id: analyseId },
            data: { atelierCourant: newAtelier, updatedAt: new Date() },
          }),
        ])
        break
      }

      case 4: {
        // A4 : scénarios opérationnels en transaction
        await prisma.$transaction([
          prisma.scenarioOperationnel.deleteMany({ where: { analyseId } }),
          ...(body.scenariosOperationnels?.length
            ? [prisma.scenarioOperationnel.createMany({
                data: body.scenariosOperationnels.map((s: any) => cleanScenarioOperationnel(s, analyseId)),
              })]
            : []),
          prisma.analyse.update({
            where: { id: analyseId },
            data: { atelierCourant: newAtelier, updatedAt: new Date() },
          }),
        ])
        break
      }

      case 5: {
        // A5 : risques + mesures en une seule transaction atomique
        await prisma.$transaction([
          prisma.risque.deleteMany({ where: { analyseId } }),
          ...(body.risques?.length
            ? [prisma.risque.createMany({
                data: body.risques.map((r: any) => {
                  const {
                    id: _id, analyseId: _aid, analyse: _rel,
                    createdAt: _ca, updatedAt: _ua, scenarioOpNom: _son,
                    ...rest
                  } = r
                  return { ...rest, analyseId }
                }),
              })]
            : []),
          prisma.mesure.deleteMany({ where: { analyseId } }),
          ...(body.mesures?.length
            ? [prisma.mesure.createMany({
                data: body.mesures.map((m: any) => {
                  // Allowlist explicite des champs acceptés (sécurité : évite mass assignment)
                  return {
                    analyseId,
                    nom:         String(m.nom        ?? '').slice(0, 255),
                    description: m.description != null ? String(m.description).slice(0, 2000) : undefined,
                    type:        normalizeMesureType(m.type),
                    priorite:    Number(m.priorite)    || 2,
                    statut:      String(m.statut       ?? 'A_FAIRE'),
                    responsable: m.responsable != null ? String(m.responsable).slice(0, 200) : undefined,
                    entite:      m.entite      != null ? String(m.entite).trim().slice(0, 100) : undefined,
                    echeance:    m.echeance             ? new Date(m.echeance) : undefined,
                    risqueId:    m.risqueId    != null ? String(m.risqueId) : undefined,
                    cout:        m.cout        != null ? String(m.cout).slice(0, 100) : undefined,
                    efficacite:  m.efficacite  != null ? Number(m.efficacite) : undefined,
                    categorieEbios: normalizeCategorieMesure(m.categorieEbios),
                    referentiel: m.referentiel != null ? String(m.referentiel).slice(0, 100) : undefined,
                    codeRef:     m.codeRef     != null ? String(m.codeRef).slice(0, 50) : undefined,
                  }
                }),
              })]
            : []),
          prisma.analyse.update({
            where: { id: analyseId },
            data: { atelierCourant: newAtelier, updatedAt: new Date() },
          }),
        ])
        break
      }

      default:
        return NextResponse.json({ error: 'Atelier invalide' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }
}
