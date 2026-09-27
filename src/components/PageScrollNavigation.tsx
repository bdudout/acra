'use client'

// ─── Navigation verticale de page ───────────────────────────────────────────
// Affiche, sur les pages réellement longues, deux actions flottantes pour aller
// au début ou à la fin. Le calcul est client-only car il dépend du viewport et
// de la hauteur rendue, notamment après les chargements asynchrones d'ateliers.

import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  group: string
  top: string
  bottom: string
}

/** Boutons flottants haut/bas, masqués si la page fait moins d'1,5 écran. */
export default function PageScrollNavigation({ group, top, bottom }: Props) {
  const [isLongPage, setIsLongPage] = useState(false)

  useEffect(() => {
    const update = () => {
      const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      setIsLongPage(height > window.innerHeight * 1.5)
    }
    update()
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(document.body)
    return () => {
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [])

  if (!isLongPage) return null

  const scrollTo = (position: 'top' | 'bottom') => {
    const behavior: ScrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const pageBottom = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    window.scrollTo({ top: position === 'top' ? 0 : pageBottom, behavior })
  }

  return (
    <div role="group" aria-label={group} className="fixed bottom-5 right-4 z-40 flex flex-col gap-2 sm:right-6">
      <button type="button" onClick={() => scrollTo('top')} aria-label={top} title={top}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-600 shadow-lg transition hover:bg-ebios-50 hover:text-ebios-700 focus:outline-none focus:ring-2 focus:ring-ebios-500 dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-200 dark:hover:bg-ebios-900/30">
        <ArrowUp size={19} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => scrollTo('bottom')} aria-label={bottom} title={bottom}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-600 shadow-lg transition hover:bg-ebios-50 hover:text-ebios-700 focus:outline-none focus:ring-2 focus:ring-ebios-500 dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-200 dark:hover:bg-ebios-900/30">
        <ArrowDown size={19} aria-hidden="true" />
      </button>
    </div>
  )
}
