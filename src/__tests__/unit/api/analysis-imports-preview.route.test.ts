// @vitest-environment node
/** Prévisualisation d'un import Excel : format (.xls), en-têtes, rôles, formules sans valeur, jeu d'essai local. */
import ExcelJS from 'exceljs'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), role: vi.fn(), rl: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope, getEffectiveRoleForOrg: m.role }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_EXCEL_PARSE: { limit: 30, windowMs: 600_000 } }))
import { POST } from '@/app/api/analysis-imports/preview/route'

const post = (filename: string, bytes: Buffer | Uint8Array) => new NextRequest('http://x/api/analysis-imports/preview', { method: 'POST', body: JSON.stringify({ filename, data: Buffer.from(bytes).toString('base64') }), headers: { 'content-type': 'application/json' } })
const OLE2 = Buffer.concat([Buffer.from('D0CF11E0A1B11AE1', 'hex'), Buffer.alloc(504)])

async function classeur(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('5 - Risques initiaux')
  ws.getCell('A1').value = 'Analyse de risques 5 - Traitement des risques initiaux'; ws.mergeCells('A1:H1')
  ;['Réf.RI', 'Réf.SS', 'Gravité initiale', 'Réf.SO', 'Vraisemblance initiale', 'Niveau de risque initial', 'Description du risque', 'Traitement du risque initial'].forEach((h, i) => { ws.getCell(5, i + 1).value = h })
  ws.getCell('A6').value = 'RI_01'; ws.getCell('C6').value = '2 - Limitée'; ws.getCell('G6').value = 'Un utilisateur abuse de ses droits'
  ws.getCell('F6').value = { formula: 'C6*2' } // jamais recalculée
  ws.getCell('A7').value = 'RI_02'; ws.getCell('G7').value = 'Un attaquant usurpe un compte'
  const scales = wb.addWorksheet('Métriques')
  ;['Besoins de sécurité', 'Échelle de gravité', 'Échelle de vraisemblance', 'Échelle des niveaux de risques'].forEach((h, i) => { scales.getCell(2, i + 1).value = h })
  scales.getCell('A3').value = 'Niveau'; scales.getCell('B3').value = '4 - Critique'
  return Buffer.from(await wb.xlsx.writeBuffer())
}

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1' })
  m.role.mockResolvedValue('ANALYSTE')
  m.rl.mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 })
})

describe('POST /api/analysis-imports/preview — format', () => {
  it('.xls (ou .xls renommé) : excel_xls_unsupported, avant toute lecture', async () => {
    for (const name of ['audit.xls', 'audit.xlsx']) {
      const res = await POST(post(name, OLE2))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('excel_xls_unsupported')
    }
  })
  it('.xlsm / .ods : excel_format_unsupported ; texte renommé en .xlsx illisible', async () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
    expect((await (await POST(post('a.xlsm', zip))).json()).error).toBe('excel_format_unsupported')
    expect((await (await POST(post('a.ods', zip))).json()).error).toBe('excel_format_unsupported')
    expect((await (await POST(post('a.xlsx', Buffer.from('pas un classeur')))).json()).error).toBe('excel_workbook_unreadable')
  })
})

describe('POST /api/analysis-imports/preview — lecture', () => {
  it('titre fusionné ignoré : en-tête en ligne 5, rôle Risques, formule sans valeur signalée, feuille d’échelles non proposée', async () => {
    const res = await POST(post('risques.xlsx', await classeur()))
    expect(res.status).toBe(200)
    const { sheets } = await res.json()
    const ri = sheets.find((s: { name: string }) => s.name === '5 - Risques initiaux')
    expect(ri).toMatchObject({ headerRow: 5, rows: 2, detection: { type: 'RISKS' } })
    expect(ri.warnings.formulasWithoutValue).toEqual({ count: 1, samples: ['F6'] })
    const met = sheets.find((s: { name: string }) => s.name === 'Métriques')
    expect(met.detection.type).toBe('UNKNOWN')
  })
})

