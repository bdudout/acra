import { describe, expect, it } from 'vitest'
import { detectTableIslands, extractKeyValueBlocks, extractTextBlocks } from '@/lib/excel-blocks'

describe('detectTableIslands — plusieurs tableaux côte à côte (B-IMP-14)', () => {
  const rows = [
    ['Besoins de sécurité', '', '', '', '', 'Échelle de gravité', '', '', ''],
    ['Critère / Niveau', 'Disponibilité', 'Intégrité', '', '', 'Niveau', 'Description', '', ''],
    ['4', '', '', '', '', '4 - Critique', 'Impact majeur', '', ''],
    ['3', '', '', '', '', '3 - Importante', 'Impact fort', '', ''],
  ]
  it('sépare les îlots par les colonnes entièrement vides', () => {
    const islands = detectTableIslands(rows)
    expect(islands.map(i => [i.firstColumn, i.lastColumn])).toEqual([[0, 2], [5, 6]])
    expect(islands[0].title).toBe('Besoins de sécurité')
    expect(islands[1].title).toBe('Échelle de gravité')
  })
  it('un seul tableau : un seul îlot', () => {
    expect(detectTableIslands([['A', 'B'], ['1', '2']])).toHaveLength(1)
  })
  it('feuille vide', () => expect(detectTableIslands([[], ['', '']])).toEqual([]))
})

describe('extractKeyValueBlocks — page de garde (B-IMP-15)', () => {
  const rows = [
    ['Analyse de risques XXX', '', '', ''],
    ['', 'Propriétés du document', '', ''],
    ['', 'Rédacteur', 'A. Martin', '2026-01-12'],
    ['', 'Nom projet', 'Suivi de chantiers', ''],
    ['', 'N° DDS Sécurité', '', ''],
    ['', 'PRT', 'T00X', ''],
  ]
  it('paires libellé → valeurs ; libellé sans valeur conservé vide ; titre de section ignoré', () => {
    expect(extractKeyValueBlocks(rows)).toEqual([
      { key: 'Rédacteur', values: ['A. Martin', '2026-01-12'], row: 3, column: 2 },
      { key: 'Nom projet', values: ['Suivi de chantiers'], row: 4, column: 2 },
      { key: 'N° DDS Sécurité', values: [], row: 5, column: 2 },
      { key: 'PRT', values: ['T00X'], row: 6, column: 2 },
    ])
  })
})

describe('extractTextBlocks — texte libre (périmètre)', () => {
  it('titre court suivi d’un paragraphe', () => {
    const rows = [['Contexte du projet et description fonctionnelle :'], ['Application mobile de suivi de chantiers : planning, pointage, photos et échanges avec les sous-traitants.'], [], ['Contexte juridique :'], ['RGPD, code du travail.']]
    expect(extractTextBlocks(rows)).toEqual([
      { title: 'Contexte du projet et description fonctionnelle', text: 'Application mobile de suivi de chantiers : planning, pointage, photos et échanges avec les sous-traitants.', row: 1 },
      { title: 'Contexte juridique', text: 'RGPD, code du travail.', row: 4 },
    ])
  })
})

// Jeu d'essai LOCAL (dossier exclu de git) : ignoré en CI.
import ExcelJS from 'exceljs'
import { existsSync } from 'fs'
import { join } from 'path'
import { readSheetSample } from '@/lib/excel-grid'
const LOCAL = join(process.cwd(), '.local-fixtures/import-universel/dossier-securite-btp.xlsx')
describe.skipIf(!existsSync(LOCAL))('jeu d’essai local — blocs du dossier de sécurité', () => {
  it('page de garde en clé/valeur, périmètre en blocs de texte, métriques en plusieurs îlots', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(LOCAL)
    const kv = extractKeyValueBlocks(readSheetSample(wb.getWorksheet('Page de garde')!, 40, 10))
    expect(kv.find(x => x.key === 'Nom projet')?.values[0]).toBe('Application de suivi de chantiers')
    expect(kv.find(x => x.key === 'Rédacteur')?.values[0]).toContain('fictif')
    const texts = extractTextBlocks(readSheetSample(wb.getWorksheet('1 - Périmètre')!, 20, 5))
    expect(texts.map(t => t.title)).toEqual(['Contexte du projet et description fonctionnelle', 'Contexte juridique et réglementaire', 'Architectures Fonctionnelle, solution et technique'])
    const islands = detectTableIslands(readSheetSample(wb.getWorksheet('Métriques')!, 12, 92))
    expect(islands.length).toBeGreaterThanOrEqual(8)
    expect(islands.map(i => i.title)).toContain('Échelle de gravité')
  }, 60_000)
})
