'use client'

import { FileText, FileSpreadsheet } from 'lucide-react'

/**
 * ExportButtons — CSV + PDF download links.
 *
 * The PDF is now generated server-side at /api/export/[id]?format=pdf
 * using @react-pdf/renderer — no jsPDF or browser APIs required.
 */
interface Props {
  analyseId: string
  analyseName: string
}

export default function ExportButtons({ analyseId }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      <a
        href={`/api/export/${analyseId}?format=pdf`}
        download
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <FileText size={16} aria-hidden="true" /> Exporter PDF
      </a>
      <a
        href={`/api/export/${analyseId}?format=csv`}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <FileSpreadsheet size={16} aria-hidden="true" /> Exporter CSV
      </a>
    </div>
  )
}
