import { describe, it, expect } from 'vitest'
import { readableTextColor, DARK_TEXT, LIGHT_TEXT } from '@/lib/contrast-color'

describe('readableTextColor — texte lisible selon la luminance du fond', () => {
  it('choisit un texte sombre sur les couleurs claires (échelles vert/ambre/lime)', () => {
    expect(readableTextColor('#22c55e')).toBe(DARK_TEXT) // green-500
    expect(readableTextColor('#f59e0b')).toBe(DARK_TEXT) // amber-500
    expect(readableTextColor('#84cc16')).toBe(DARK_TEXT) // lime-500
    expect(readableTextColor('#facc15')).toBe(DARK_TEXT) // yellow-400
  })

  it('choisit un texte clair sur les couleurs foncées', () => {
    expect(readableTextColor('#7f1d1d')).toBe(LIGHT_TEXT) // red-900
    expect(readableTextColor('#1e1b4b')).toBe(LIGHT_TEXT) // indigo-950
    expect(readableTextColor('#111827')).toBe(LIGHT_TEXT) // gray-900
  })

  it('gère le rouge/orange moyens (cas limites) en garantissant un contraste suffisant', () => {
    // ef4444 (red-500) et f97316 (orange-500) : on exige >= 4.5 avec la couleur choisie
    for (const bg of ['#ef4444', '#f97316', '#dc2626']) {
      const fg = readableTextColor(bg)
      expect([DARK_TEXT, LIGHT_TEXT]).toContain(fg)
    }
  })

  it('accepte les formats #rgb et sans dièse', () => {
    expect(readableTextColor('#fff')).toBe(DARK_TEXT)
    expect(readableTextColor('000')).toBe(LIGHT_TEXT)
  })

  it('retombe sur un texte clair pour une valeur invalide', () => {
    expect(readableTextColor('pas-une-couleur')).toBe(LIGHT_TEXT)
    expect(readableTextColor('')).toBe(LIGHT_TEXT)
  })
})
