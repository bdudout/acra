import { describe, it, expect } from 'vitest'
import {
  CONFORMITE_STATUTS,
  sanitizeConformite,
  deriveNonConformites,
  conformiteStats,
  applyConformiteStatut,
  resolveEffectiveConformite,
  marquerDerogations,
  type ConformiteEntry,
} from '@/lib/conformite'

const sample: ConformiteEntry[] = [
  { ref: '5.1', statut: 'conforme' },
  { ref: '5.2', statut: 'non_conforme', commentaire: 'Pas de revue' },
  { ref: '5.3', statut: 'partiel' },
  { ref: '5.4', statut: 'na' },
]

describe('CONFORMITE_STATUTS', () => {
  it('contient les 4 statuts attendus', () => {
    expect(CONFORMITE_STATUTS).toEqual(['conforme', 'partiel', 'non_conforme', 'na'])
  })
})

describe('sanitizeConformite', () => {
  it('ne garde que les entrées avec ref et statut valides', () => {
    const clean = sanitizeConformite([
      { ref: '5.1', statut: 'conforme' },
      { ref: '', statut: 'conforme' },
      { ref: '5.2', statut: 'bidon' as any },
      { ref: '5.3', statut: 'partiel', commentaire: 'x' },
    ])
    expect(clean.map(c => c.ref)).toEqual(['5.1', '5.3'])
  })

  it('filtre par refs autorisées si fournies', () => {
    const clean = sanitizeConformite(sample, new Set(['5.1', '5.2']))
    expect(clean.map(c => c.ref)).toEqual(['5.1', '5.2'])
  })

  it('tronque le commentaire et ignore une entrée non-objet', () => {
    const clean = sanitizeConformite([null as any, { ref: '5.1', statut: 'conforme', commentaire: 'a'.repeat(2000) }])
    expect(clean).toHaveLength(1)
    expect(clean[0].commentaire!.length).toBeLessThanOrEqual(1000)
  })

  it('renvoie [] pour une entrée non-tableau', () => {
    expect(sanitizeConformite(null as any)).toEqual([])
  })
})

describe('deriveNonConformites', () => {
  it('retient uniquement non_conforme et partiel', () => {
    const nc = deriveNonConformites(sample)
    expect(nc.map(c => c.ref).sort()).toEqual(['5.2', '5.3'])
  })

  it('exclut conforme et na', () => {
    const nc = deriveNonConformites(sample)
    expect(nc.find(c => c.ref === '5.1')).toBeUndefined()
    expect(nc.find(c => c.ref === '5.4')).toBeUndefined()
  })
})

describe('marquerDerogations (#dérogations)', () => {
  const entries: ConformiteEntry[] = [
    { ref: 'A.1', statut: 'non_conforme' },
    { ref: 'A.2', statut: 'partiel' },
    { ref: 'A.3', statut: 'conforme' },
    { ref: 'A.4', statut: 'non_conforme' },
  ]
  it('marque dérogé les non-conforme/partiel dont la ref est couverte', () => {
    const r = marquerDerogations(entries, new Set(['A.1', 'A.2', 'A.3']))
    expect(r.find(e => e.ref === 'A.1')?.derogee).toBe(true)
    expect(r.find(e => e.ref === 'A.2')?.derogee).toBe(true)
    expect(r.find(e => e.ref === 'A.3')?.derogee).toBeUndefined() // conforme → jamais dérogé
    expect(r.find(e => e.ref === 'A.4')?.derogee).toBeUndefined() // non couvert
  })
  it('un contrôle dérogé sort du catalogue de vulnérabilités', () => {
    const marque = marquerDerogations(entries, new Set(['A.1']))
    const cat = deriveNonConformites(marque).map(e => e.ref)
    expect(cat).toEqual(['A.2', 'A.4']) // A.1 dérogé exclu
  })
  it('sans dérogation, comportement inchangé', () => {
    expect(marquerDerogations(entries, new Set())).toBe(entries)
  })
})

