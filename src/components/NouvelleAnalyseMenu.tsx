'use client'

// ─── Bouton « Nouvelle analyse » : menu déroulant ────────────────────────────
// Un seul point d'entrée (tableau de bord cyber, tableau de bord GRC, liste des analyses) : nouvelle analyse, nouveau projet 360
// (module actif) ou import d'une analyse. Visible à toute largeur ; accessible au clavier et au lecteur d'écran.
// `onImport` : sur la page Analyses, l'import s'ouvre sur place (bouton) au lieu d'un lien vers `/analyses?import=1`.

import Link from 'next/link'
import { ChevronDown, FolderKanban, Plus, Upload } from 'lucide-react'
import { useDropdownMenu } from '@/components/useDropdownMenu'

export interface NouvelleAnalyseLabels { trigger: string; analyse: string; projet360: string; importer: string }

export default function NouvelleAnalyseMenu({ labels, projet360, onImport }: { labels: NouvelleAnalyseLabels; projet360: boolean; onImport?: () => void }) {
  const { open, close, rootRef, triggerProps, menuProps } = useDropdownMenu()
  const item = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-800 hover:bg-ebios-50 focus:bg-ebios-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ebios-500 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:bg-gray-800'
  return (
    <div className="relative" ref={rootRef}>
      <button type="button" className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto" {...triggerProps}>
        <Plus size={16} aria-hidden="true" /> {labels.trigger} <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div {...menuProps} className="absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <Link role="menuitem" href="/analyses/new" className={item} onClick={() => close(false)}><Plus size={15} aria-hidden="true" />{labels.analyse}</Link>
          {projet360 && <Link role="menuitem" href="/projets/nouveau" className={item} onClick={() => close(false)}><FolderKanban size={15} aria-hidden="true" />{labels.projet360}</Link>}
          {onImport
            ? <button type="button" role="menuitem" className={item} onClick={() => { close(false); onImport() }}><Upload size={15} aria-hidden="true" />{labels.importer}</button>
            : <Link role="menuitem" href="/analyses?import=1" className={item} onClick={() => close(false)}><Upload size={15} aria-hidden="true" />{labels.importer}</Link>}
        </div>
      )}
    </div>
  )
}
