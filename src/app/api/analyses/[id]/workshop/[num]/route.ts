import { missingExclusionJustifications } from '@/lib/conformite'
import { NextResponse } from 'next/server'
import { dedupeQualificationRuleIds } from '@/lib/qualification-risks'
import { prisma } from '@/lib/prisma'
import { withAccess, type AccessContext } from '@/lib/with-access.server'
import { revisionField, parseIfMatch } from '@/lib/atelier-revision'
import {
  cleanSourceRisque,
  cleanPartiePrenante,
  cleanScenarioStrategique,
  cleanScenarioOperationnel,
} from '@/lib/workshop-sanitize'
import { normalizeCategorieMesure } from '@/lib/mesure-categorie'
import { touchOrgActivity } from '@/lib/demo-server'
import { atelierApresAvancement } from '@/lib/analyse-avancement'
import { sanitizeTierLinks } from '@/lib/tier-registry.server'

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
/**
 * Contrôles communs à la sauvegarde et à l'avancement. withAccess (write) : session (401), analyse dans le
 * périmètre et hors corbeille (404), édition sur le rôle EFFECTIF dans l'organisation de l'analyse (F01, CWE-863 ;
 * 403) et gel après acceptation des risques résiduels (403 ANALYSE_GELEE ; réouverture = nouvelle version).
 */
const access = { org: { analyse: 'id', write: true }, rateLimit: { bucket: 'analyse-workshop' } } as const

/** Contrôle complémentaire : analyse approuvée non modifiable, sauf ADMIN (rôle d'INSTANCE, inchangé). */
function controleStatut({ user, analyse, params }: AccessContext<typeof access.org, undefined>) {
  // Bloquer les modifications si l'analyse est approuvée
  if (analyse.statut === 'APPROUVE' && user.role !== 'ADMIN') {
    return { ok: false as const, error: NextResponse.json({ error: 'L\'analyse est approuvée et ne peut plus être modifiée' }, { status: 403 }) }
  }
  return { ok: true as const, analyseId: analyse.id, atelierNum: parseInt(params.num), analyse }
}

