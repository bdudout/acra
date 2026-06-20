import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import WorkshopProgress from '@/components/WorkshopProgress'
import AtelierGuidancePanel from '@/components/AtelierGuidancePanel'
import { ATELIERS_META } from '@/lib/ebios-data'
import { getServerT } from '@/lib/i18n'
import Atelier1 from '@/components/workshops/Atelier1'
import Atelier2 from '@/components/workshops/Atelier2'
import Atelier3 from '@/components/workshops/Atelier3'
import Atelier4 from '@/components/workshops/Atelier4'
import Atelier5 from '@/components/workshops/Atelier5'
import { canViewAnalyse, canEditAnalyse, type UserRole } from '@/lib/permissions'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { getFrameworkControles } from '@/lib/frameworks-data'
import { sanitizeConformite, deriveNonConformites, type ConformiteStatut } from '@/lib/conformite'

export default async function AtelierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; num: string }>
  searchParams: Promise<{ mode?: string; tab?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const t = await getServerT()

  const { id, num } = await params
  const resolvedSearchParams = await searchParams
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  const atelierNum = parseInt(num)

  if (isNaN(atelierNum) || atelierNum < 1 || atelierNum > 5) notFound()

  // Charger l'analyse sans restriction d'ownership pour vérifier les accès partagés
  const analyse = await prisma.analyse.findUnique({
    where: { id },
    include: {
      cadrage: true,
      sourcesRisque: true,
      partiesPrenantes: true,
      scenariosStrategiques: true,
      scenariosOperationnels: true,
      risques: true,
      mesures: true,
      accesUtilisateurs: true,
    },
  })

  // Analyse en corbeille (soft delete) = introuvable (récupérable via /admin/recovery).
  if (!analyse || analyse.deletedAt) notFound()

  // Vérifier les droits (propriétaire OU accès partagé en lecture/édition)
  const ownership = { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs }
  const sessionUser = { id: userId, role: userRole }
  if (!canViewAnalyse(sessionUser, ownership)) notFound()
  const editable = canEditAnalyse(sessionUser, ownership)

  // Bloquer l'accès aux ateliers non encore débloqués
  if (atelierNum > analyse.atelierCourant) {
    redirect(`/analyses/${id}/atelier/${analyse.atelierCourant}`)
  }

  const meta = ATELIERS_META[atelierNum - 1]
  // Mode « Flash » (démarche Club EBIOS) : parcours rapide guidé A1→A2→A3→A4→A5,
  // appuyé sur la capitalisation, en se limitant aux scénarios les plus pertinents.
  const flashMode = resolvedSearchParams.mode === 'flash'

  // Préparer les initialData selon l'atelier
  let initialData: any = undefined
  switch (atelierNum) {
    case 1:
      initialData = analyse.cadrage
      break
    case 2:
      initialData = { sourcesRisque: analyse.sourcesRisque }
      break
    case 3:
      initialData = {
        partiesPrenantes: analyse.partiesPrenantes,
        scenariosStrategiques: analyse.scenariosStrategiques,
      }
      break
    case 4:
      initialData = { scenariosOperationnels: analyse.scenariosOperationnels }
      break
    case 5:
      initialData = {
        risques: analyse.risques,
        mesures: analyse.mesures.map((m: any) => ({
          ...m,
          // Sérialiser DateTime Prisma → string YYYY-MM-DD (évite React error #31)
          echeance: m.echeance instanceof Date
            ? m.echeance.toISOString().slice(0, 10)
            : (m.echeance ?? null),
        })),
      }
      break
  }

  // Catalogue de vulnérabilités issu du socle (fiche Club EBIOS) — affiché en
  // ateliers 3/4 (vecteurs/actions candidats) et 5 (garde-fou tunnel de conformité).
  const orgConfig = await (prisma.organizationConfig as any).findUnique({ where: { id: 'global' }, select: { conformiteActive: true, conseilsAteliersActive: true } })
  const conformiteActive = Boolean(orgConfig?.conformiteActive)
  const conseilsActive = orgConfig?.conseilsAteliersActive !== false // activé par défaut
  let nonConfItems: { ref: string; nom: string; statut: ConformiteStatut; commentaire?: string }[] = []
  if (conformiteActive && analyse.cadrage) {
    const controles = getFrameworkControles((analyse as any).referentielMesures ?? 'ISO27001', (analyse.cadrage as any).customControles as any[])
    const ctlByRef = new Map(controles.map(c => [c.ref, c]))
    const entries = sanitizeConformite((analyse.cadrage as any).socleSecurite)
    nonConfItems = deriveNonConformites(entries).map(nc => ({
      ref: nc.ref,
      nom: ctlByRef.get(nc.ref)?.nom ?? nc.ref,
      statut: nc.statut,
      commentaire: nc.commentaire,
    }))
  }
  const showCatalogue = conformiteActive && (atelierNum === 3 || atelierNum === 4)
  const showTunnelWarning = conformiteActive && atelierNum === 5

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <WorkshopProgress
        analyseId={analyse.id}
        current={atelierNum}
        completed={analyse.atelierCourant}
      />

      <main id="main-content" className={`${conseilsActive ? 'max-w-6xl' : 'max-w-4xl'} mx-auto px-4 py-8`}>
        {/* Header atelier */}
        <header className="mb-8">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href={`/analyses/${analyse.id}`} className="hover:text-gray-600">
              <span aria-hidden="true">← </span>{analyse.nom}
            </Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{t.workshop.breadcrumbAtelier} {atelierNum}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden="true">{meta.icon}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {(t.workshop as any)[`a${atelierNum}`]?.title ?? `${t.workshop.breadcrumbAtelier} ${atelierNum} — ${meta.titre}`}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {t.ateliersMeta[atelierNum - 1]?.sousTitre ?? meta.sousTitre}
              </p>
            </div>
          </div>
        </header>

        {/* Navigation entre étapes — commentée car dupliquée par les onglets cliquables du composant atelier */}
        {/* {meta.etapes && meta.etapes.length > 0 && (
          <ol
            aria-label="Étapes de l'atelier"
            className="flex gap-1 mb-6 overflow-x-auto pb-1 list-none p-0"
          >
            {meta.etapes.map((e, i) => (
              <li key={i} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600">
                <span aria-hidden="true" className="text-gray-500">{i + 1}.</span>
                <span className="sr-only">Étape {i + 1} : </span>{e}
              </li>
            ))}
          </ol>
        )} */}

        {/* Bandeau mode Flash */}
        {flashMode && (
          <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl px-5 py-3 flex items-start gap-3">
            <span className="text-xl">⚡</span>
            <div className="flex-1">
              <span className="font-semibold text-amber-900 text-sm">{t.analyses.expressTitle} — {t.analyses.expressSubtitle}</span>
              <span className="text-amber-700 text-sm ml-2">{t.analyses.expressInfo}</span>
              {/* Conseil de dimensionnement spécifique à l'atelier en mode Flash */}
              {(t.analyses.flashTips as Record<string, string>)[`a${atelierNum}`] && (
                <p className="mt-2 text-sm text-amber-900">
                  <span className="font-semibold">💡 {t.analyses.flashTipLabel} :</span>{' '}
                  {(t.analyses.flashTips as Record<string, string>)[`a${atelierNum}`]}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Catalogue de vulnérabilités issu du socle (ateliers 3 & 4) */}
        {showCatalogue && (
          <div className="card p-5 mb-6 border-l-4 border-l-red-400">
            <h2 className="font-semibold text-gray-800 mb-1">🛡️ {t.conformite.vulnPanelTitle}</h2>
            <p className="text-xs text-gray-500 mb-3">{t.conformite.vulnPanelIntro}</p>
            {nonConfItems.length === 0 ? (
              <p className="text-sm text-gray-500">{t.conformite.vulnPanelEmpty}</p>
            ) : (
              <ul className="space-y-1.5">
                {nonConfItems.map(it => (
                  <li key={it.ref} className="text-sm text-gray-700 flex gap-2">
                    <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${it.statut === 'non_conforme' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span>
                      <span className="text-gray-400 mr-1">{it.ref}</span>{it.nom}
                      <span className="ml-1 text-xs text-gray-400">({(t.conformite.statuts as Record<string, string>)[it.statut]})</span>
                      {it.commentaire && <span className="text-gray-500"> — {it.commentaire}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Garde-fou « tunnel de conformité » (atelier 5) */}
        {showTunnelWarning && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6">
            <p className="text-sm font-semibold text-amber-800 mb-1">{t.conformite.tunnelWarningTitle}</p>
            <p className="text-sm text-amber-800">{t.conformite.tunnelWarning}</p>
          </div>
        )}

        {/* Composant atelier (+ panneau conseils latéral optionnel) */}
        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1">
            {atelierNum === 1 && (
              <Atelier1 analyseId={analyse.id} initialData={initialData} analyse={analyse} flashMode={flashMode} />
            )}
            {atelierNum === 2 && (
              <Atelier2
                analyseId={analyse.id}
                initialData={initialData}
                analyse={analyse}
                flashMode={flashMode}
              />
            )}
            {atelierNum === 3 && (
              <Atelier3
                analyseId={analyse.id}
                initialData={initialData}
                analyse={analyse}
                flashMode={flashMode}
              />
            )}
            {atelierNum === 4 && (
              <Atelier4
                analyseId={analyse.id}
                initialData={initialData}
                analyse={analyse}
                flashMode={flashMode}
              />
            )}
            {atelierNum === 5 && (
              <Atelier5
                analyseId={analyse.id}
                initialData={initialData}
                analyse={analyse}
                initialTab={resolvedSearchParams.tab}
                flashMode={flashMode}
                scaleConfig={await getEffectiveScaleConfig()}
              />
            )}
          </div>
          {conseilsActive && <AtelierGuidancePanel num={atelierNum} />}
        </div>
      </main>
    </div>
  )
}
