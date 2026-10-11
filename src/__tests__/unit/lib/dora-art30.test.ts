// Recette n° 20 : clauses de l'évaluation d'un tiers alignées sur DORA art. 30 (Règlement (UE) 2022/2554), texte
// officiel dans les 5 langues : § 2 pour tout contrat de services TIC, § 3 en plus pour une fonction critique ou importante.
import { describe, expect, it } from 'vitest'
import { CLAUSES_DORA_ART30, TEXTE_DORA_ART30, clausesDoraApplicables, libelleClauseDora, referenceClauseDora } from '@/lib/dora-art30'

describe('DORA art. 30 — texte officiel', () => {
  it('9 points au § 2 (a–i) et 6 au § 3 (a–f), non vides, dans les 5 langues ; intitulés officiels', () => {
    expect(CLAUSES_DORA_ART30).toHaveLength(15)
    for (const l of ['fr', 'en', 'de', 'es', 'it'] as const) for (const k of CLAUSES_DORA_ART30) expect(TEXTE_DORA_ART30[l].points[k].length, `${l} ${k}`).toBeGreaterThan(40)
    expect(TEXTE_DORA_ART30.fr.titre).toBe('Principales dispositions contractuelles')
    expect(TEXTE_DORA_ART30.en.titre).toBe('Key contractual provisions')
    expect(TEXTE_DORA_ART30.de.titre).toBe('Wesentliche Vertragsbestimmungen')
    expect(TEXTE_DORA_ART30.fr.points['dora30.2h']).toMatch(/^les droits de résiliation et les délais de préavis minimaux/)
    expect(TEXTE_DORA_ART30.fr.points['dora30.3f']).toMatch(/^les stratégies de sortie/)
    expect(TEXTE_DORA_ART30.fr.points['dora30.3f']).not.toMatch(/Par dérogation/)
  })
  it('§ 3 seulement pour une fonction critique ou importante', () => {
    expect(clausesDoraApplicables(false)).toHaveLength(9)
    expect(clausesDoraApplicables(true)).toHaveLength(15)
  })
  it('référence de citation et extrait du texte officiel (jamais reformulé)', () => {
    expect(referenceClauseDora('dora30.2a', 'fr')).toBe('art. 30, § 2, point a)')
    expect(referenceClauseDora('dora30.3e', 'en')).toBe('Article 30(3), point (e)')
    const l = libelleClauseDora('dora30.2h', 'fr')
    expect(l.extrait.endsWith('…')).toBe(true)
    expect(l.texte.startsWith(l.extrait.slice(0, -1))).toBe(true)
  })
})
