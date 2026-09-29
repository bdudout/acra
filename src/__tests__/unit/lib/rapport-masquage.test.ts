import { describe, expect, it } from 'vitest'
import { masquerContenu, appliquerGabarit, sanitizeGabarits, sanitizeRapportsConfig } from '@/lib/rapport-masquage'
import type { RapportContenu } from '@/lib/rapport-model'

const contenu: RapportContenu = {
  code: 'R-INC-1', periode: { debut: '2026-01-01', fin: '2026-03-31' }, genereLe: '2026-04-01T00:00:00Z', deviseReference: 'EUR',
  sections: [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [{ cle: 'total', valeur: 3 }] }] },
    { id: 'notifsEnRetard', blocs: [{ type: 'tableau', colonnes: ['rapports.cols.incident', 'rapports.cols.regime', 'rapports.cols.responsable'], lignes: [['Ransomware Siège', 'NIS2', 'Alice'], ['Fuite RH', 'RGPD', 'Bob'], ['Ransomware Siège', 'RGPD', 'Alice'], [null, 'X', { k: 'rapports.nonRenseigne' }]] }] },
  ],
}

describe('masquage des données identifiantes', () => {
  it('pseudonymise de façon cohérente les colonnes identifiantes, laisse le reste', () => {
    const m = masquerContenu(contenu)
    const t = m.sections[1].blocs[0]
    expect(t.type === 'tableau' && t.lignes).toEqual([['#1', 'NIS2', '#1'], ['#2', 'RGPD', '#2'], ['#1', 'RGPD', '#1'], [null, 'X', { k: 'rapports.nonRenseigne' }]])
    expect(m.sections[0]).toEqual(contenu.sections[0])
  })
  it('ne modifie pas l’original (édition figée)', () => {
    masquerContenu(contenu)
    const t = contenu.sections[1].blocs[0]
    expect(t.type === 'tableau' && t.lignes[0][0]).toBe('Ransomware Siège')
  })
})

describe('gabarits surchargeables', () => {
  it('assainit : titre/introduction bornés, sections à masquer, codes connus seulement', () => {
    const g = sanitizeGabarits({ 'R-INC-1': { titre: '  Revue trimestrielle  ', introduction: 'x'.repeat(3000), sectionsMasquees: ['parType', 5, 'parType'] }, 'R-XXX': { titre: 'no' }, 'R-PER-2': 'nimporte' })
    expect(g).toEqual({ 'R-INC-1': { titre: 'Revue trimestrielle', introduction: 'x'.repeat(2000), sectionsMasquees: ['parType'] } })
  })
  it('retire les sections masquées, sans toucher le contenu figé', () => {
    const r = appliquerGabarit(contenu, { sectionsMasquees: ['synthese'] })
    expect(r.sections.map(s => s.id)).toEqual(['notifsEnRetard'])
    expect(contenu.sections).toHaveLength(2)
    expect(appliquerGabarit(contenu, undefined)).toBe(contenu)
  })
})

describe('configuration des rapports', () => {
  it('valeurs sûres par défaut', () => {
    expect(sanitizeRapportsConfig(undefined)).toEqual({ gabarits: {} })
    expect(sanitizeRapportsConfig({ gabarits: { 'R-INC-1': { titre: 'T' } } })).toEqual({ gabarits: { 'R-INC-1': { titre: 'T' } } })
  })
})
