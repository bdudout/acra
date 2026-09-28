'use client'

import { FileText, FileSpreadsheet } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

/**
 * ExportButtons — liens de téléchargement de l'analyse, générés côté serveur par
 * /api/export/[id]?format=… (PDF via @react-pdf/renderer, Excel/CSV via ExcelJS).
 * EBIOS RM : PDF + CSV (défaut). Méthodes à saisie directe (ISO/IEC 27005,
 * ISO 31000, NIST SP 800-30) : PDF + Excel = rapport propre à la méthode (P4).
 * La langue du rapport suit celle de l'interface (?lang=).
 */
type Format = 'pdf' | 'csv' | 'xlsx'

interface Props {
  analyseId: string
  analyseName?: string
  formats?: Format[]
}

export default function ExportButtons({ analyseId, formats = ['pdf', 'csv'] }: Props) {
  const { t, locale } = useTranslation()
  const label: Record<Format, string> = { pdf: t.exportButtons.pdf, csv: t.exportButtons.csv, xlsx: t.exportButtons.xlsx }
  return (
    <div className="flex gap-2 flex-wrap">
      {formats.map(f => (
        <a
          key={f}
          href={`/api/export/${analyseId}?format=${f}&lang=${locale}`}
          download
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          {f === 'pdf' ? <FileText size={16} aria-hidden="true" /> : <FileSpreadsheet size={16} aria-hidden="true" />} {label[f]}
        </a>
      ))}
    </div>
  )
}
