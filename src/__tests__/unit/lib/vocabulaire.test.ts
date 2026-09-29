/** Vocabulaire personnalisable par organisation : affichage seulement (jamais les clés techniques). */
import { describe, expect, it } from 'vitest'
import { VOCAB_TERMS, sanitizeVocabulaire, applyVocabulaire } from '@/lib/vocabulaire'
import { fr } from '@/lib/i18n/fr'
import { en } from '@/lib/i18n/en'

const get = (o: unknown, path: string) => path.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o)

describe('registre des termes', () => {
  it('chaque chemin déclaré existe dans les 5 langues (sinon le renommage serait sans effet)', async () => {
    const { de } = await import('@/lib/i18n/de'); const { es } = await import('@/lib/i18n/es'); const { it: itL } = await import('@/lib/i18n/it')
    for (const [term, paths] of Object.entries(VOCAB_TERMS)) {
      for (const [l, t] of Object.entries({ fr, en, de, es, it: itL })) for (const p of paths) expect(typeof get(t, p), `${term} ${p} ${l}`).toBe('string')
    }
  })
})

describe('sanitizeVocabulaire', () => {
  it('ne garde que les termes connus, les langues connues (ou *), des libellés bornés', () => {
    const v = sanitizeVocabulaire({ incident: { '*': '  Événement de sécurité ', fr: 'Événement', xx: 'no' }, inconnu: { '*': 'x' }, controle: { fr: '' }, audit: 'nope' })
    expect(v).toEqual({ incident: { '*': 'Événement de sécurité', fr: 'Événement' } })
    expect(sanitizeVocabulaire({ incident: { '*': 'x'.repeat(200) } }).incident?.['*']).toHaveLength(60)
    expect(sanitizeVocabulaire(null)).toEqual({})
  })
})

describe('applyVocabulaire', () => {
  it('renomme menu et titre pour la langue courante ; les autres organisations/clés sont intactes', () => {
    const t = applyVocabulaire(fr, { incident: { '*': 'Événements de sécurité' } }, 'fr')
    expect(t.nav.incidents).toBe('Événements de sécurité')
    expect(t.incidents.title).toBe('Événements de sécurité')
    expect(t.nav.controles).toBe(fr.nav.controles)
    expect(fr.nav.incidents).toBe('Incidents') // l'original n'est pas muté
  })
  it('libellé propre à une langue prioritaire sur le libellé général ; langue sans libellé → défaut', () => {
    const vocab = { controle: { '*': 'Auto-contrôle', en: 'Self-check' } }
    expect(applyVocabulaire(en, vocab, 'en').nav.controles).toBe('Self-check')
    expect(applyVocabulaire(fr, vocab, 'fr').nav.controles).toBe('Auto-contrôle')
    expect(applyVocabulaire(fr, { controle: { en: 'Self-check' } }, 'fr').nav.controles).toBe(fr.nav.controles)
  })
  it('vocabulaire vide : le même objet est renvoyé (aucun coût)', () => {
    expect(applyVocabulaire(fr, {}, 'fr')).toBe(fr)
  })
})
