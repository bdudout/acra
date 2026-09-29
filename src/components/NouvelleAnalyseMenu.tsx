'use client'

// ─── Bouton « Nouvelle analyse » du tableau de bord : menu déroulant ─────────
// Un seul point d'entrée : nouvelle analyse, nouveau projet 360 (module actif) ou import d'une analyse.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, FolderKanban, Plus, Upload } from 'lucide-react'

export interface NouvelleAnalyseLabels { trigger: string; analyse: string; projet360: string; importer: string }

export default function NouvelleAnalyseMenu({ labels, projet360 }: { labels: NouvelleAnalyseLabels; projet360: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open])

  const item = 'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-ebios-50 dark:text-gray-100 dark:hover:bg-gray-800'
  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button type="button" className="btn-primary inline-flex items-center gap-2" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Plus size={16} aria-hidden="true" /> {labels.trigger} <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <Link role="menuitem" href="/analyses/new" className={item} onClick={() => setOpen(false)}><Plus size={15} aria-hidden="true" />{labels.analyse}</Link>
          {projet360 && <Link role="menuitem" href="/analyses/new?methode=PROJET_360" className={item} onClick={() => setOpen(false)}><FolderKanban size={15} aria-hidden="true" />{labels.projet360}</Link>}
          <Link role="menuitem" href="/analyses?import=1" className={item} onClick={() => setOpen(false)}><Upload size={15} aria-hidden="true" />{labels.importer}</Link>
        </div>
      )}
    </div>
  )
}
