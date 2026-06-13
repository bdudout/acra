'use client'

import Link from 'next/link'
import { ATELIERS_META } from '@/lib/ebios-data'
import { useTranslation } from '@/lib/i18n/context'

interface Props {
  analyseId: string
  current: number
  completed: number  // atelier courant sauvegardé en base
}

export default function WorkshopProgress({ analyseId, current, completed }: Props) {
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t.workshop.progressAriaLabel}
      className="bg-white border-b border-gray-200 px-6 py-4"
    >
      <div className="max-w-6xl mx-auto">
        <ol className="flex items-center gap-2 overflow-x-auto list-none p-0 m-0"
            role="list"
        >
          {ATELIERS_META.map((a, i) => {
            const done       = completed > a.num
            const active     = current === a.num
            const accessible = completed >= a.num

            const meta = t.ateliersMeta[a.num - 1]
            const titre = meta?.titre ?? a.titre

            const statusLabel = active
              ? t.workshop.statusInProgress
              : done
              ? t.workshop.statusDone
              : accessible
              ? t.workshop.statusAccessible
              : t.workshop.statusLocked

            return (
              <li key={a.num} className="flex items-center gap-2 flex-shrink-0">
                {i > 0 && (
                  <div
                    aria-hidden="true"
                    className={`h-0.5 w-8 ${done ? 'bg-ebios-500' : 'bg-gray-200'}`}
                  />
                )}
                <Link
                  href={accessible ? `/analyses/${analyseId}/atelier/${a.num}` : '#'}
                  aria-current={active ? 'step' : undefined}
                  aria-disabled={!accessible ? true : undefined}
                  aria-label={`${statusLabel} — ${t.workshop.breadcrumbAtelier} ${a.num} : ${titre}`}
                  tabIndex={!accessible ? -1 : undefined}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-ebios-600 text-white shadow-sm'
                      : done
                      ? 'bg-ebios-100 text-ebios-700 hover:bg-ebios-200'
                      : accessible
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-gray-50 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <span aria-hidden="true">{a.icon}</span>
                  <span className="hidden sm:inline">
                    {done && <span aria-hidden="true">✓ </span>}{a.num}. {titre}
                  </span>
                  <span className="sm:hidden" aria-hidden="true">{a.num}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
