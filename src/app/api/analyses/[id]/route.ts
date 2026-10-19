import { sanitizeAnswers360 } from '@/lib/projet360'
import { dateSaisie } from '@/lib/date-saisie'
import { sanitizeMeteo } from '@/lib/projet-meteo'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canViewAnalyse, canEditAnalyse, isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { sanitizeQualification } from '@/lib/qualification'
import { resolveSousSecteursUpdate } from '@/lib/sous-secteurs'
import { normalizePatterns } from '@/lib/patterns-archi'
import { mergePrefill, prefillFromPatterns } from '@/lib/projet360'
import { normalizeMentionProtection } from '@/lib/mention-protection'
import { normalizeMethode } from '@/lib/vraisemblance-methode'

// GET /api/analyses/:id — détail complet
// L'analyse est chargée dans le périmètre (analyseAccessWhere) par withAccess : hors périmètre ou en corbeille
// (soft delete, récupérable via /admin/recovery) → 404 pour tous.
export const GET = withAccess({ org: { analyse: 'id' } }, async (_req, { user, role, analyse: acces }) => {
  const analyse = await prisma.analyse.findFirst({
    where: { id: acces.id },
    include: {
      cadrage: true,
      sourcesRisque: true,
      partiesPrenantes: true,
      scenariosStrategiques: true,
      scenariosOperationnels: true,
      risques: true,
      mesures: true,
      accesUtilisateurs: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  })

  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  // F01 (CWE-863) : lecture ET édition se décident sur le rôle EFFECTIF dans
  // l'organisation de l'analyse (pas le rôle d'instance) — un rôle de gouvernance
  // GLOBAL (RSSI/AUDITEUR…) ne doit pas ouvrir la lecture d'une analyse d'une org
  // où le rôle effectif de l'utilisateur est inférieur. Cohérent avec PATCH/DELETE.
  // `role` = rôle effectif dans l'organisation de l'analyse (resolveAnalyseRole, via withAccess).
  if (!canViewAnalyse({ id: user.id, role }, { userId: acces.userId, accesUtilisateurs: acces.accesUtilisateurs, statut: acces.statut })) {
    return NextResponse.json({ error: 'ACCES_ANALYSE_REFUSE' }, { status: 403 })
  }

  const editable = canEditAnalyse({ id: user.id, role }, { userId: acces.userId, accesUtilisateurs: acces.accesUtilisateurs })

  return NextResponse.json({ analyse, editable })
})

// PATCH /api/analyses/:id — modifier les infos générales ou le statut
// withAccess (write) : analyse dans le périmètre (404), édition sur le rôle EFFECTIF dans l'organisation de
// l'analyse (F01, CWE-863 ; 403) et analyse non gelée (403 ANALYSE_GELEE).
export const PATCH = withAccess({ org: { analyse: 'id', write: true }, rateLimit: { bucket: 'analyses' } }, async (req, { analyse: acces, params: { id } }) => {
  const existing = await prisma.analyse.findFirst({ where: { id: acces.id } })
  if (!existing || existing.deletedAt) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  const body = await req.json()
  const allowed = ['nom', 'description', 'organisation', 'secteur', 'sousSecteur', 'atelierCourant', 'dateEcheance', 'referentielMesures', 'isSocle']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }
  // Météo d'un projet 360 (chef de projet) : valeur connue ou effacement ; horodatée.
  if ('meteoProjet' in body) {
    const m = sanitizeMeteo(body.meteoProjet)
    if (m === undefined) return NextResponse.json({ error: 'meteo_inconnue' }, { status: 400 })
    data.meteoProjet = m
    data.meteoProjetLe = m ? new Date() : null
  }
  // Date d'échéance (mise en service d'un projet 360) : champ date normalisé, valeur illisible ignorée.
  if ('dateEcheance' in data) {
    const d = dateSaisie(data.dateEcheance)
    if (d === undefined) delete data.dateEcheance; else data.dateEcheance = d
  }
  // Démarche Flash mémorisée sur l'analyse (recette n° 16) — booléen strict.
  if ('demarcheFlash' in body) data.demarcheFlash = body.demarcheFlash === true
  // Mention de protection (label EBIOS RM §3.2) — normalisée vers un niveau connu.
  if ('mentionProtection' in body) {
    data.mentionProtection = normalizeMentionProtection(body.mentionProtection)
  }
  // Override de portée de conformité propre à l'analyse : 'ANALYSE' | 'ORGANISATION'
  // (autre / vide → null = suivre la config de l'organisation).
  if ('conformitePortee' in body) {
    data.conformitePortee = (body.conformitePortee === 'ANALYSE' || body.conformitePortee === 'ORGANISATION') ? body.conformitePortee : null
  }
  // Méthode d'évaluation de la vraisemblance (label §EXI_M4_07).
  if ('methodeVraisemblance' in body) {
    data.methodeVraisemblance = normalizeMethode(body.methodeVraisemblance)
  }
  // Cohérence secteur ↔ sous-secteurs (issue #25) : on ne retient que les sous-secteurs cohérents avec le secteur
  // effectif (nouveau ou existant) ; la liste prime sur l'ancien champ unique ; le premier devient le principal.
  if ('sousSecteurs' in body || 'sousSecteur' in data || 'secteur' in data) {
    const secteurEff = ('secteur' in data ? data.secteur : existing.secteur) as string | null
    const input = 'sousSecteurs' in body ? { sousSecteurs: body.sousSecteurs } : 'sousSecteur' in data ? { sousSecteur: data.sousSecteur } : {}
    Object.assign(data, resolveSousSecteursUpdate({ secteur: secteurEff, input, existing }))
  }
  // Patterns d'architecture (vision technique, indépendante du secteur) : codes connus, sans doublon, plafond de
  // l'organisation (défaut 12) ; une liste plus longue est refusée.
  if ('patternsArchi' in body) {
    const orgId = (existing as { organizationId?: string | null }).organizationId
    const cfg = orgId ? await getOrgConfig(orgId) : null
    try { data.patternsArchi = normalizePatterns(body.patternsArchi, { max: cfg?.patternsArchiMax, strict: true }) }
    catch { return NextResponse.json({ error: 'patterns_too_many' }, { status: 400 }) }
  }
  // statut seulement si EN_COURS→TERMINE (pas les statuts d'approbation qui passent par /approbation)
  if (body.statut === 'TERMINE' || body.statut === 'EN_COURS' || body.statut === 'ARCHIVE') {
    data.statut = body.statut
    if (body.statut === 'EN_COURS' && existing.statut !== 'EN_COURS') {
      data.approbateurId = null
      data.approuveLe = null
      data.commentaireApprobation = null
      data.approbations = []
    }
  }
  // Questionnaire de qualification (optionnel) — filtré aux questions effectives
  // (natives activées + personnalisées) selon la config de l'organisation.
  if ('qualification' in body) {
    const qCfg = (existing as { organizationId?: string | null }).organizationId
      ? await getOrgConfig((existing as { organizationId: string }).organizationId)
      : null
    // Les réponses du questionnaire 360 (`p360.*`, route dédiée) sont conservées.
    data.qualification = { ...sanitizeAnswers360(existing.qualification), ...sanitizeQualification(body.qualification, qCfg?.qualificationQuestionnaire) }
  }

  // Projet 360 : les patterns cochés pré-remplissent les réponses correspondantes du questionnaire, SANS écraser une réponse donnée.
  if (Array.isArray(data.patternsArchi) && (existing as { methode?: string }).methode === 'PROJET_360') {
    const base = (data.qualification ?? (existing as { qualification?: unknown }).qualification) as Record<string, unknown> | null
    const current = base && typeof base === 'object' && !Array.isArray(base) ? base : {}
    const merged = mergePrefill(current, prefillFromPatterns(data.patternsArchi as string[]))
    if (Object.keys(merged.sources).length) {
      const prev = (current['p360._sources'] && typeof current['p360._sources'] === 'object' ? current['p360._sources'] : {}) as Record<string, unknown>
      data.qualification = { ...merged.answers, 'p360._sources': { ...prev, ...merged.sources } }
    }
  }

  const updated = await prisma.analyse.update({ where: { id }, data })
  return NextResponse.json({ analyse: updated })
})

