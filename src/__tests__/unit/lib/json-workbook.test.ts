import { describe, it, expect } from 'vitest'
import { jsonToWorkbook } from '@/lib/json-workbook'
import { looksLikeAcraJson } from '@/lib/import-file-format'

const buf = (v: unknown) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v), 'utf8')
const rows = (ws: import('exceljs').Worksheet) => { const out: string[][] = []; ws.eachRow({ includeEmpty: false }, r => out.push((r.values as unknown[]).slice(1).map(v => (v == null ? '' : String(v))))); return out }

describe('looksLikeAcraJson', () => {
  it('reconnaît un export ACRA (analyse.nom ou nom à la racine) et refuse un JSON libre', () => {
    expect(looksLikeAcraJson('{"analyse":{"nom":"A"}}')).toBe(true)
    expect(looksLikeAcraJson('{"nom":"A"}')).toBe(true)
    expect(looksLikeAcraJson('{"registre":[{"id":"R1"}]}')).toBe(false)
    expect(looksLikeAcraJson('[1,2]')).toBe(false)
    expect(looksLikeAcraJson('pas du json')).toBe(true) // laisse la route ACRA produire le diagnostic JSON précis
  })
})

describe('jsonToWorkbook', () => {
  const doc = {
    cabinet: 'Cabinet fictif', perimetre: 'GED',
    echelles: { impact: ['Faible', 'Fort'] },
    registre: [
      { id: 'AV-01', libelle: 'Fuite', impact: 'Critique', proprietaire: { nom: 'DSI', role: 'RSSI' }, tags: ['a', 'b'],
        controles: [{ ref: 'C-01', titre: 'Cloisonner' }, { ref: 'C-02', titre: 'Chiffrer' }] },
      { id: 'AV-02', libelle: 'Fraude', impact: 'Fort', controles: [{ ref: 'C-01', titre: 'Cloisonner' }] },
    ],
  }
  it('un tableau d’objets devient une feuille : objets aplatis (a.b), listes de scalaires jointes', () => {
    const wb = jsonToWorkbook(buf(doc), 'registre.json')
    const ws = wb.getWorksheet('registre')!
    const r = rows(ws)
    expect(r[0]).toEqual(['id', 'libelle', 'impact', 'proprietaire.nom', 'proprietaire.role', 'tags'])
    expect(r[1]).toEqual(['AV-01', 'Fuite', 'Critique', 'DSI', 'RSSI', 'a; b'])
    expect(r[2].slice(0, 3)).toEqual(['AV-02', 'Fraude', 'Fort'])
  })
  it('tableaux imbriqués → feuille enfant avec colonne du parent ; contrôle partagé = deux lignes', () => {
    const wb = jsonToWorkbook(buf(doc), 'registre.json')
    const ws = wb.getWorksheet('registre.controles')!
    expect(rows(ws)).toEqual([
      ['registre', 'ref', 'titre'],
      ['AV-01', 'C-01', 'Cloisonner'], ['AV-01', 'C-02', 'Chiffrer'], ['AV-02', 'C-01', 'Cloisonner'],
    ])
  })
  it('scalaires de premier niveau → feuille clé/valeur ; tableaux de scalaires ignorés', () => {
    const wb = jsonToWorkbook(buf(doc), 'x.json')
    expect(rows(wb.getWorksheet('Propriétés')!)).toEqual([['Clé', 'Valeur'], ['cabinet', 'Cabinet fictif'], ['perimetre', 'GED']])
    expect(wb.worksheets.map(w => w.name)).not.toContain('echelles.impact')
  })
  it('racine = tableau d’objets : une feuille nommée d’après le fichier', () => {
    const wb = jsonToWorkbook(buf([{ a: 1 }, { a: 2 }]), 'liste.json')
    expect(rows(wb.worksheets[0])).toEqual([['a'], ['1'], ['2']])
    expect(wb.worksheets[0].name).toBe('liste')
  })
  it('cellules en texte inerte : « =1+1 » n’est jamais une formule', () => {
    const wb = jsonToWorkbook(buf([{ a: '=1+1' }]), 'f.json')
    expect(wb.worksheets[0].getCell(2, 1).value).toBe('=1+1')
  })
  it('bornes : profondeur, feuilles ≤ 20, noms uniques ≤ 31 caractères ; JSON invalide → exception', () => {
    let deep: unknown = [{ z: 1 }]; for (let i = 0; i < 30; i++) deep = { n: deep }
    expect(() => jsonToWorkbook(buf(deep), 'd.json')).not.toThrow()
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`t${i}`, [{ a: i }]]))
    expect(jsonToWorkbook(buf(many), 'm.json').worksheets.length).toBeLessThanOrEqual(20)
    expect(() => jsonToWorkbook(buf('{oups'), 'b.json')).toThrow()
    const long = jsonToWorkbook(buf({ ['x'.repeat(50)]: [{ a: 1 }] }), 'l.json')
    expect(long.worksheets[0].name.length).toBeLessThanOrEqual(31)
  })
  it('ne suit pas $ref et ignore __proto__', () => {
    const wb = jsonToWorkbook(buf('{"t":[{"$ref":"http://x/y","__proto__":{"p":1},"a":1}]}'), 'r.json')
    expect(rows(wb.getWorksheet('t')!)[0]).toContain('$ref')
    expect(({} as Record<string, unknown>).p).toBeUndefined()
  })
})