export const PUT = withAccess(access, async (req, ctx) => {
  const c = controleStatut(ctx)
  if (!c.ok) return c.error
  const { analyseId, atelierNum, analyse } = c

  const body = await req.json()

  // Borne la cardinalité des tableaux persistés en masse (audit R03 / CWE-400) :
  // un createMany sur un tableau non borné = DoS mémoire/CPU. 2000 items/atelier
  // est très au-delà d'un usage réel (une analyse volumineuse ~ dizaines d'items).
  const MAX_ENTITIES = 2000
  for (const k of ['sourcesRisque', 'partiesPrenantes', 'scenariosStrategiques', 'scenariosOperationnels', 'risques', 'mesures'] as const) {
    if (Array.isArray(body[k]) && body[k].length > MAX_ENTITIES) body[k] = body[k].slice(0, MAX_ENTITIES)
  }

  // Normalise les types de mesures provenant des référentiels (ControlType → TypeMesure).
  // HUMAINE et PHYSIQUE → ORGANISATIONNELLE, TECHNOLOGIQUE → TECHNIQUE.
  // Defense-in-depth : le frontend fait déjà ce mapping, mais on l'assure côté serveur.
  function normalizeMesureType(type: string): string {
    if (type === 'HUMAINE' || type === 'PHYSIQUE') return 'ORGANISATIONNELLE'
    if (type === 'TECHNOLOGIQUE') return 'TECHNIQUE'
    return type
  }

  // Verrou optimiste (T9) : la révision attendue (`If-Match`) est comparée et incrémentée atomiquement ;
  // un autre éditeur a enregistré entre-temps → 409 CONFLIT_EDITION (rien n'est écrasé).
  const champ = revisionField(atelierNum)
  if (!champ) return NextResponse.json({ error: 'Atelier invalide' }, { status: 400 })
  const attendue = parseIfMatch(req.headers.get('if-match'))
  const cas = await prisma.analyse.updateMany({
    where: { id: analyseId, ...(attendue !== null ? { [champ]: attendue } : {}) },
    data: { [champ]: { increment: 1 } },
  })
  if (cas.count === 0) {
    const courante = await prisma.analyse.findUnique({ where: { id: analyseId }, select: { [champ]: true } })
    return NextResponse.json({ error: 'CONFLIT_EDITION', revision: courante?.[champ] ?? null }, { status: 409 })
  }

  const enregistrer = async (): Promise<NextResponse> => {
  try {
    // Recette n° 14 : la sauvegarde (y compris automatique) ne fait PAS avancer l'atelier courant ; l'avancement passe
    // par POST (« Passer à l'atelier suivant »).

    switch (atelierNum) {
      case 1: {
        // A1 : upsert simple — pas de delete, pas besoin de transaction
        const { referentielMesures, ...cadrageData } = body
        if (missingExclusionJustifications(cadrageData.socleSecurite).length) {
          return NextResponse.json({ error: 'NA_JUSTIFICATION_REQUIRED' }, { status: 400 })
        }
        await prisma.cadrage.upsert({
          where: { analyseId },
          create: { analyseId, ...cadrageData },
          update: cadrageData,
        })
        await prisma.analyse.update({
          where: { id: analyseId },
          data: {
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
            data: { updatedAt: new Date() },
          }),
        ])
        break
      }

      case 3: {
        // A3 : parties prenantes + scénarios stratégiques en une seule transaction
        // Liens vers les identités de tiers : seuls ceux autorisés pour l'organisation de l'analyse sont conservés.
        const parties = await sanitizeTierLinks<ReturnType<typeof cleanPartiePrenante>>((body.partiesPrenantes ?? []).map((p: any) => cleanPartiePrenante(p, analyseId)), analyse.organizationId)
        await prisma.$transaction([
          prisma.partiePrenante.deleteMany({ where: { analyseId } }),
          ...(parties.rows.length
            ? [prisma.partiePrenante.createMany({
                data: parties.rows,
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
            data: { updatedAt: new Date() },
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
            data: { updatedAt: new Date() },
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
                // Règle de qualification unique par analyse : dédoublonnée pour ne
                // jamais faire échouer la sauvegarde sur la contrainte unique.
                data: dedupeQualificationRuleIds(body.risques as any[]).map((r: any) => {
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
            data: { updatedAt: new Date() },
          }),
        ])
        break
      }

      default:
        return NextResponse.json({ error: 'Atelier invalide' }, { status: 400 })
    }

    // Mode démo : sauvegarder une analyse compte comme activité de l'org (repousse la purge). No-op hors démo.
    await touchOrgActivity(analyse.organizationId).catch(() => { /* best-effort */ })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }
  }

  const res = await enregistrer()
  if (res.status !== 200) {
    // Rien n'a été enregistré : la révision revient à sa valeur (best-effort).
    await prisma.analyse.updateMany({ where: { id: analyseId, [champ]: { gt: 0 } }, data: { [champ]: { decrement: 1 } } }).catch(() => { /* best-effort */ })
    return res
  }
  const apres = await prisma.analyse.findUnique({ where: { id: analyseId }, select: { [champ]: true } })
  return NextResponse.json({ ok: true, revision: apres?.[champ] ?? null })
})

/**
 * POST /api/analyses/[id]/workshop/[num] — « Passer à l'atelier suivant » (recette n° 14) : seul point qui fait avancer
 * l'atelier courant (lib/analyse-avancement : jamais de recul, plafond 5). Mêmes contrôles que la sauvegarde.
 */
export const POST = withAccess(access, async (_req, ctx) => {
  const c = controleStatut(ctx)
  if (!c.ok) return c.error
  const row = await prisma.analyse.findFirst({ where: { id: c.analyseId }, select: { atelierCourant: true } })
  if (!row) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })
  const courant = row.atelierCourant
  const atelierCourant = atelierApresAvancement(courant, c.atelierNum)
  if (atelierCourant !== courant) await prisma.analyse.update({ where: { id: c.analyseId }, data: { atelierCourant } })
  return NextResponse.json({ ok: true, atelierCourant })
})

