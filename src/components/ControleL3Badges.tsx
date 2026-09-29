'use client'

// Pastilles L3 d'une ligne de contrôle : clé, automatique, type, flux interrompu,
// appréciation défaillante / à surveiller, récurrence, escalade. Rien pour un contrôle simple.

import { useTranslation } from '@/lib/i18n/context'

export interface L3Vue {
  appreciation: string; fluxInterrompu: boolean
  recurrence: { consecutives: number; recurrente: boolean }; escalade: 'N2' | 'COMITE' | null
}
const base = 'inline-block rounded-full px-1.5 py-px text-[10px] font-medium align-middle'

export default function ControleL3Badges({ cle, mode, typeControle, l3 }: { cle: boolean; mode: string; typeControle: string | null; l3: L3Vue }) {
  const { t } = useTranslation()
  const c = t.controles
  const items: [string, string][] = []
  if (cle) items.push([c.ctl_cle, 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300'])
  if (mode === 'AUTOMATIQUE') items.push([(c.ctl_modes as Record<string, string>).AUTOMATIQUE, 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'])
  if (typeControle) items.push([(c.ctl_types as Record<string, string>)[typeControle] ?? typeControle, 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'])
  if (l3.fluxInterrompu) items.push([c.ctl_fluxInterrompu, 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'])
  if (l3.appreciation === 'DEFAILLANT') items.push([t.rapports.appreciations.DEFAILLANT, 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'])
  if (l3.appreciation === 'A_SURVEILLER') items.push([t.rapports.appreciations.A_SURVEILLER, 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'])
  if (l3.recurrence.recurrente) items.push([c.ctl_recurrente, 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'])
  if (l3.escalade === 'COMITE') items.push([c.ctl_escaladeComite, 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'])
  else if (l3.escalade === 'N2') items.push([c.ctl_escaladeN2, 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'])
  if (items.length === 0) return null
  return <span className="ml-1.5 inline-flex flex-wrap gap-1">{items.map(([label, cls]) => <span key={label} className={`${base} ${cls}`}>{label}</span>)}</span>
}
