// ─── Conversion Markdown → .docx ─────────────────────────────────────────────
// Les modèles d'annexes contractuelles (document-templates.ts) sont rédigés en
// Markdown simple. Pour être joints tels quels à des contrats, on les génère en
// .docx. Ce module sépare le PARSING (pur, testé) du RENDU docx (lib `docx`).
// Sous-ensemble Markdown supporté (celui des modèles) : titres # / ##, citations
// « > », listes « - », tables « | … | », gras **…**, paragraphes.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx'

export interface InlineRun { text: string; bold: boolean }
export type MdBlock =
  | { type: 'h1' | 'h2' | 'p' | 'quote' | 'bullet'; runs: InlineRun[] }
  | { type: 'table'; rows: InlineRun[][][] } // rows → cells → runs

/** Découpe un texte en runs, en isolant le gras `**…**`. */
export function parseInline(text: string): InlineRun[] {
  const out: InlineRun[] = []
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  for (const p of parts) {
    if (!p) continue
    if (p.startsWith('**') && p.endsWith('**') && p.length >= 4) {
      out.push({ text: p.slice(2, -2), bold: true })
    } else {
      out.push({ text: p, bold: false })
    }
  }
  return out.length ? out : [{ text: '', bold: false }]
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const isTableSep = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes('-')

function parseTableRow(l: string): InlineRun[][] {
  const cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.map(c => parseInline(c.trim()))
}

/** Parse le Markdown des modèles en blocs structurés (pur, sans dépendance docx). */
export function parseMarkdownBlocks(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim()) continue
    // Table : bloc de lignes contiguës commençant par « | ».
    if (isTableRow(l)) {
      const rows: InlineRun[][][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isTableSep(lines[i])) rows.push(parseTableRow(lines[i]))
        i++
      }
      i-- // compense le i++ de la boucle for
      if (rows.length) blocks.push({ type: 'table', rows })
      continue
    }
    if (l.startsWith('## ')) { blocks.push({ type: 'h2', runs: parseInline(l.slice(3).trim()) }); continue }
    if (l.startsWith('# ')) { blocks.push({ type: 'h1', runs: parseInline(l.slice(2).trim()) }); continue }
    if (l.startsWith('> ')) { blocks.push({ type: 'quote', runs: parseInline(l.slice(2).trim()) }); continue }
    if (/^[-*] /.test(l)) { blocks.push({ type: 'bullet', runs: parseInline(l.slice(2).trim()) }); continue }
    blocks.push({ type: 'p', runs: parseInline(l.trim()) })
  }
  return blocks
}

// ─── Rendu docx ──────────────────────────────────────────────────────────────

const toRuns = (runs: InlineRun[], opts: { italics?: boolean } = {}) =>
  runs.map(r => new TextRun({ text: r.text, bold: r.bold, italics: opts.italics }))

function blockToDocx(b: MdBlock): Paragraph | Table {
  if (b.type === 'table') {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: b.rows.map((row, ri) => new TableRow({
        children: row.map(cell => new TableCell({
          children: [new Paragraph({ children: toRuns(cell.map(r => ({ ...r, bold: r.bold || ri === 0 }))) })],
        })),
      })),
    })
  }
  switch (b.type) {
    case 'h1': return new Paragraph({ heading: HeadingLevel.HEADING_1, children: toRuns(b.runs) })
    case 'h2': return new Paragraph({ heading: HeadingLevel.HEADING_2, children: toRuns(b.runs) })
    case 'quote': return new Paragraph({ children: toRuns(b.runs, { italics: true }), spacing: { after: 120 } })
    case 'bullet': return new Paragraph({ bullet: { level: 0 }, children: toRuns(b.runs) })
    default: return new Paragraph({ children: toRuns(b.runs), spacing: { after: 120 } })
  }
}

/** Construit un buffer .docx à partir d'un titre + d'un contenu Markdown. */
export async function markdownToDocxBuffer(titre: string, markdown: string): Promise<Buffer> {
  const blocks = parseMarkdownBlocks(markdown)
  const doc = new Document({
    creator: 'ACRA',
    title: titre,
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    sections: [{ children: blocks.map(blockToDocx) }],
  })
  return Packer.toBuffer(doc)
}

// Bordures fines par défaut pour les tables (appliquées via la config du doc).
export const DOCX_TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
