import { describe, it, expect } from 'vitest'
import { joinTiersToTic, joinArrangementsToEcosysteme } from '@/lib/tiers-tic-link'
import type { ConsolidatedTier } from '@/lib/tiers'
import type { ArrangementTic } from '@/lib/registre-tic'

const tier = (nom: string, over: Partial<ConsolidatedTier> = {}): ConsolidatedTier => ({
  key: nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(),
  nom, type: 'PRESTATAIRE', occurrences: 1, analyses: [],
  menace: 2, zone: 'veille', exposition: 6, fiabilite: 9, critique: false, ...over,
})
const arr = (prestataireNom: string, over: Partial<ArrangementTic> = {}): ArrangementTic => ({
  reference: 'REF-' + prestataireNom, prestataireNom, typeService: 'CLOUD', criticite: 'IMPORTANTE', ...over,
})

describe('joinTiersToTic', () => {
  it('associe chaque tiers à ses arrangements TIC par nom normalisé', () => {
    const tiers = [tier('Microsoft Azure'), tier('OVHcloud')]
    const arrangements = [arr('microsoft azure', { reference: 'A1' }), arr('AWS', { reference: 'A2' })]
    const out = joinTiersToTic(tiers, arrangements)
    const azure = out.find(t => t.nom === 'Microsoft Azure')!
    expect(azure.tic.map(a => a.reference)).toEqual(['A1'])
    expect(azure.estTic).toBe(true)
    const ovh = out.find(t => t.nom === 'OVHcloud')!
    expect(ovh.tic).toEqual([])
    expect(ovh.estTic).toBe(false)
  })
})

describe('joinArrangementsToEcosysteme', () => {
  it('associe chaque arrangement au tiers écosystème (menace/zone/critique) par nom', () => {
    const tiers = [tier('Datacenter X', { menace: 5, zone: 'danger', critique: true, occurrences: 3 })]
    const arrangements = [arr('datacenter x', { reference: 'A9' }), arr('Inconnu SARL', { reference: 'A10' })]
    const out = joinArrangementsToEcosysteme(arrangements, tiers)
    const a9 = out.find(a => a.reference === 'A9')!
    expect(a9.ecosysteme).toEqual({ menace: 5, zone: 'danger', critique: true, occurrences: 3 })
    const a10 = out.find(a => a.reference === 'A10')!
    expect(a10.ecosysteme).toBeNull()
  })

  it('en cas de doublons de tiers de même clé, retient le pire cas (menace max)', () => {
    const tiers = [
      tier('Cloud Y', { menace: 2, zone: 'veille' }),
      tier('cloud y', { menace: 6, zone: 'danger', critique: true }),
    ]
    const out = joinArrangementsToEcosysteme([arr('Cloud Y')], tiers)
    expect(out[0].ecosysteme?.menace).toBe(6)
    expect(out[0].ecosysteme?.critique).toBe(true)
  })
})