// Jeu d'essai LOCAL (dossier exclu de git) : ignoré en CI.
const LOCAL = join(process.cwd(), '.local-fixtures/import-universel')
describe.skipIf(!existsSync(join(LOCAL, 'dossier-securite-btp.xlsx')))('jeu d’essai local — dossier de sécurité EBIOS RM (BTP, avocats)', () => {
  for (const f of ['dossier-securite-btp.xlsx', 'dossier-securite-avocats.xlsx']) {
    it(`${f} : aucune feuille d’échelles ou de scénarios classée « Risques » ; en-têtes trouvés`, async () => {
      const res = await POST(post(f, readFileSync(join(LOCAL, f))))
      expect(res.status).toBe(200)
      const by = Object.fromEntries((await res.json()).sheets.map((s: { name: string; detection: { type: string }; headerRow: number; rows: number; columns: string[] }) => [s.name, s]))
      expect(by['Métriques'].detection.type).not.toBe('RISKS')
      expect(by['3 - S.Stratégiques'].detection.type).not.toBe('RISKS')
      expect(by['4 - S.Opérationnels'].detection.type).not.toBe('RISKS')
      expect(by['1 - SROV'].headerRow).toBe(5)
      expect(by['5 - Risques initiaux'].headerRow).toBe(5)
      expect(by['5 - Risques initiaux'].detection.type).toBe('RISKS')
      expect(by['5 - Risques résiduels'].headerRow).toBe(6)
      expect(by['5 - PACS'].detection.type).toBe('MEASURES')
      expect(by['1 - Valeurs Métiers'].headerRow).toBe(6)
      expect(by['1 - Valeurs Métiers'].columns).toContain('Besoins de sécurité › Disponibilité')
      expect(by['1 - Valeurs Métiers'].rows).toBe(10) // 6 renseignées + 4 lignes modèles (ignorées à l'import)
      expect(by['2 - Parties prenantes'].warnings.formulasWithoutValue.count).toBeGreaterThan(0)
    }, 60_000)
  }
})

// Chaîne complète sur le jeu d'essai LOCAL : aperçu (rôles, mapping suggéré) → paquet canonique v3 → validation du paquet.
import { buildHistoricImportPackage, partitionHistoricImportSheets, detectHistoricHeaderLayout, type HistoricImportSheet } from '@/lib/historic-import'
import { parseAnalysisImportRequest, summarizeAnalysisImport } from '@/lib/analysis-import'
import { summarizeAtelierContent } from '@/lib/analysis-import-ateliers'
import { readSheetSample, readDataRows } from '@/lib/excel-grid'
import { BUILTIN_PROFILES, profileToSelection } from '@/lib/import-profile'
import { extractKeyValueBlocks, extractTextBlocks } from '@/lib/excel-blocks'
describe.skipIf(!existsSync(join(LOCAL, 'dossier-securite-btp.xlsx')))('jeu d’essai local — du classeur au paquet canonique', () => {
  for (const f of ['dossier-securite-btp.xlsx', 'dossier-securite-avocats.xlsx']) {
    it(`${f} : ateliers 1 à 5 repris avec leurs liens`, async () => {
      const res = await POST(post(f, readFileSync(join(LOCAL, f))))
      const preview = (await res.json()).sheets as { name: string; columns: string[]; mapping: Record<string, string>; detection: { type: string } }[]
      const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(join(LOCAL, f))
      // Le profil livré fixe rôles et colonnes (comme après « Appliquer ce profil » dans l'assistant).
      const sel = profileToSelection(BUILTIN_PROFILES[0], preview.map(p => ({ name: p.name, columns: p.columns })))
      const sheets: HistoricImportSheet[] = preview.map(p => ({ ...p, detection: { type: sel.sheetTypes[p.name] ?? p.detection.type }, mapping: sel.mappings[p.name] ?? p.mapping })).filter(p => p.detection.type !== 'UNKNOWN').map(p => {
        const ws = wb.getWorksheet(p.name)!
        if (p.detection.type === 'CONTEXT') { const r = readSheetSample(ws, 80, 20); return { name: p.name, type: 'CONTEXT' as never, mapping: {}, rows: [], blocks: { text: extractTextBlocks(r), kv: extractKeyValueBlocks(r) } } }
        const layout = detectHistoricHeaderLayout(readSheetSample(ws, 20, 100))
        const refCol = layout.columns.find(c => c.key === p.mapping.externalId)?.index
        const { rows } = readDataRows(ws, layout, { refColumnIndex: refCol })
        return { name: p.name, type: p.detection.type as never, mapping: p.mapping, rows }
      })
      const roles = Object.fromEntries(sheets.map(s => [s.name, s.type]))
      expect(roles['1 - Valeurs Métiers']).toBe('BUSINESS_VALUES')
      expect(roles['1 - Événements redoutés']).toBe('FEARED_EVENTS')
      expect(roles['1 - SROV']).toBe('RISK_SOURCES')
      expect(roles['2 - Biens supports']).toBe('SUPPORT_ASSETS')
      expect(roles['2 - Parties prenantes']).toBe('STAKEHOLDERS')
      expect(roles['2 - Socle de sécurité']).toBe('SECURITY_BASELINE')
      expect(roles['5 - Risques résiduels']).toBe('RESIDUAL_RISKS')
      expect(roles['1 - Périmètre']).toBe('CONTEXT')
      expect(roles['Page de garde']).toBe('CONTEXT')
      expect(roles['3 - S.Stratégiques']).toBe('STRATEGIC_SCENARIOS')
      expect(roles['4 - S.Opérationnels']).toBe('OPERATIONAL_SCENARIOS')
      const { sheets: kept } = partitionHistoricImportSheets(sheets)
      const pkg = buildHistoricImportPackage(kept, f)
      const parsed = parseAnalysisImportRequest({ ...pkg, idempotencyKey: 'essai-import-0001' })
      const a = summarizeAtelierContent(parsed, parsed.risks.flatMap(r => (r.externalId ? [r.externalId] : [])))
      expect(a.counts).toMatchObject({ businessValues: 6, fearedEvents: 8, riskSources: 10, stakeholders: 14, strategicScenarios: 8, operationalScenarios: 13 })
      expect(parsed.supportAssets.length).toBeGreaterThanOrEqual(5)
      expect(parsed.supportAssets.length).toBeLessThan(20) // catalogue de 73 biens : seuls les retenus
      expect(parsed.securityBaseline.length).toBeGreaterThan(20)
      expect(parsed.context?.perimetre?.length).toBeGreaterThan(50)
      expect(parsed.context?.contexteJuridique).toBeTruthy()
      expect(parsed.analysis.title).toMatch(/Application de suivi|Espace client/)
      expect(parsed.analysis.description).toContain('Rédacteur')
      // Plan de mesures : références « R_01 à R_09 » rapprochées des risques RI_ seulement avec l'alias validé
      const pacs = kept.find(x => x.name === '5 - PACS')!
      const withProfile = pacs
      const sansAlias = buildHistoricImportPackage([...kept.filter(x => x.name !== '5 - PACS'), withProfile], f)
      const avecAlias = buildHistoricImportPackage([...kept.filter(x => x.name !== '5 - PACS'), { ...withProfile, refAliases: { R: 'RI' } }], f)
      expect(sansAlias.measures.filter(m => m.riskExternalId && sansAlias.risks.some(r => r.externalId === m.riskExternalId))).toHaveLength(0)
      expect(avecAlias.measures.filter(m => m.riskExternalId && avecAlias.risks.some(r => r.externalId === m.riskExternalId)).length).toBeGreaterThanOrEqual(8)
      expect(parsed.residualRisks.length).toBe(13)
      expect(a.warnings.filter(w => w.startsWith('residual_risk'))).toEqual([])
      expect(parsed.risks.length).toBe(13)
      expect(summarizeAnalysisImport(parsed).created.risks).toBe(13)
      // références VM02 / VM_02, ER03 / ER_03 : toutes résolues, seules les références absentes du fichier sont signalées
      expect(a.warnings.filter(w => w.startsWith('feared_event_business_value_not_found'))).toEqual([])
    }, 60_000)
  }
})

