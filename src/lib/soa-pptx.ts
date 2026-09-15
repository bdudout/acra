// ─── Statement of Applicability (SoA) — export PowerPoint (.pptx) ────────────
// Génère un deck PowerPoint de la déclaration d'applicabilité : diapo de garde
// (contexte + taux) + tableau paginé de TOUS les contrôles avec leur statut.
// S'appuie sur buildSoaExport (structure pure) ; le rendu binaire est délégué à
// pptxgenjs. Utilisé par la route API SoA (format=pptx).

import PptxGenJS from 'pptxgenjs'
import type { SoaExportData, SoaLigne } from './soa-export'

export interface SoaPptxLabels {
  title: string          // ex. « Déclaration d'applicabilité (SoA) »
  org: string            // libellé « Organisation »
  framework: string      // libellé « Référentiel »
  rate: string           // libellé « Taux de conformité »
  evaluated: string      // libellé « Contrôles évalués »
  colRef: string
  colControl: string
  colCategory: string
  colStatus: string
  colComment: string
  notEvaluated: string
  statuts: Record<string, string> // conforme/partiel/non_conforme/na → libellé
}

export interface SoaPptxStats { tauxConformite: number; evalues: number; total: number }

// Couleurs de fond des cellules de statut (hex sans #), texte foncé lisible.
const STATUT_FILL: Record<string, string> = {
  conforme: 'DCFCE7', partiel: 'FEF3C7', non_conforme: 'FEE2E2', na: 'F1F5F9', deroge: 'EDE9FE',
}
const STATUT_TEXT: Record<string, string> = {
  conforme: '166534', partiel: '92400E', non_conforme: '991B1B', na: '475569', deroge: '5B21B6',
}

const BRAND = '1E2761'   // bleu nuit (garde)
const INK = '1F2937'
const MUTED = '6B7280'
const LINE = 'E5E7EB'

function statutLabel(l: SoaLigne, labels: SoaPptxLabels): string {
  return l.statut ? (labels.statuts[l.statut] ?? l.statut) : labels.notEvaluated
}

/**
 * Construit le deck SoA et renvoie un Buffer .pptx (Node).
 * Pur d'effet de bord réseau ; ne dépend que de pptxgenjs.
 */
export async function renderSoaPptx(
  data: SoaExportData,
  stats: SoaPptxStats,
  orgNom: string,
  frameworkNom: string,
  stamp: string,
  labels: SoaPptxLabels,
): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.3 × 7.5 pouces
  pptx.author = 'ACRA'
  pptx.company = orgNom

  // ── Diapo de garde ─────────────────────────────────────────────────────────
  const cover = pptx.addSlide()
  cover.background = { color: BRAND }
  cover.addText(labels.title, { x: 0.7, y: 1.3, w: 8.0, h: 0.9, fontSize: 32, bold: true, color: 'FFFFFF' })
  cover.addText(frameworkNom, { x: 0.7, y: 2.2, w: 8.0, h: 0.6, fontSize: 22, color: 'CADCFC' })
  cover.addText(
    [
      { text: `${labels.org} : `, options: { bold: true, color: 'FFFFFF' } },
      { text: orgNom, options: { color: 'CADCFC' } },
    ],
    { x: 0.7, y: 3.25, w: 8.0, h: 0.4, fontSize: 14 },
  )
  cover.addText(stamp, { x: 0.7, y: 3.7, w: 8.0, h: 0.4, fontSize: 12, color: 'AAB4E6' })

  // Grand taux (haut-droite, à l'écart du bandeau de répartition)
  cover.addText(`${stats.tauxConformite}%`, { x: 9.0, y: 1.2, w: 3.6, h: 1.4, fontSize: 60, bold: true, color: 'FFFFFF', align: 'right' })
  cover.addText(
    `${labels.rate}  ·  ${labels.evaluated} : ${stats.evalues}/${stats.total}`,
    { x: 6.6, y: 2.7, w: 6.0, h: 0.4, fontSize: 12, color: 'CADCFC', align: 'right' },
  )

  // Bandeau de répartition (conforme / partiel / non conforme / na / non évalué)
  const p = data.parStatut
  const repartition: { k: string; n: number; label: string }[] = [
    { k: 'conforme', n: p.conforme, label: labels.statuts.conforme },
    { k: 'partiel', n: p.partiel, label: labels.statuts.partiel },
    { k: 'non_conforme', n: p.nonConforme, label: labels.statuts.non_conforme },
    { k: 'na', n: p.na, label: labels.statuts.na },
    { k: 'nonEvalue', n: p.nonEvalue, label: labels.notEvaluated },
  ]
  repartition.forEach((r, i) => {
    const x = 0.7 + i * 2.35
    cover.addText(String(r.n), { x, y: 5.0, w: 2.1, h: 0.7, fontSize: 30, bold: true, color: 'FFFFFF', align: 'center' })
    cover.addText(r.label, { x, y: 5.7, w: 2.1, h: 0.5, fontSize: 11, color: 'CADCFC', align: 'center' })
  })

  // ── Diapo(s) tableau — paginées automatiquement ─────────────────────────────
  const table = pptx.addSlide()
  table.addText(`${labels.title} — ${frameworkNom}`, { x: 0.4, y: 0.25, w: 12.5, h: 0.5, fontSize: 16, bold: true, color: INK })

  const headRow = [labels.colRef, labels.colControl, labels.colCategory, labels.colStatus, labels.colComment].map(text => ({
    text,
    options: { bold: true, color: 'FFFFFF', fill: { color: BRAND }, valign: 'middle' as const },
  }))

  const bodyRows = data.lignes.map(l => ([
    { text: l.ref, options: { color: INK, valign: 'middle' as const, fontSize: 9 } },
    { text: l.nom, options: { color: INK, valign: 'middle' as const, fontSize: 9 } },
    { text: l.categorie ?? '', options: { color: MUTED, valign: 'middle' as const, fontSize: 9 } },
    {
      text: statutLabel(l, labels),
      options: {
        valign: 'middle' as const, align: 'center' as const, bold: true, fontSize: 9,
        fill: { color: l.statut ? (STATUT_FILL[l.statut] ?? 'F8FAFC') : 'F8FAFC' },
        color: l.statut ? (STATUT_TEXT[l.statut] ?? MUTED) : MUTED,
      },
    },
    { text: l.commentaire ?? '', options: { color: MUTED, valign: 'middle' as const, fontSize: 8 } },
  ]))

  table.addTable([headRow, ...bodyRows], {
    x: 0.4, y: 0.9, w: 12.5,
    colW: [1.2, 4.6, 1.7, 1.5, 3.5],
    border: { type: 'solid', color: LINE, pt: 0.5 },
    fontFace: 'Calibri', fontSize: 9,
    valign: 'middle',
    // NB : `margin` en tableau (ex. [2,3,2,3]) fait exploser la hauteur estimée des
    // lignes dans pptxgenjs (1-2 lignes/diapo). Défaut conservé volontairement.
    autoPage: true, autoPageRepeatHeader: true, autoPageHeaderRows: 1,
    newSlideStartY: 0.9,
  })

  const out = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
  return out
}
