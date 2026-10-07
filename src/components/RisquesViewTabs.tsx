'use client'

// ─── Onglets Liste / Cartographie : deux vues du même registre des risques ───────────────────────────────────────────
// La cartographie n'a pas d'entrée de menu propre ; on bascule entre la liste (édition) et la carte (lecture croisée).
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

export default function RisquesViewTabs({ current }: { current: 'liste' | 'carte' }) {
  const { t } = useTranslation()
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined}
      className={`px-3 py-1.5 text-sm rounded-md ${on ? 'bg-white dark:bg-gray-700 text-ebios-700 dark:text-ebios-300 font-medium shadow-xs' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}>{label}</Link>
  )
  return (
    <div className="inline-flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 mb-3" role="navigation" aria-label={t.nav.registre}>
      {tab('/registre', t.nav.vueListe, current === 'liste')}
      {tab('/cartographie', t.nav.cartographie, current === 'carte')}
    </div>
  )
}
