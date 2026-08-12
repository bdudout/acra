import { describe, it, expect } from 'vitest'
import {
  classifierIncident, criteresDeclenches, estEvalueDora, cleanDoraCriteres,
  synthetiserDora, synthetiserLdc, DORA_SEUILS_DEFAUT,
} from '@/lib/dora'

describe('dora — critères déclenchés', () => {
  it('applique les seuils numériques et les booléens', () => {
    const d = criteresDeclenches({ clientsAffectes: 2000, dureeIndispoMinutes: 30, pertesDonnees: true })
    expect(d).toContain('clients') // 2000 >= 1000
    expect(d).not.toContain('duree') // 30 < 120
    expect(d).toContain('donnees')
  })
})

describe('dora — classification', () => {
  it('MAJEUR : services critiques + ≥1 autre critère', () => {
    const e = classifierIncident({ serviceCritique: true, impactEconomique: 200_000 })
    expect(e.classe).toBe('MAJEUR')
    expect(e.serviceCritique).toBe(true)
  })
  it('MAJEUR : ≥2 critères secondaires sans services critiques', () => {
    expect(classifierIncident({ reputation: true, etendueGeo: true }).classe).toBe('MAJEUR')
  })
  it('SIGNIFICATIF : un seul signal', () => {
    expect(classifierIncident({ serviceCritique: true }).classe).toBe('SIGNIFICATIF')
    expect(classifierIncident({ reputation: true }).classe).toBe('SIGNIFICATIF')
  })
  it('MINEUR : aucun critère', () => {
    expect(classifierIncident({ clientsAffectes: 10, dureeIndispoMinutes: 5 }).classe).toBe('MINEUR')
  })
})

describe('dora — évaluation renseignée', () => {
  it('détecte si au moins un critère est saisi', () => {
    expect(estEvalueDora(null)).toBe(false)
    expect(estEvalueDora({})).toBe(false)
    expect(estEvalueDora({ reputation: false })).toBe(false)
    expect(estEvalueDora({ clientsAffectes: 5 })).toBe(true)
    expect(estEvalueDora({ serviceCritique: true })).toBe(true)
  })
})

describe('dora — nettoyage', () => {
  it('coerce nombres/booleens, rejette négatifs et non-numériques', () => {
    const c = cleanDoraCriteres({ clientsAffectes: '500', impactEconomique: -3, dureeIndispoMinutes: 'x', serviceCritique: true, reputation: 'oui' })
    expect(c.clientsAffectes).toBe(500)
    expect(c.impactEconomique).toBeNull() // négatif rejeté
    expect(c.dureeIndispoMinutes).toBeNull()
    expect(c.serviceCritique).toBe(true)
    expect(c.reputation).toBe(false) // 'oui' n'est pas true strict
  })
})

describe('dora — synthèses', () => {
  it('compte par classe', () => {
    expect(synthetiserDora(['MAJEUR', 'MAJEUR', 'SIGNIFICATIF', 'MINEUR']))
      .toEqual({ evalues: 4, majeurs: 2, significatifs: 1, mineurs: 1 })
  })
  it('LDC : exclut REJETE, agrège brut/récup/net', () => {
    const s = synthetiserLdc([
      { montantBrut: 1000, recuperations: 200, statut: 'CLOTURE' }, // net 800
      { montantBrut: 500, recuperations: null, statut: 'QUALIFIE' }, // net 500
      { montantBrut: 9999, recuperations: 0, statut: 'REJETE' }, // exclu
    ])
    expect(s).toEqual({ nbIncidents: 2, perteBruteTotale: 1500, recuperationsTotales: 200, perteNetteTotale: 1300 })
  })
})

it('seuils par défaut cohérents', () => {
  expect(DORA_SEUILS_DEFAUT.impactEconomique).toBe(100_000)
})
