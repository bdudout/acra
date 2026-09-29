'use client'

// ─── Exemples cliquables ─────────────────────────────────────────────────────
// Rangée de « pastilles » : un clic préremplit un formulaire avec un exemple
// réaliste que l'utilisateur adapte. Ne rend rien s'il n'y a aucun exemple.

import { Lightbulb } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export interface ExampleItem { id: string; label: string }

export default function ExampleChips({ items, onPick }: { items: ExampleItem[]; onPick: (id: string) => void }) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1"><Lightbulb size={13} className="inline align-[-0.15em] mr-1 text-amber-500" aria-hidden="true" />{t.exemples.title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(i => (
          <button key={i.id} type="button" onClick={() => onPick(i.id)}
            className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:border-ebios-500 hover:text-ebios-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">{i.label}</button>
        ))}
      </div>
    </div>
  )
}
