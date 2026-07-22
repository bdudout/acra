import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere, countOrgMembers } from '@/lib/org-context.server'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { ATELIERS_META, getNiveauRisqueLabel } from '@/lib/ebios-data'

// Désactiver le cache Next.js pour toujours afficher les données fraîches
export const dynamic = 'force-dynamic'
export const revalidate = 0
import RiskMatrixTabs from '@/components/RiskMatrixTabs'
import EcosystemRadar from '@/components/EcosystemRadar'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { getOrgConfig } from '@/lib/org-config.server'
import AccessPanel from '@/components/AccessPanel'
import PDFExportButton from '@/components/PDFExportButton'
import SocleToggle from '@/components/SocleToggle'
import QualificationPanel from '@/components/QualificationPanel'
import ConformitePie from '@/components/ConformitePie'
import { isQualificationComplete, sanitizeQualification } from '@/lib/qualification'
import { sanitizeConformite, conformiteStats, marquerDerogations } from '@/lib/conformite'
import { getConformiteContext } from '@/lib/conformite.server'
import { derogRefsActives } from '@/lib/derogation.server'
import { getFrameworkControles, FRAMEWORK_META, type FrameworkId } from '@/lib/frameworks-data'
import { getServerT, getServerLocale } from '@/lib/i18n'
import { normalizeMentionProtection, isProtectedMention } from '@/lib/mention-protection'
import { formatVersion } from '@/lib/version-analyse'
import RevisionPanel from '@/components/RevisionPanel'
import { formatDate } from '@/lib/format'
import {
  canViewAnalyse, canEditAnalyse, canSubmitAnalyse,
  canApproveAnalyse, canAutoValidateAnalyse, canManageAccess, canAcceptResidualRisks, STATUT_APPROBATION_LABELS,
  type UserRole,
} from '@/lib/permissions'
import ResidualRisksPanel from '@/components/ResidualRisksPanel'
import DerogationsPanel from '@/components/DerogationsPanel'

