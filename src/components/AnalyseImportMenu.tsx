'use client'

import { useDropdownMenu } from '@/components/useDropdownMenu'
import { Braces, ChevronDown, FileSpreadsheet, Plug, Sparkles } from 'lucide-react'

export type AnalyseImportLabels = {
  trigger: string; acraTitle: string; acraDesc: string
  excelTitle: string; excelDesc: string; apiTitle: string; apiDesc: string; mcpTitle: string; mcpDesc: string
}

/** Menu compact : seul l'export ACRA est importable aujourd'hui ; les autres canaux
 * restent visibles afin de présenter sans ambiguïté la feuille de route d'import. */
export default function AnalyseImportMenu({ labels, onAcraImport, onExcelImport, disabled = false, defaultOpen = false }: { labels: AnalyseImportLabels; onAcraImport: () => void; onExcelImport: () => void; disabled?: boolean; defaultOpen?: boolean }) {
  const { open, close, rootRef, triggerProps, menuProps } = useDropdownMenu(defaultOpen)
  return (
    <div className="relative" ref={rootRef}>
      <button type="button" disabled={disabled} className="btn-secondary inline-flex items-center gap-2 text-sm" {...triggerProps}>
        <FileSpreadsheet size={14} aria-hidden="true" /> {labels.trigger} <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div {...menuProps} className="absolute left-0 z-20 mt-2 w-80 sm:left-auto sm:right-0 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          <button role="menuitem" onClick={() => { close(false); onAcraImport() }} className="flex w-full gap-3 rounded-md p-3 text-left hover:bg-ebios-50 focus:bg-ebios-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ebios-500">
            <Braces size={18} className="mt-0.5 shrink-0 text-ebios-700" /><span><span className="block text-sm font-medium text-gray-800">{labels.acraTitle}</span><span className="block text-xs text-gray-500">{labels.acraDesc}</span></span>
          </button>
          <button role="menuitem" onClick={() => { close(false); onExcelImport() }} className="flex w-full gap-3 rounded-md p-3 text-left hover:bg-ebios-50 focus:bg-ebios-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ebios-500"><FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-ebios-700" /><span><span className="block text-sm font-medium text-gray-800">{labels.excelTitle}</span><span className="block text-xs text-gray-500">{labels.excelDesc}</span></span></button>
          <div role="menuitem" aria-disabled="true" className="flex gap-3 rounded-md p-3 opacity-80"><Plug size={18} className="mt-0.5 shrink-0 text-gray-500" /><span><span className="block text-sm font-medium text-gray-800">{labels.apiTitle}</span><span className="block text-xs text-gray-500">{labels.apiDesc}</span></span></div>
          <div role="menuitem" aria-disabled="true" className="flex gap-3 rounded-md p-3 opacity-80"><Sparkles size={18} className="mt-0.5 shrink-0 text-gray-500" /><span><span className="block text-sm font-medium text-gray-800">{labels.mcpTitle}</span><span className="block text-xs text-gray-500">{labels.mcpDesc}</span></span></div>
        </div>
      )}
    </div>
  )
}
