/**
 * n° 63 : e-mail « demande d'accès à une analyse » envoyé au propriétaire, dans sa langue
 * (5 langues, repli français), avec le nom de l'analyse, le demandeur et le lien.
 */
import { describe, it, expect } from 'vitest'
import { demandeAccesAnalyseEmail } from '@/lib/email-i18n'

const p = { analyseNom: 'Messagerie des élus 2026', demandeur: 'Recette (direction@acra.test)', lien: 'http://localhost:3005/analyses/a1' }

describe('demandeAccesAnalyseEmail', () => {
  it('contient l\'analyse, le demandeur et le lien, en texte et en HTML', () => {
    const m = demandeAccesAnalyseEmail('fr', p)
    expect(m.subject).toContain('Messagerie des élus 2026')
    for (const corps of [m.text, m.html]) {
      expect(corps).toContain('Recette (direction@acra.test)')
      expect(corps).toContain('http://localhost:3005/analyses/a1')
    }
  })
  it('localisé dans les 5 langues, repli français', () => {
    const sujets = (['fr', 'en', 'de', 'es', 'it'] as const).map(l => demandeAccesAnalyseEmail(l, p).subject)
    expect(new Set(sujets).size).toBe(5)
    expect(demandeAccesAnalyseEmail('xx', p).subject).toBe(sujets[0])
    expect(demandeAccesAnalyseEmail(null, p).subject).toBe(sujets[0])
  })
})