describe('POST /api/analysis-imports/preview — CSV (un CSV vaut une feuille)', () => {
  it('registre plat en ;, cotations en clair : rôle Risques, en-têtes et lignes lues', async () => {
    const csv = '﻿Réf;Risque;Description;Impact;Probabilité;Traitement\r\nR-01;Rançongiciel;Chiffrement des serveurs;Critique;Vraisemblable;Réduire\r\nR-02;Fuite;Export non autorisé;Importante;Peu vraisemblable;Réduire\r\n'
    const res = await POST(post('registre-simple.csv', Buffer.from(csv, 'utf8')))
    expect(res.status).toBe(200)
    const { sheets } = await res.json()
    expect(sheets).toHaveLength(1)
    expect(sheets[0]).toMatchObject({ name: 'registre-simple', headerRow: 1, rows: 2, detection: { type: 'RISKS' } })
    expect(sheets[0].mapping).toMatchObject({ externalId: 'Réf', gravity: 'Impact', likelihood: 'Probabilité' })
  })
  it('un .xls reste refusé, même via l’assistant CSV', async () => {
    expect((await (await POST(post('a.xls', OLE2))).json()).error).toBe('excel_xls_unsupported')
  })
})

describe('POST /api/analysis-imports/preview — JSON de forme libre', () => {
  it('registre imbriqué : feuille du registre + feuille enfant des contrôles + propriétés', async () => {
    const doc = { cabinet: 'Cabinet fictif', registre: [{ id: 'AV-01', libelle: 'Fuite', impact: 'Critique', probabilite: 'Possible', controles: [{ ref: 'C-01', titre: 'Cloisonner' }] }] }
    const res = await POST(post('registre-libre.json', Buffer.from(JSON.stringify(doc))))
    expect(res.status).toBe(200)
    const { sheets } = await res.json()
    expect(sheets.map((s: { name: string }) => s.name)).toEqual(['Propriétés', 'registre', 'registre.controles'])
    expect(sheets[1]).toMatchObject({ rows: 1, columns: ['id', 'libelle', 'impact', 'probabilite'] })
    expect(sheets[2].columns).toEqual(['registre', 'ref', 'titre'])
  })
  it('JSON invalide : code précis avec position, pas d’erreur générique', async () => {
    const res = await POST(post('mauvais.json', Buffer.from('{"a": [1, 2,]}')))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('json_invalid')
    expect(body.details).toMatchObject({ line: 1 })
  })
})
