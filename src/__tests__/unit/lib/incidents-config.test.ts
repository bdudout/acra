/** Configuration « Incidents & pertes » d'une organisation : défaut → org, sanitization. */
import { describe, expect, it } from 'vitest'
import { DEFAULT_INCIDENTS_CONFIG, resolveIncidentsConfig, sanitizeIncidentsConfig, configToRaw, TYPES_EVENEMENT } from '@/lib/incidents-config'

describe('incidents-config', () => {
  it('défauts : EUR, aucun seuil, régimes inactifs, catalogues livrés', () => {
    const c = resolveIncidentsConfig(undefined)
    expect(c.deviseReference).toBe('EUR')
    expect([c.seuilCollecte, c.seuilGrandePerte]).toEqual([null, null])
    expect(c.regimes.every(r => !r.actif)).toBe(true)
    expect(c.typesEvenement.map(t => t.code)).toEqual([...TYPES_EVENEMENT])
    expect(DEFAULT_INCIDENTS_CONFIG.deviseReference).toBe('EUR')
  })
  it('sanitize : bornes, devise valide, taux positifs, seuil grande perte ≥ seuil de collecte', () => {
    const c = sanitizeIncidentsConfig({ deviseReference: 'usd', seuilCollecte: 5000, seuilGrandePerte: 1000, taux: { EUR: 1.1, xx: 2, GBP: -1, CHF: 'a' }, regimes: [{ code: 'NIS2', actif: true }], junk: 1 })
    expect(c.deviseReference).toBe('USD')
    expect(c.seuilCollecte).toBe(5000)
    expect(c.seuilGrandePerte).toBeNull()
    expect(c.taux).toEqual({ EUR: 1.1 })
    expect(c.regimes).toEqual([{ code: 'NIS2', actif: true }])
    expect('junk' in c).toBe(false)
  })
  it('catalogues : désactiver un type livré, en ajouter un personnalisé', () => {
    const c = resolveIncidentsConfig({ typesEvenement: [{ code: 'FRAUDE', actif: false }, { code: 'RUPTURE_STOCK', label: 'Rupture de stock', actif: true }] })
    expect(c.typesEvenement.find(t => t.code === 'FRAUDE')!.actif).toBe(false)
    expect(c.typesEvenement.find(t => t.code === 'CYBER')!.actif).toBe(true)
    expect(c.typesEvenement.find(t => t.code === 'RUPTURE_STOCK')).toMatchObject({ label: 'Rupture de stock', custom: true, actif: true })
  })
  it('entrée invalide → défauts', () => {
    expect(resolveIncidentsConfig('nope').deviseReference).toBe('EUR')
    expect(resolveIncidentsConfig(null).typesPerte.length).toBeGreaterThan(3)
  })
  it('configToRaw : la configuration effective se re-sérialise sans perte (aller-retour stable)', () => {
    const raw = { deviseReference: 'CHF', seuilCollecte: 100, seuilGrandePerte: 9000, taux: { EUR: 1.05 },
      regimes: [{ code: 'NIS2', actif: true, phases: [{ code: 'ALERTE_PRECOCE', delaiH: 12 }] },
        { code: 'CLIENT_X', actif: true, label: 'Client X', declencheur: 'CONTRACTUEL', phases: [{ code: 'PREVENIR', label: 'Prévenir', delaiH: 2, apres: 'CONNAISSANCE' }] }],
      typesEvenement: [{ code: 'FRAUDE', actif: false }], typesPerte: [{ code: 'JOURS', label: 'Jours d’arrêt', actif: true }] }
    const resolved = resolveIncidentsConfig(raw)
    const back = configToRaw(resolved)
    expect(resolveIncidentsConfig(back)).toEqual(resolved)
    expect(back.regimes.find(r => r.code === 'NIS2')!.phases).toContainEqual({ code: 'ALERTE_PRECOCE', delaiH: 12 })
  })
})
