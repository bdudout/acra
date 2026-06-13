'use client'

import { FileText } from 'lucide-react'

/**
 * PDFExportButton — triggers a server-side PDF download.
 *
 * The PDF is now generated on the server (via /api/export/[id]?format=pdf)
 * using @react-pdf/renderer — no jsPDF or browser APIs required.
 */
export default function PDFExportButton({ analyseId }: { analyseId: string }) {
  return (
    <a
      href={`/api/export/${analyseId}?format=pdf`}
      download
      className="btn-secondary inline-flex items-center gap-2"
    >
      <FileText size={16} aria-hidden="true" /> PDF
    </a>
  )
}
