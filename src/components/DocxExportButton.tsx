'use client'

import { FileText } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

/**
 * DocxExportButton — télécharge un rapport Word (.docx) de l'analyse via
 * /api/export/[id]?format=docx&lang=…, généré côté serveur (lib « docx »).
 * Même endpoint et mêmes droits que les exports PDF/PPTX.
 */
export default function DocxExportButton({ analyseId }: { analyseId: string }) {
  const { locale } = useTranslation()
  return (
    <a
      href={`/api/export/${analyseId}?format=docx&lang=${locale}`}
      download
      className="btn-secondary inline-flex items-center gap-2"
    >
      <FileText size={16} aria-hidden="true" /> Word
    </a>
  )
}
