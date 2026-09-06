'use client'

import { Presentation } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

/**
 * PptxExportButton — déclenche le téléchargement d'une présentation PowerPoint
 * (managériale + annexes) via /api/export/[id]?format=pptx&lang=…, générée
 * côté serveur avec pptxgenjs. Même endpoint et mêmes droits que l'export PDF.
 */
export default function PptxExportButton({ analyseId }: { analyseId: string }) {
  const { locale } = useTranslation()
  return (
    <a
      href={`/api/export/${analyseId}?format=pptx&lang=${locale}`}
      download
      className="btn-secondary inline-flex items-center gap-2"
    >
      <Presentation size={16} aria-hidden="true" /> PowerPoint
    </a>
  )
}
