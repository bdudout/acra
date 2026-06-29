'use client'

import { FileText } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

/**
 * PDFExportButton — triggers a server-side PDF download.
 *
 * The PDF is generated on the server (via /api/export/[id]?format=pdf&lang=…)
 * using @react-pdf/renderer — no jsPDF or browser APIs required. La locale
 * courante est transmise pour que le rapport soit rendu dans la langue de l'UI.
 */
export default function PDFExportButton({ analyseId }: { analyseId: string }) {
  const { locale } = useTranslation()
  return (
    <a
      href={`/api/export/${analyseId}?format=pdf&lang=${locale}`}
      download
      className="btn-secondary inline-flex items-center gap-2"
    >
      <FileText size={16} aria-hidden="true" /> PDF
    </a>
  )
}
