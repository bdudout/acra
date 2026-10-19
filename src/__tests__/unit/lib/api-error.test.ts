import { describe, it, expect } from 'vitest'
import { apiErrorMessage, API_ERROR_CODES } from '@/lib/api-error'
import { fr } from '@/lib/i18n/fr'
import { en } from '@/lib/i18n/en'
import { de } from '@/lib/i18n/de'
import { es } from '@/lib/i18n/es'
import { it as itLocale } from '@/lib/i18n/it'

describe('apiErrorMessage', () => {
  it('traduit les codes stables des gardes d\'API', () => {
    expect(apiErrorMessage('forbidden', fr, 'Erreur')).toBe(fr.apiErrors.forbidden)
    expect(apiErrorMessage('rate_limited', en, 'Error')).toBe(en.apiErrors.rate_limited)
  })
  it('rend un message métier tel quel, et le repli sans message', () => {
    expect(apiErrorMessage('Référence requise', fr, 'Erreur')).toBe('Référence requise')
    expect(apiErrorMessage(undefined, fr, 'Erreur')).toBe('Erreur')
    expect(apiErrorMessage({}, fr, 'Erreur')).toBe('Erreur')
  })
  it('chaque code a un libellé non vide dans les 5 langues', () => {
    for (const t of [fr, en, de, es, itLocale]) for (const c of API_ERROR_CODES) expect(t.apiErrors[c]).toMatch(/\S/)
  })
})
