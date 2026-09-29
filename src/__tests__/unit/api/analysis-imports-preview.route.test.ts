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
  it('.xlsm / .ods / .csv : excel_format_unsupported ; fichier vide ou texte renommé', async () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
    expect((await (await POST(post('a.xlsm', zip))).json()).error).toBe('excel_format_unsupported')
    expect((await (await POST(post('a.csv', Buffer.from('a;b')))).json()).error).toBe('excel_format_unsupported')
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
