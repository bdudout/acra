import { describe, expect, it } from 'vitest'
import { IMPORT_ERROR_CODES, importErrorStatus } from '@/lib/import-errors'
import { fr } from '@/lib/i18n/fr'
import { en } from '@/lib/i18n/en'
import { de } from '@/lib/i18n/de'
import { es } from '@/lib/i18n/es'
import { it as itLocale } from '@/lib/i18n/it'

const LOCALES = { fr, en, de, es, it: itLocale } as const

describe('codes d’erreur d’import : chacun est expliqué dans les 5 langues', () => {
  for (const [name, t] of Object.entries(LOCALES)) {
    it(`${name} : titre, cause probable et solution pour chaque code`, () => {
      const errors = t.analyses.importMenu.importErrors as Record<string, { title: string; likelyCauses: string; solution: string }>
      for (const code of IMPORT_ERROR_CODES) {
        expect(errors[code], `${name}.${code}`).toBeTruthy()
        for (const k of ['title', 'likelyCauses', 'solution'] as const) expect(errors[code][k].length, `${name}.${code}.${k}`).toBeGreaterThan(3)
      }
    })
    it(`${name} : détail de localisation et causes reconnues`, () => {
      const m = t.analyses.importMenu as unknown as { importDetail: string; importHints: Record<string, string> }
      expect(m.importDetail).toContain('{line}'); expect(m.importDetail).toContain('{column}'); expect(m.importDetail).toContain('{snippet}')
      for (const h of ['trailing_comma', 'single_quotes', 'comments', 'truncated']) expect(m.importHints[h]?.length).toBeGreaterThan(10)
    })
  }
  it('le message .xls dit explicitement que .xlsx est pris en charge (5 langues)', () => {
    for (const [name, t] of Object.entries(LOCALES)) {
      const e = (t.analyses.importMenu.importErrors as Record<string, { title: string; likelyCauses: string; solution: string }>).excel_xls_unsupported
      expect(`${e.title} ${e.likelyCauses} ${e.solution}`, name).toMatch(/\.xls\b/)
      expect(`${e.title} ${e.likelyCauses} ${e.solution}`, name).toMatch(/\.xlsx/)
    }
  })
  it('statuts HTTP cohérents', () => {
    expect(importErrorStatus('excel_xls_unsupported')).toBe(400)
    expect(importErrorStatus('json_invalid')).toBe(422)
    expect(importErrorStatus('import_file_too_large')).toBe(413)
    expect(importErrorStatus('import_rate_limited')).toBe(429)
  })
})
