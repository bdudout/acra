import { describe, it, expect } from 'vitest'
import { SOURCES_RISQUE_EXEMPLES, SCENARIOS_STRATEGIQUES_EXEMPLES, EVENEMENTS_REDOUTES_EXEMPLES } from '@/lib/ebios-data'
import { getEbiosData } from '@/lib/ebios-data-i18n'

// IA générative comme vecteur de risque par défaut (issue #86)
describe('IA générative dans le catalogue par défaut (#86)', () => {
  it('source de risque + scénarios + événement IA générative présents (FR)', () => {
    expect(SOURCES_RISQUE_EXEMPLES.some(s => /IA générative|deepfake|prompt injection/i.test(`${s.nom} ${s.description}`))).toBe(true)
    expect(SCENARIOS_STRATEGIQUES_EXEMPLES.some(s => /IA générative|deepfake|shadow ai/i.test(`${s.nom} ${s.description}`))).toBe(true)
    expect(EVENEMENTS_REDOUTES_EXEMPLES.some(e => /IA générative|shadow ai/i.test(e.description))).toBe(true)
  })
  it('localisé en EN via getEbiosData', () => {
    const en = getEbiosData('en') as any
    expect(en.SOURCES_RISQUE_EXEMPLES.some((s: any) => /generative AI|deepfake/i.test(`${s.nom} ${s.description}`))).toBe(true)
  })
})