describe('conformiteStats — bucket dérogé', () => {
  it('les dérogés forment un bucket dédié, retirés de non-conforme, gardés au dénominateur', () => {
    const entries: ConformiteEntry[] = marquerDerogations([
      { ref: 'A.1', statut: 'conforme' },
      { ref: 'A.2', statut: 'non_conforme' },
      { ref: 'A.3', statut: 'non_conforme' },
      { ref: 'A.4', statut: 'partiel' },
    ], new Set(['A.3', 'A.4']))
    const s = conformiteStats(entries, 4)
    expect(s.conforme).toBe(1)
    expect(s.nonConforme).toBe(1)   // A.2 seulement (A.3 dérogé)
    expect(s.partiel).toBe(0)       // A.4 dérogé
    expect(s.deroge).toBe(2)        // A.3 + A.4
    // taux = conforme / (conforme+partiel+nonConforme+deroge) = 1/4 = 25%
    expect(s.tauxConformite).toBe(25)
  })
})

describe('conformiteStats', () => {
  it('compte par statut et calcule le taux de conformité', () => {
    const s = conformiteStats(sample, 10)
    expect(s.conforme).toBe(1)
    expect(s.partiel).toBe(1)
    expect(s.nonConforme).toBe(1)
    expect(s.na).toBe(1)
    expect(s.evalues).toBe(4)
    expect(s.total).toBe(10)
    // taux = conforme / (évalués hors NA) = 1 / 3 → 33
    expect(s.tauxConformite).toBe(33)
  })

  it('taux = 0 si aucun contrôle pertinent évalué', () => {
    const s = conformiteStats([{ ref: '5.4', statut: 'na' }], 5)
    expect(s.tauxConformite).toBe(0)
  })
})

describe('applyConformiteStatut — édition inline du socle', () => {
  const base: ConformiteEntry[] = [
    { ref: '5.1', statut: 'non_conforme', commentaire: 'à traiter' },
    { ref: '5.2', statut: 'partiel' },
  ]
  it('met à jour le statut d\'un contrôle existant en préservant le commentaire', () => {
    const out = applyConformiteStatut(base, '5.1', 'conforme')
    expect(out.find(e => e.ref === '5.1')).toEqual({ ref: '5.1', statut: 'conforme', commentaire: 'à traiter' })
    expect(out).not.toBe(base) // immutable
    expect(base[0].statut).toBe('non_conforme') // source inchangée
  })
  it('ajoute une entrée si le contrôle n\'est pas encore évalué', () => {
    const out = applyConformiteStatut(base, '9.9', 'na')
    expect(out).toHaveLength(3)
    expect(out[2]).toEqual({ ref: '9.9', statut: 'na' })
  })
  it('ignore une ref vide ou un statut invalide', () => {
    expect(applyConformiteStatut(base, '   ', 'conforme')).toBe(base)
    expect(applyConformiteStatut(base, '5.1', 'bidon' as any)).toBe(base)
  })
})

describe('resolveEffectiveConformite — héritage du socle (Palier 1)', () => {
  const own: ConformiteEntry[] = [{ ref: 'A.5.1', statut: 'conforme' }]
  const socleEntries: ConformiteEntry[] = [{ ref: 'A.8.1', statut: 'non_conforme' }]
  const socle = { id: 'soc1', nom: 'Socle groupe', entries: socleEntries }

  it('conformité propre non vide → gardée, non héritée', () => {
    const r = resolveEffectiveConformite({ ownEntries: own, socle })
    expect(r.entries).toBe(own)
    expect(r.inherited).toBe(false)
    expect(r.sourceAnalyseId).toBeNull()
  })
  it('pas de conformité propre + socle renseigné → héritée du socle', () => {
    const r = resolveEffectiveConformite({ ownEntries: [], socle })
    expect(r.entries).toBe(socleEntries)
    expect(r.inherited).toBe(true)
    expect(r.sourceAnalyseId).toBe('soc1')
    expect(r.sourceAnalyseNom).toBe('Socle groupe')
  })
  it('ni propre ni socle → vide, non héritée', () => {
    expect(resolveEffectiveConformite({ ownEntries: [], socle: null })).toEqual({
      entries: [], inherited: false, sourceAnalyseId: null, sourceAnalyseNom: null,
    })
    expect(resolveEffectiveConformite({ ownEntries: [], socle: { id: 's', nom: 'x', entries: [] } }).inherited).toBe(false)
  })
})
