'use client'
// ─── Bascule de vue analyse cyber ⇄ projet 360 (en haut de page) ──────────────
// Affichée seulement quand l'analyse est rattachée à un projet (Analyse.projetSourceId) ou que le projet a des analyses cyber.
// Depuis un projet à plusieurs analyses, la vue « Analyse cyber » propose de choisir laquelle.

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

type Lien = { id: string; nom: string }
const seg = 'inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium'
const actif = `${seg} bg-ebios-600 text-white`
const inactif = `${seg} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800`

export default function VueAnalyseProjet({ active, projet, analyses }: { active: 'analyse' | 'projet'; projet: Lien | null; analyses: Lien[] }) {
  const { t } = useTranslation()
  const v = t.vueAnalyseProjet
  if (!projet || (active === 'projet' && analyses.length === 0)) return null
  return (
    <nav aria-label={v.label} className="mb-4 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900">
      {active === 'projet'
        ? <span aria-current="page" className={actif}>{v.projet} · {projet.nom}</span>
        : <Link href={`/projets/${projet.id}`} className={inactif}>{v.projet} · {projet.nom}</Link>}
      {active === 'analyse'
        ? <span aria-current="page" className={actif}>{v.analyse}{analyses[0] ? ` · ${analyses[0].nom}` : ''}</span>
        : analyses.length === 1
          ? <Link href={`/analyses/${analyses[0].id}`} className={inactif}>{v.analyse} · {analyses[0].nom}</Link>
          : (
            <details className="relative">
              <summary className={`${inactif} cursor-pointer list-none`}>{v.analyse} ({analyses.length})</summary>
              <ul aria-label={v.choisir} className="absolute left-0 z-20 mt-1 min-w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                {analyses.map(a => <li key={a.id}><Link href={`/analyses/${a.id}`} className="block rounded-sm px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">{a.nom}</Link></li>)}
              </ul>
            </details>
          )}
    </nav>
  )
}
