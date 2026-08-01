import { describe, it, expect } from 'vitest'
import { sanitizePreuves, PREUVES_MAX, PREUVE_DATAURL_MAX } from '@/lib/preuves'

const ok = (nom = 'p.pdf') => ({ nom, mime: 'application/pdf', taille: 1234, dataUrl: 'data:application/pdf;base64,AAAA' })

describe('sanitizePreuves', () => {
  it('entrée non tableau → liste vide', () => {
    expect(sanitizePreuves(null)).toEqual([])
    expect(sanitizePreuves('x')).toEqual([])
    expect(sanitizePreuves(undefined)).toEqual([])
  })
  it('conserve une preuve conforme', () => {
    expect(sanitizePreuves([ok()])).toEqual([{ nom: 'p.pdf', mime: 'application/pdf', taille: 1234, dataUrl: 'data:application/pdf;base64,AAAA' }])
  })
  it('écarte ce qui n\'est pas une data URL', () => {
    expect(sanitizePreuves([{ ...ok(), dataUrl: 'https://evil.example/x.pdf' }])).toEqual([])
    expect(sanitizePreuves([{ ...ok(), dataUrl: '' }])).toEqual([])
    expect(sanitizePreuves([{ ...ok(), dataUrl: 123 }])).toEqual([])
  })
  it('écarte une data URL trop volumineuse', () => {
    const gros = 'data:application/pdf;base64,' + 'A'.repeat(PREUVE_DATAURL_MAX)
    expect(sanitizePreuves([{ ...ok(), dataUrl: gros }])).toEqual([])
  })
  it('borne le nombre de preuves', () => {
    expect(sanitizePreuves(Array.from({ length: 12 }, () => ok()))).toHaveLength(PREUVES_MAX)
  })
  it('tronque nom et mime, déduit la taille manquante', () => {
    const p = sanitizePreuves([{ nom: 'n'.repeat(500), mime: 'm'.repeat(500), dataUrl: 'data:text/plain;base64,AA' }])[0]
    expect(p.nom).toHaveLength(200)
    expect(p.mime).toHaveLength(100)
    expect(p.taille).toBe('data:text/plain;base64,AA'.length)
  })
  it('nom par défaut si absent', () => {
    expect(sanitizePreuves([{ dataUrl: 'data:text/plain;base64,AA' }])[0].nom).toBe('preuve')
  })
  it('ignore les entrées non-objet sans casser le reste', () => {
    expect(sanitizePreuves([null, 'x', ok('bon.pdf'), 42])).toHaveLength(1)
    expect(sanitizePreuves([null, ok('bon.pdf')])[0].nom).toBe('bon.pdf')
  })
})
