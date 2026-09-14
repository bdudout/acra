import { describe, it, expect } from 'vitest'
import { parseMarkdownBlocks, parseInline } from '@/lib/markdown-docx'

describe('parseInline', () => {
  it('découpe le gras **...**', () => {
    expect(parseInline('a **b** c')).toEqual([
      { text: 'a ', bold: false }, { text: 'b', bold: true }, { text: ' c', bold: false },
    ])
  })
  it('texte simple → une seule run', () => {
    expect(parseInline('rien')).toEqual([{ text: 'rien', bold: false }])
  })
})

describe('parseMarkdownBlocks', () => {
  it('titres, paragraphes, citations et puces', () => {
    const md = `# Titre\n\n> Note importante\n\n## Section\nUn paragraphe.\n- point A\n- point B`
    const b = parseMarkdownBlocks(md)
    expect(b[0]).toEqual({ type: 'h1', runs: [{ text: 'Titre', bold: false }] })
    expect(b[1]).toEqual({ type: 'quote', runs: [{ text: 'Note importante', bold: false }] })
    expect(b[2]).toEqual({ type: 'h2', runs: [{ text: 'Section', bold: false }] })
    expect(b[3]).toEqual({ type: 'p', runs: [{ text: 'Un paragraphe.', bold: false }] })
    expect(b[4]).toMatchObject({ type: 'bullet' })
    expect(b[5]).toMatchObject({ type: 'bullet' })
  })

  it('table : ignore la ligne de séparation, garde en-tête + corps', () => {
    const md = `| Activité | RTO |\n|---|---|\n| Paie | 4h |`
    const b = parseMarkdownBlocks(md)
    expect(b).toHaveLength(1)
    expect(b[0].type).toBe('table')
    const t = b[0] as Extract<ReturnType<typeof parseMarkdownBlocks>[number], { type: 'table' }>
    expect(t.rows).toHaveLength(2) // en-tête + 1 ligne (séparateur retiré)
    expect(t.rows[0][0][0].text).toBe('Activité')
    expect(t.rows[1][1][0].text).toBe('4h')
  })

  it('les lignes vides ne produisent pas de bloc', () => {
    expect(parseMarkdownBlocks('\n\n')).toEqual([])
  })
})
