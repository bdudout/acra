'use client'

// ─── Vue RAS / RAD ───────────────────────────────────────────────────────────
// Deux blocs : la DÉCLARATION d'appétence (RAS) — seuils d'appétit par catégorie,
// maturité visée par référentiel — et le TABLEAU DE BORD (RAD) — position réelle
// face à ces limites, avec un voyant par indicateur et un voyant global. Données
// assemblées côté serveur (lib/ras-rad.server) ; règles des voyants : lib/ras-rad.

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import type { Voyant } from '@/lib/ras-rad'
import type { RasExportData } from '@/lib/ras-export'

export interface RasRadData {
  global: Voyant
  modules: { registre: boolean; maturite: boolean; kri: boolean }
  appetit: (RasExportData & { voyant: Voyant }) | null
  maturite: { code: string; nom: string; cible: number | null; averageCurrent: number | null; averageTarget: number | null; belowTarget: number; assessed: number; total: number; voyant: Voyant }[]
  kri: { total: number; alerte: number; critique: number; enAlerte: { intitule: string; statut: string; valeur: number | null; unite: string | null }[]; voyant: Voyant } | null
}

const COULEUR: Record<Voyant, string> = {
  VERT: 'bg-green-500', ORANGE: 'bg-amber-500', ROUGE: 'bg-red-600', GRIS: 'bg-gray-300 dark:bg-gray-600',
}

export default function RasRadView({ data }: { data: RasRadData }) {
  const { t } = useTranslation()
  const a = t.appetence
  const voyants = a.voyants as Record<Voyant, string>
  const pastille = (v: Voyant) => (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
      <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${COULEUR[v]}`} />{voyants[v]}
    </span>
  )
  const off = <p className="text-xs italic text-gray-400">{a.moduleOff}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">{a.globalLabel} :</span> {pastille(data.global)}</p>
        <a href="/api/appetence/export" className="text-xs text-ebios-700 hover:underline">{a.exportRasRad}</a>
      </div>

      {/* ── RAS ── */}
      <section aria-labelledby="ras-title" className="card p-5">
        <h2 id="ras-title" className="text-base font-semibold text-gray-800 dark:text-gray-100">{a.rasTitle}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{a.rasIntro}</p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{a.seuilGlobal}</h3>
            {!data.modules.registre ? off : (
              <>
                <p className="text-2xl font-semibold tabular-nums mt-1">{data.appetit?.seuilGlobal ?? a.noSeuil}</p>
                <h4 className="mt-3 text-xs uppercase tracking-wide text-gray-500">{a.categories}</h4>
                {data.appetit && data.appetit.categories.length > 0 ? (
                  <ul className="mt-1 text-sm divide-y divide-gray-100 dark:divide-gray-700">
                    {data.appetit.categories.map(c => <li key={c.code} className="flex justify-between py-1"><span>{c.label}</span><span className="tabular-nums font-medium">{c.seuil}</span></li>)}
                  </ul>
                ) : <p className="mt-1 text-xs text-gray-400">{a.noCategories}</p>}
                <div className="mt-3 flex gap-3 text-xs">
                  <Link href="/cartographie" className="text-ebios-700 hover:underline">{a.editAppetit}</Link>
                  <a href="/api/appetit/ras" className="text-ebios-700 hover:underline">{a.exportRas}</a>
                </div>
              </>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{a.maturiteTargets}</h3>
            {!data.modules.maturite ? off : data.maturite.length === 0 ? <p className="mt-1 text-xs text-gray-400">{a.noMaturite}</p> : (
              <ul className="mt-1 text-sm divide-y divide-gray-100 dark:divide-gray-700">
                {data.maturite.map(m => <li key={m.code} className="flex justify-between py-1"><span>{m.nom}</span><span className="tabular-nums text-gray-600">{a.cible} {m.cible ?? m.averageTarget ?? '—'}</span></li>)}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── RAD ── */}
      <section aria-labelledby="rad-title" className="card p-5">
        <h2 id="rad-title" className="text-base font-semibold text-gray-800 dark:text-gray-100">{a.radTitle}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{a.radIntro}</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{a.appetitIndicator}</h3>{data.appetit && pastille(data.appetit.voyant)}</div>
            {!data.appetit ? off : (
              <>
                <p className="mt-2 text-sm tabular-nums">{a.appetitDetail.replace('{dans}', String(data.appetit.synthese.dansAppetit)).replace('{evalues}', String(data.appetit.synthese.evalues)).replace('{hors}', String(data.appetit.synthese.horsAppetit))}</p>
                {data.appetit.depassements.length > 0 && (
                  <>
                    <h4 className="mt-3 text-xs uppercase tracking-wide text-gray-500">{a.depassements}</h4>
                    <ul className="mt-1 space-y-1 text-xs">
                      {data.appetit.depassements.map((d, i) => (
                        <li key={i} className="flex justify-between gap-2"><span className="truncate">{d.intitule}</span><span className="shrink-0 tabular-nums text-red-700 dark:text-red-300">{d.niveauResiduel} · {a.ecart.replace('{n}', String(d.ecart))}</span></li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold">{a.maturiteIndicator}</h3>
            {!data.modules.maturite ? off : data.maturite.length === 0 ? <p className="mt-2 text-xs text-gray-400">{a.noMaturite}</p> : (
              <ul className="mt-2 space-y-2 text-xs">
                {data.maturite.map(m => (
                  <li key={m.code}>
                    <div className="flex justify-between gap-2"><span className="font-medium">{m.nom}</span>{pastille(m.voyant)}</div>
                    <p className="text-gray-600 dark:text-gray-300 tabular-nums">{a.maturiteDetail.replace('{cur}', String(m.averageCurrent ?? '—')).replace('{tgt}', String(m.averageTarget ?? '—')).replace('{below}', String(m.belowTarget))}</p>
                  </li>
                ))}
              </ul>
            )}
            {data.modules.maturite && <Link href="/maturite" className="mt-2 inline-block text-xs text-ebios-700 hover:underline">{a.openMaturite}</Link>}
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{a.kriIndicator}</h3>{data.kri && pastille(data.kri.voyant)}</div>
            {!data.kri ? off : (
              <>
                <p className="mt-2 text-sm tabular-nums">{a.kriDetail.replace('{critique}', String(data.kri.critique)).replace('{alerte}', String(data.kri.alerte)).replace('{total}', String(data.kri.total))}</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {data.kri.enAlerte.map((k, i) => (
                    <li key={i} className="flex justify-between gap-2"><span className="truncate">{k.intitule}</span><span className={`shrink-0 tabular-nums ${k.statut === 'CRITIQUE' ? 'text-red-700' : 'text-amber-700'}`}>{k.valeur ?? '—'}{k.unite ? ` ${k.unite}` : ''}</span></li>
                  ))}
                </ul>
                <Link href="/kri" className="mt-2 inline-block text-xs text-ebios-700 hover:underline">{a.openKri}</Link>
              </>
            )}
          </div>
        </div>
        <p className="mt-4 text-[11px] text-gray-500 dark:text-gray-400">{a.rules}</p>
      </section>
    </div>
  )
}
