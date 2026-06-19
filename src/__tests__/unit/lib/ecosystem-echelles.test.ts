import { describe, it, expect } from 'vitest'
import {
  ECHELLES_ECOSYSTEME_DEFAUT,
  resolveEchelles,
  sanitizeEchelles,
  maxValeur,
  nomNiveau,
  bornesMenace,
  CRITERES_ECOSYSTEME,
} from '@/lib/ecosystem-echelles'

describe('échelles écosystème — défauts', () => {
  it('expose 4 critères, chacun avec 4 niveaux 1..4 nommés', () => {
    expect(CRITERES_ECOSYSTEME).toEqual(['dependance', 'penetration', 'maturite', 'confiance'])
    for (const c of CRITERES_ECOSYSTEME) {
      const niveaux = ECHELLES_ECOSYSTEME_DEFAUT[c].niveaux
      expect(niveaux).toHaveLength(4)
      expect(niveaux.map(n => n.valeur)).toEqual([1, 2, 3, 4])
      expect(niveaux.every(n => n.nom.length > 0)).toBe(true)
    }
  })
})

describe('resolveEchelles — override remplace le défaut', () => {
  it('repli sur les défauts si override absent ou invalide', () => {
    expect(resolveEchelles(undefined)).toEqual(ECHELLES_ECOSYSTEME_DEFAUT)
    expect(resolveEchelles({})).toEqual(ECHELLES_ECOSYSTEME_DEFAUT)
    // échelle avec moins de 2 niveaux = invalide → défaut
    expect(resolveEchelles({ dependance: { niveaux: [{ valeur: 1, nom: 'X' }] } }).dependance)
      .toEqual(ECHELLES_ECOSYSTEME_DEFAUT.dependance)
  })

  it('utilise une échelle override valide', () => {
    const custom = { niveaux: [
      { valeur: 1, nom: 'Bas' }, { valeur: 2, nom: 'Moyen' }, { valeur: 3, nom: 'Haut' },
    ] }
    const r = resolveEchelles({ maturite: custom })
    expect(r.maturite).toEqual(custom)
    expect(r.confiance).toEqual(ECHELLES_ECOSYSTEME_DEFAUT.confiance) // les autres restent par défaut
  })
})

describe('maxValeur / nomNiveau', () => {
  it('maxValeur = nombre de niveaux', () => {
    expect(maxValeur(ECHELLES_ECOSYSTEME_DEFAUT.dependance)).toBe(4)
  })
  it('nomNiveau renvoie le niveau le plus proche (cotation flottante)', () => {
    expect(nomNiveau(ECHELLES_ECOSYSTEME_DEFAUT.dependance, 4)).toBe('Vitale')
    expect(nomNiveau(ECHELLES_ECOSYSTEME_DEFAUT.dependance, 1.2)).toBe('Nulle')
    expect(nomNiveau(ECHELLES_ECOSYSTEME_DEFAUT.dependance, 2.6)).toBe('Significative')
  })
})

describe('sanitizeEchelles — normalisation de l\'override client', () => {
  it('renumérote les valeurs, borne les noms, retire les niveaux vides', () => {
    const r = sanitizeEchelles({
      dependance: { niveaux: [
        { valeur: 9, nom: '  Bas  ' },
        { valeur: 9, nom: '' },          // sans nom → retiré
        { valeur: 9, nom: 'Haut', description: 'x' },
      ] },
    })
    expect(r.dependance?.niveaux).toEqual([
      { valeur: 1, nom: 'Bas' },
      { valeur: 2, nom: 'Haut', description: 'x' },
    ])
  })

  it('omet une échelle de moins de 2 niveaux et les clés inconnues', () => {
    const r = sanitizeEchelles({
      maturite: { niveaux: [{ valeur: 1, nom: 'Seul' }] }, // < 2 → omis
      inconnu: { niveaux: [{ valeur: 1, nom: 'A' }, { valeur: 2, nom: 'B' }] },
    })
    expect(r.maturite).toBeUndefined()
    expect((r as Record<string, unknown>).inconnu).toBeUndefined()
  })

  it('ignore une entrée non-objet', () => {
    expect(sanitizeEchelles(null)).toEqual({})
    expect(sanitizeEchelles([])).toEqual({})
  })
})

describe('bornesMenace — dérivées des échelles', () => {
  it('échelles 1..4 → menace ∈ [1/16, 16]', () => {
    const b = bornesMenace(ECHELLES_ECOSYSTEME_DEFAUT)
    expect(b.maxExpo).toBe(16)
    expect(b.maxFiab).toBe(16)
    expect(b.menaceMax).toBe(16)
    expect(b.menaceMin).toBeCloseTo(1 / 16, 6)
  })

  it('s\'adapte à des échelles 1..5', () => {
    const niveaux5 = { niveaux: [1, 2, 3, 4, 5].map(v => ({ valeur: v, nom: `N${v}` })) }
    const b = bornesMenace(resolveEchelles({
      dependance: niveaux5, penetration: niveaux5, maturite: niveaux5, confiance: niveaux5,
    }))
    expect(b.maxExpo).toBe(25)
    expect(b.menaceMax).toBe(25)
    expect(b.menaceMin).toBeCloseTo(1 / 25, 6)
  })
})