export default async function AnalyseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const t = await getServerT()
  const locale = await getServerLocale()

  const { id } = await params
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analyse = await (prisma.analyse as any).findFirst({
    where: await analyseAccessWhere(userId, userRole, id),
    include: {
      cadrage: true,
      sourcesRisque: true,
      partiesPrenantes: true,
      scenariosStrategiques: true,
      scenariosOperationnels: true,
      risques: true,
      mesures: true,
      accesUtilisateurs: true,
      user: { select: { id: true, name: true, email: true } },
      socle: { select: { id: true, nom: true, referentielMesures: true, cadrage: { select: { socleSecurite: true, customControles: true } } } },
      _count: { select: { heritiers: true } },
    },
  })

  if (!analyse) notFound()

  // Vérification des permissions
  const ownership = { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs }
  const sessionUser = { id: userId, role: userRole }

  if (!canViewAnalyse(sessionUser, ownership)) notFound()

  const editable = canEditAnalyse(sessionUser, ownership)
  const canSubmit = canSubmitAnalyse(sessionUser, ownership)
  const canApprove = canApproveAnalyse(sessionUser, ownership)
  const canManage = canManageAccess(sessionUser, ownership)
  // Organisation mono-utilisateur (cabinet libéral) → auto-validation directe.
  const orgMemberCount = await countOrgMembers((analyse as any).organizationId)
  const canAutoValidate = canAutoValidateAnalyse(sessionUser, ownership, orgMemberCount)

  // Échelle/seuils configurés (admin) pour piloter la matrice des risques
  const scaleConfig = await getEffectiveScaleConfig((analyse as any).organizationId)

  // Fonctionnalité optionnelle : questionnaire de qualification (cf. OrganizationConfig)
  // Config résolue par l'organisation de l'analyse (héritage des ancêtres).
  const orgConfig = await getOrgConfig((analyse as any).organizationId)
  const qualificationActive = orgConfig.qualificationActive

  // Camembert de conformité au référentiel : niveau ORGANISATION (entité), sinon
  // conformité propre de l'analyse ou héritée du socle. Résolution org-aware.
  const socleForConf = (analyse as any).socle as { id: string; nom: string; referentielMesures?: string; cadrage?: { socleSecurite?: unknown; customControles?: unknown } } | null
  const confCtxDetail = await getConformiteContext({
    organizationId: (analyse as any).organizationId,
    referentielMesures: (analyse as any).referentielMesures,
    ownEntries: analyse.cadrage ? sanitizeConformite((analyse.cadrage as any).socleSecurite) : [],
    socle: socleForConf?.cadrage
      ? { id: socleForConf.id, nom: socleForConf.nom, referentielMesures: socleForConf.referentielMesures, entries: sanitizeConformite(socleForConf.cadrage.socleSecurite) }
      : null,
    conformiteNiveau: orgConfig.conformiteNiveau,
  })
  let conformitePie: { stats: ReturnType<typeof conformiteStats>; frameworkNom: string; note: string | null } | null = null
  if (orgConfig.conformiteActive && confCtxDetail.entries.length > 0) {
    const custom = (confCtxDetail.level === 'ANALYSE'
      ? (analyse.cadrage as any)?.customControles
      : confCtxDetail.level === 'SOCLE' ? socleForConf?.cadrage?.customControles : undefined) as any[]
    const controles = getFrameworkControles(confCtxDetail.referentiel as FrameworkId, custom, locale)
    const note = confCtxDetail.level === 'ORGANISATION'
      ? t.analysis.conformiteOrgNote.replace('{org}', confCtxDetail.sourceNom ?? '—')
      : confCtxDetail.level === 'SOCLE'
        ? t.analysis.conformiteInheritedNote.replace('{socle}', confCtxDetail.sourceNom ?? '—')
        : null
    // Marque les contrôles dérogés (non-conformité couverte par une dérogation active).
    let confEntries = confCtxDetail.entries
    if (orgConfig.derogationsActive) {
      const refs = await derogRefsActives({
        referentiel: String(confCtxDetail.referentiel),
        analyseId: confCtxDetail.level === 'ORGANISATION' ? null : analyse.id,
        organizationId: confCtxDetail.level === 'ORGANISATION' ? (analyse as any).organizationId : null,
      })
      confEntries = marquerDerogations(confEntries, refs)
    }
    conformitePie = {
      stats: conformiteStats(confEntries, controles.length),
      frameworkNom: FRAMEWORK_META[confCtxDetail.referentiel as FrameworkId]?.nom ?? String(confCtxDetail.referentiel),
      note,
    }
  }
  const qualificationObligatoire = orgConfig.qualificationObligatoire
  const qualificationComplete = isQualificationComplete(sanitizeQualification((analyse as any).qualification))

  // Verrouillage si analyse approuvée (sauf ADMIN)
  const locked = analyse.statut === 'APPROUVE' && userRole !== 'ADMIN'
  const isOwner = analyse.userId === userId

  // Mettre la qualification en avant (avant les ateliers) tant qu'elle est incomplète.
  const qualificationPrompt = qualificationActive && editable && !locked && !qualificationComplete

  const pct = analyse.statut === 'TERMINE' ? 100 : Math.round(((analyse.atelierCourant - 1) / 5) * 100)
  // Ateliers localisés : structure (num, icône, couleur) de ATELIERS_META + texte traduit (t.ateliersMeta)
  const ateliersL = ATELIERS_META.map((a, i) => ({ ...a, ...(t.ateliersMeta[i] ?? {}) }))
  const currentAtelier = ateliersL[analyse.atelierCourant - 1]
  const statutInfo = STATUT_APPROBATION_LABELS[analyse.statut] ?? STATUT_APPROBATION_LABELS.EN_COURS

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/analyses" className="text-gray-500 hover:text-gray-600 text-sm">{t.analysis.backToList}</Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{analyse.nom}</h1>
            {(analyse.organisation || analyse.secteur) && (
              <p className="text-gray-500 mt-1">{[analyse.organisation, analyse.secteur].filter(Boolean).join(' · ')}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statutInfo.color}`}>
                {statutInfo.icon} {(t.statusLabels as Record<string, string>)[analyse.statut] ?? statutInfo.label}
              </span>
              {isProtectedMention((analyse as any).mentionProtection) && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700">
                  🛡️ {t.mentionProtection.levels[normalizeMentionProtection((analyse as any).mentionProtection)]}
                </span>
              )}
              {!isOwner && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  👤 {t.analysis.sharedBy} {analyse.user?.name ?? analyse.user?.email}
                </span>
              )}
              <span className="text-sm text-gray-500">
                {t.analysis.modifiedOn} {formatDate(analyse.updatedAt, locale)}
              </span>
              {locked && (
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                  🔒 {t.analysis.readOnly}
                </span>
              )}
              {(analyse as any).isSocle && (
                <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
                  🏛️ Analyse socle
                </span>
              )}
              {(analyse as any).socle && (
                <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                  🔗 Hérite de : <Link href={`/analyses/${(analyse as any).socle.id}`} className="underline hover:text-indigo-900">{(analyse as any).socle.nom}</Link>
                </span>
              )}
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-mono">
                v{formatVersion((analyse as any).versionMajeure ?? 1, (analyse as any).versionMineure ?? 0)}
              </span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {editable && !locked && (
              <Link
                href={`/analyses/${analyse.id}/atelier/${analyse.atelierCourant}`}
                className="btn-primary"
              >
                {analyse.statut === 'TERMINE' ? t.analysis.editBtn : `${t.analysis.resumePrefix} ${analyse.atelierCourant})`}
              </Link>
            )}
            {!editable && (
              <Link
                href={`/analyses/${analyse.id}/atelier/1`}
                className="btn-secondary"
              >
                {t.analysis.viewBtn}
              </Link>
            )}
            {/* Export disponible pour toutes les analyses */}
            <>
              <PDFExportButton analyseId={analyse.id} />
              <a href={`/api/export/${analyse.id}?format=xlsx`} className="btn-secondary">
                📗 Excel
              </a>
              <a href={`/api/export/${analyse.id}?format=csv`} className="btn-secondary">
                📊 CSV
              </a>
              <a href={`/api/export/${analyse.id}?format=json`} className="btn-secondary">
                🗂 JSON
              </a>
            </>
          </div>
        </div>

        {/* Versions & révisions (label EBIOS RM §3.4) */}
        <div className="mb-6">
          <RevisionPanel
            analyseId={analyse.id}
            initialVersion={formatVersion((analyse as any).versionMajeure ?? 1, (analyse as any).versionMineure ?? 0)}
            canRevise={editable && !locked}
          />
        </div>

        {/* Qualification mise en avant AVANT les ateliers tant qu'incomplète
            (facultative ou — si configuré — obligatoire avant l'atelier 1). */}
        {qualificationPrompt && (
          <div className={`mb-6 rounded-xl border p-4 ${qualificationObligatoire ? 'border-amber-300 bg-amber-50' : 'border-ebios-200 bg-ebios-50'}`}>
            <div className="flex items-start gap-3 mb-3">
              <span className="text-xl" aria-hidden="true">{qualificationObligatoire ? '⚠️' : '🧭'}</span>
              <div>
                <p className={`text-sm font-semibold ${qualificationObligatoire ? 'text-amber-900' : 'text-ebios-800'}`}>
                  {qualificationObligatoire ? t.qualification.promptRequiredTitle : t.qualification.promptOptionalTitle}
                </p>
                <p className={`text-xs mt-0.5 ${qualificationObligatoire ? 'text-amber-800' : 'text-ebios-700'}`}>
                  {qualificationObligatoire ? t.qualification.promptRequiredText : t.qualification.promptOptionalText}
                </p>
              </div>
            </div>
            <QualificationPanel
              analyseId={analyse.id}
              initial={(analyse as any).qualification ?? null}
              canEdit={editable && !locked}
              secteur={analyse.secteur}
              defaultOpen
            />
          </div>
        )}

        {/* Progress */}
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">{t.analysis.progressTitle}</h2>
            <span className="text-sm text-gray-500">{pct}%{currentAtelier ? ` — ${currentAtelier.titre}` : ''}</span>
          </div>
          <div className="bg-gray-200 rounded-full h-3 mb-4">
            <div className={`h-3 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-ebios-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {ateliersL.map(a => {
              const done = analyse.atelierCourant > a.num || analyse.statut === 'TERMINE'
              const active = analyse.atelierCourant === a.num && analyse.statut !== 'TERMINE'
              const accessible = analyse.atelierCourant >= a.num || analyse.statut === 'TERMINE'
              return (
                <Link
                  key={a.num}
                  href={accessible ? `/analyses/${analyse.id}/atelier/${a.num}` : '#'}
                  className={`p-3 rounded-xl text-center transition-colors ${
                    done    ? 'bg-ebios-100 text-ebios-700 hover:bg-ebios-200' :
                    active  ? 'bg-ebios-600 text-white shadow-sm' :
                    'bg-gray-50 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <div className="text-xl mb-1">{done ? '✅' : a.icon}</div>
                  <div className="text-xs font-medium hidden sm:block">{a.titre}</div>
                  <div className="text-xs sm:hidden">{a.num}</div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Questionnaire de qualification (cf. fiche Club EBIOS — cadrage).
            Mis en avant plus haut tant qu'incomplet ; ici en consultation/édition
            une fois renseigné (ou en lecture seule). */}
        {qualificationActive && !qualificationPrompt && (
          <div className="mb-6">
            <QualificationPanel
              analyseId={analyse.id}
              initial={(analyse as any).qualification ?? null}
              canEdit={editable && !locked}
              secteur={analyse.secteur}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Résumé en chiffres */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: analyse.sourcesRisque.filter((s: { retenu: boolean }) => s.retenu).length === 1 ? t.analysis.statSourcesSg    : t.analysis.statSources,    value: analyse.sourcesRisque.filter((s: { retenu: boolean }) => s.retenu).length, total: analyse.sourcesRisque.length, icon: '🎭' },
                { label: analyse.scenariosStrategiques.filter((s: { retenu: boolean }) => s.retenu).length === 1 ? t.analysis.statStrategicSg : t.analysis.statStrategic, value: analyse.scenariosStrategiques.filter((s: { retenu: boolean }) => s.retenu).length, total: analyse.scenariosStrategiques.length, icon: '🗺️' },
                { label: analyse.scenariosOperationnels.length === 1 ? t.analysis.statOpSg         : t.analysis.statOp,         value: analyse.scenariosOperationnels.length, total: null, icon: '⚙️' },
                { label: analyse.risques.length === 1                ? t.analysis.statRisksSg      : t.analysis.statRisks,      value: analyse.risques.length, total: null, icon: '⚠️' },
              ].map((s, i) => (
                <div key={i} className="card p-4 text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {s.value}{s.total !== null && s.total > 0 ? <span className="text-sm text-gray-500">/{s.total}</span> : ''}
                  </div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Matrices des risques — onglets : bruts / à date / résiduels */}
            {analyse.risques.length > 0 && (
              <RiskMatrixTabs
                config={scaleConfig}
                risks={analyse.risques.map((r: {
                  id: string; nom: string; vraisemblance: number; gravite: number
                  graviteResiduelle: number | null; vraisemblanceResiduelle: number | null
                }) => ({
                  id: r.id,
                  nom: r.nom,
                  gravite: r.gravite,
                  vraisemblance: r.vraisemblance,
                  graviteResiduelle: r.graviteResiduelle,
                  vraisemblanceResiduelle: r.vraisemblanceResiduelle,
                }))}
                mesures={analyse.mesures.map((m: { risqueId: string | null; statut: string }) => ({
                  risqueId: m.risqueId, statut: m.statut,
                }))}
              />
            )}

            {/* Radar de menace de l'écosystème */}
            {analyse.partiesPrenantes.length > 0 && (
              <EcosystemRadar
                parties={analyse.partiesPrenantes.map((p: any) => ({
                  id: p.id, nom: p.nom, nomCourt: p.nomCourt ?? undefined, type: p.type,
                  exposition: p.exposition, fiabilite: p.fiabilite,
                  dependance: p.dependance, penetration: p.penetration, maturite: p.maturite, confiance: p.confiance,
                  critique: p.critique, rang: p.rang, cle: p.cle ?? undefined, parentCle: p.parentCle ?? undefined,
                }))}
                manageTiersHref={`/analyses/${analyse.id}/atelier/3`}
                manageTiersPerPoint
              />
            )}

            {/* Camembert de conformité au référentiel du socle (propre ou héritée) —
                après les matrices de risques, avant le top des risques. */}
            {conformitePie && (
              <ConformitePie
                stats={conformitePie.stats}
                frameworkNom={conformitePie.frameworkNom}
                title={t.analysis.conformiteTitle}
                rateLabel={t.dashboard.conformiteRate}
                labels={t.conformite.statuts as { conforme: string; partiel: string; non_conforme: string; na: string; deroge: string }}
                note={conformitePie.note}
              />
            )}

            {/* Risques top 5 */}
            {analyse.risques.length > 0 && (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-800 mb-4">{t.analysis.topRisks}</h2>
                <div className="space-y-2">
                  {([...analyse.risques] as Array<{ id: string; nom: string; niveauRisque: number; strategie: string }>)
                    .sort((a, b) => b.niveauRisque - a.niveauRisque)
                    .slice(0, 5)
                    .map(r => {
                      const niveau = getNiveauRisqueLabel(r.niveauRisque)
                      return (
                        <Link
                          key={r.id}
                          href={`/analyses/${analyse.id}/atelier/5`}
                          className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                          title={t.analysis.editRiskTreatment}
                        >
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${niveau.bg} ${niveau.color}`}>
                            {niveau.label} ({r.niveauRisque})
                          </span>
                          <span className="text-sm text-gray-800 flex-1">{r.nom}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.strategie === 'REDUIRE' ? 'bg-blue-100 text-blue-700' :
                            r.strategie === 'ACCEPTER' ? 'bg-green-100 text-green-700' :
                            r.strategie === 'TRANSFERER' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {(t.strategyLabels as Record<string, string>)[r.strategie] ?? r.strategie}
                          </span>
                        </Link>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Plan d'action */}
            {analyse.mesures.length > 0 && (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-800 mb-4">{t.analysis.actionPlanTitle} ({analyse.mesures.length} {t.analysis.measuresLabel})</h2>
                <div className="space-y-2">
                  {([...analyse.mesures] as Array<{ id: string; nom: string; priorite: number; statut: string; responsable?: string | null }>)
                    .sort((a, b) => a.priorite - b.priorite)
                    .slice(0, 8)
                    .map(m => (
                      <Link
                        key={m.id}
                        href={`/analyses/${analyse.id}/atelier/5?tab=mesures`}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                        title={t.analysis.editMeasure}
                      >
                        <span className={`text-xs font-bold w-6 flex-shrink-0 ${
                          m.priorite === 1 ? 'text-red-600' :
                          m.priorite === 2 ? 'text-orange-600' :
                          m.priorite === 3 ? 'text-yellow-600' : 'text-gray-500'
                        }`}>P{m.priorite}</span>
                        <span className="text-sm text-gray-800 flex-1">{m.nom}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          m.statut === 'REALISE' ? 'bg-green-100 text-green-700' :
                          m.statut === 'EN_COURS' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{m.statut.replace('_', ' ')}</span>
                        {m.responsable && (
                          <span className="text-xs text-gray-500 hidden sm:inline">{m.responsable}</span>
                        )}
                      </Link>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Colonne latérale — Accès & Approbation */}
          <div className="space-y-4">
            {/* Socle toggle — visible pour le propriétaire et l'admin */}
            {isOwner && (
              <SocleToggle
                analyseId={analyse.id}
                isSocle={(analyse as any).isSocle ?? false}
                heritiersCount={(analyse as any)._count?.heritiers ?? 0}
              />
            )}
            <AccessPanel
              analyseId={analyse.id}
              statut={analyse.statut}
              ownerId={analyse.userId}
              ownerName={analyse.user?.name}
              ownerEmail={analyse.user?.email}
              currentUserId={userId}
              currentUserRole={userRole}
              canManage={canManage}
              canSubmit={canSubmit}
              canApprove={canApprove}
              canAutoValidate={canAutoValidate}
              commentaireApprobation={analyse.commentaireApprobation ?? null}
              approuveLe={analyse.approuveLe ? analyse.approuveLe.toISOString() : null}
              approbateurId={analyse.approbateurId ?? null}
            />
            {/* Acceptation des risques résiduels (Direction métier) — si activée pour l'org. */}
            {orgConfig.acceptationRisquesActive && (
              <ResidualRisksPanel
                analyseId={analyse.id}
                statut={(analyse as any).risquesResiduelsStatut ?? 'EN_ATTENTE'}
                le={(analyse as any).risquesResiduelsLe ? (analyse as any).risquesResiduelsLe.toISOString() : null}
                commentaire={(analyse as any).risquesResiduelsCommentaire ?? null}
                canAct={canAcceptResidualRisks(sessionUser, orgConfig.acceptationRisquesActive)}
                locale={locale}
              />
            )}
            {/* Dérogations (acceptation temporaire de non-conformité) — si activées pour l'org. */}
            {orgConfig.derogationsActive && (
              <DerogationsPanel
                analyseId={analyse.id}
                currentUserId={userId}
                currentUserRole={userRole}
                canEdit={editable}
                referentielCourant={(analyse as any).referentielMesures ?? null}
                risques={analyse.risques.map((r: { id: string; nom: string }) => ({ id: r.id, nom: r.nom }))}
                locale={locale}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
