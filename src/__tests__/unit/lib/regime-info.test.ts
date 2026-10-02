import { describe, expect, it } from 'vitest'
import { REGIME_INFO, regimeInfo, type InfoLocale } from '@/lib/regime-info'
import { CATALOGUE_REGIMES } from '@/lib/notification-regimes'

const LOCALES: InfoLocale[] = ['fr', 'en', 'de', 'es', 'it']

describe('fiches d’information des régimes de déclaration', () => {
  it('une fiche pour DORA et pour chaque régime du catalogue, avec base légale, destinataire, déclencheur, délais, canal ×5 langues', () => {
    for (const code of ['DORA', ...CATALOGUE_REGIMES.map(r => r.code)]) {
      const i = REGIME_INFO[code]
      expect(i, code).toBeDefined()
      expect(i.basis.length, code).toBeGreaterThan(0)
      for (const l of LOCALES) for (const k of ['recipient', 'trigger', 'deadlines', 'channel'] as const) expect(i[k][l].trim(), `${code}.${k}.${l}`).not.toBe('')
    }
  })
  it('DORA : délais de l’article 5 du RTS 2025/301 (4 h / 24 h, 72 h, un mois après le rapport intermédiaire), canal ACPR (OneGate, JSON) et BCE', () => {
    const d = regimeInfo('DORA', 'fr')!
    expect(d.deadlines).toMatch(/4 h/); expect(d.deadlines).toMatch(/24 h/); expect(d.deadlines).toMatch(/72 h/); expect(d.deadlines).toMatch(/un mois après le rapport intermédiaire/)
    expect(d.channel).toMatch(/OneGate/); expect(d.channel).toMatch(/JSON/); expect(d.channel).toMatch(/BCE/)
    expect(d.basis).toContain('2022/2554'); expect(d.basis).toContain('2025/301'); expect(d.basis).toContain('2025/302')
    expect(regimeInfo('DORA', 'en')!.deadlines).toMatch(/one month after the intermediate report/)
  })
  it('CRA, SEC, NYDFS, HIPAA, banques américaines, FTC : délais publiés', () => {
    expect(regimeInfo('CRA_14', 'fr')!.deadlines).toMatch(/24 h/); expect(regimeInfo('CRA_14', 'fr')!.deadlines).toMatch(/14 jours/); expect(regimeInfo('CRA_14', 'fr')!.basis).toContain('2024/2847')
    expect(regimeInfo('SEC_8K', 'en')!.deadlines).toMatch(/four business days/i)
    expect(regimeInfo('NYDFS_500_17', 'en')!.deadlines).toMatch(/72 hours/)
    expect(regimeInfo('HIPAA_BREACH', 'en')!.deadlines).toMatch(/60/)
    expect(regimeInfo('US_BANKING_36H', 'en')!.deadlines).toMatch(/36 hours/)
    expect(regimeInfo('FTC_SAFEGUARDS', 'en')!.deadlines).toMatch(/30 days/)
  })
  it('régime inconnu ou personnalisé : null (aucune fiche inventée) ; langue inconnue : français', () => {
    expect(regimeInfo('MON_REGIME', 'fr')).toBeNull(); expect(regimeInfo('CRA_14', 'xx' as InfoLocale)!.recipient).toBe(regimeInfo('CRA_14', 'fr')!.recipient)
  })
  it('sources : liens officiels (https) uniquement', () => {
    for (const [code, i] of Object.entries(REGIME_INFO)) for (const u of i.sources) expect(u, code).toMatch(/^https:\/\//)
  })
})
