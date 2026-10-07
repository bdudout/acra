'use client'
// ─── Bascule « vue détaillée / liste simple » des listes (analyses, projets) ──
// Comme les présentations d'un dossier : cartes riches ou tableau compact. Choix mémorisé par navigateur
// (localStorage, protégé : navigation privée ou stockage bloqué → défaut).

import { useEffect, useState } from 'react'
import { LayoutList, List } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export type ModeVue = 'detail' | 'liste'

/** Mode de présentation mémorisé sous `cle` ; `defaut` tant que rien n'est mémorisé. */
export function useModeVue(cle: string, defaut: ModeVue): [ModeVue, (m: ModeVue) => void] {
  const [mode, setMode] = useState<ModeVue>(defaut)
  useEffect(() => {
    try { const v = localStorage.getItem(cle); if (v === 'detail' || v === 'liste') setMode(v) } catch { /* stockage indisponible */ }
  }, [cle])
  const changer = (m: ModeVue) => { setMode(m); try { localStorage.setItem(cle, m) } catch { /* stockage indisponible */ } }
  return [mode, changer]
}

export default function VueListeToggle({ mode, onChange }: { mode: ModeVue; onChange: (m: ModeVue) => void }) {
  const { t } = useTranslation()
  const v = t.vueListe
  const bouton = (m: ModeVue, label: string, Icone: typeof List) => (
    <button type="button" aria-pressed={mode === m} aria-label={label} title={label} onClick={() => onChange(m)}
      className={`rounded-md p-1.5 ${mode === m ? 'bg-white text-ebios-700 shadow-sm dark:bg-gray-700' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
      <Icone size={16} aria-hidden="true" />
    </button>
  )
  return (
    <div role="group" aria-label={v.label} className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
      {bouton('detail', v.detail, LayoutList)}
      {bouton('liste', v.liste, List)}
    </div>
  )
}
