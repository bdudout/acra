'use client'

import { useState } from 'react'
import { Braces, ChevronDown, FileSpreadsheet, Plug, Sparkles } from 'lucide-react'

export type AnalyseImportLabels = {
  trigger: string; acraTitle: string; acraDesc: string
  excelTitle: string; excelDesc: string; apiTitle: string; apiDesc: string; mcpTitle: string; mcpDesc: string
}

/** Menu compact : seul l'export ACRA est importable aujourd'hui ; les autres canaux
 * restent visibles afin de présenter sans ambiguïté la feuille de route d'import. */
export default function AnalyseImportMenu({ labels, onAcraImport, onExcelImport, disabled = false }: { labels: AnalyseImportLabels; onAcraImport: () => void; onExcelImport: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(value => !value)} disabled={disabled} className="btn-secondary hidden items-center gap-2 text-sm sm:flex" aria-expanded={open} aria-haspopup="menu">
        <FileSpreadsheet size={14} aria-hidden="true" /> {labels.trigger} <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          <button role="menuitem" onClick={() => { setOpen(false); onAcraImport() }} className="flex w-full gap-3 rounded-md p-3 text-left hover:bg-ebios-50">
            <Braces size={18} className="mt-0.5 shrink-0 text-ebios-700" /><span><span className="block text-sm font-medium text-gray-800">{labels.acraTitle}</span><span className="block text-xs text-gray-500">{labels.acraDesc}</span></span>
          </button>
          <button role="menuitem" onClick={() => { setOpen(false); onExcelImport() }} className="flex w-full gap-3 rounded-md p-3 text-left hover:bg-ebios-50"><FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-ebios-700" /><span><span className="block text-sm font-medium text-gray-800">{labels.excelTitle}</span><span className="block text-xs text-gray-500">{labels.excelDesc}</span></span></button>
          <div className="flex gap-3 rounded-md p-3"><Plug size={18} className="mt-0.5 shrink-0 text-gray-500" /><span><span className="block text-sm font-medium text-gray-800">{labels.apiTitle}</span><span className="block text-xs text-gray-500">{labels.apiDesc}</span></span></div>
          <div className="flex gap-3 rounded-md p-3"><Sparkles size={18} className="mt-0.5 shrink-0 text-gray-500" /><span><span className="block text-sm font-medium text-gray-800">{labels.mcpTitle}</span><span className="block text-xs text-gray-500">{labels.mcpDesc}</span></span></div>
        </div>
      )}
    </div>
  )
}