// DELETE /api/analyses/:id — seul le propriétaire ou ADMIN peut supprimer
// Pas de contrôle de gel (inchangé) : la suppression relève du propriétaire / de l'administrateur.
export const DELETE = withAccess({ org: { analyse: 'id' }, rateLimit: { bucket: 'analyses' } }, async (req, { user, role, analyse: acces, params: { id } }) => {
  const userId = user.id
  const userRole = user.role

  // F01 (CWE-863) : « ADMIN » s'entend du rôle EFFECTIF dans l'organisation de
  // l'analyse (`role`, résolu par withAccess) — un admin d'un autre périmètre ne peut pas supprimer ici.
  // Seul le propriétaire ou un ADMIN (effectif) peut supprimer
  if (acces.userId !== userId && !isAdminRole(role)) {
    return NextResponse.json({ error: 'Seul le propriétaire peut supprimer cette analyse' }, { status: 403 })
  }

  // Suppression DOUCE : l'analyse disparaît des vues mais reste récupérable par un
  // ADMIN pendant 30 jours (module Récupération). cf. lib/recovery.ts.
  const existing = await prisma.analyse.findFirst({ where: { id: acces.id }, select: { nom: true } })
  if (!existing) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })
  await prisma.analyse.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId } })
  await auditLog('ANALYSE_DELETED', {
    userId, userRole,
    targetId: id, targetType: 'analyse',
    ip: getClientIp(req),
    details: { nom: existing.nom, soft: true },
  })
  return NextResponse.json({ ok: true })
})
