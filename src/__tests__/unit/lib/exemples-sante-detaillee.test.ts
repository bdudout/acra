import { describe, expect, it } from 'vitest'
import { sectorExemplesFor } from '@/lib/exemples-sectoriels'
import { sousSecteurIdsFor } from '@/lib/sous-secteurs'
import type { Locale } from '@/lib/i18n'

const SANTE = 'Santé / Médico-social'
const NOUVEAUX = ['sante-cabinet', 'sante-gestion-pro', 'sante-msp', 'sante-amo', 'sante-amc', 'sante-tiers-payant', 'sante-imagerie', 'sante-transport', 'sante-dm-optique', 'sante-esante']
const CATS = ['valeursMetier', 'biensSupports', 'evenementsRedoutes', 'scenariosStrategiques'] as const

describe('santé et assurance maladie : sous-secteurs détaillés', () => {
  it('les grands usages sont proposés pour le secteur santé (cabinet, gestion, MSP, AMO, AMC, tiers payant, labo, officine, imagerie, transport, DM, e-santé)', () => {
    const ids = sousSecteurIdsFor(SANTE)
    for (const id of [...NOUVEAUX, 'sante-hopital', 'sante-clinique', 'sante-ehpad', 'sante-labo', 'sante-pharma', 'sante-saad']) expect(ids, id).toContain(id)
  })
  it('chaque sous-secteur reçoit des exemples propres (valeurs métier, biens supports, événements, scénarios) et pas ceux d’un autre usage', () => {
    for (const id of [...NOUVEAUX, 'sante-labo', 'sante-pharma']) {
      for (const cat of CATS) expect(sectorExemplesFor(SANTE, cat, 'fr', id).length, `${id}/${cat}`).toBeGreaterThan(0)
    }
    const amo = JSON.stringify(sectorExemplesFor(SANTE, 'valeursMetier', 'fr', 'sante-amo'))
    expect(amo).toMatch(/liquidation|prestations/i); expect(amo).not.toMatch(/Circuit du médicament|Coordination des interventions à domicile/)
    const cab = JSON.stringify(sectorExemplesFor(SANTE, 'biensSupports', 'fr', 'sante-cabinet'))
    expect(cab).toMatch(/gestion de cabinet/i); expect(cab).not.toMatch(/PACS|télégestion/i)
    expect(JSON.stringify(sectorExemplesFor(SANTE, 'biensSupports', 'fr', 'sante-pharma'))).toMatch(/officine/i)
  })
  it('les assureurs maladie (AMO / AMC) voient la fraude aux prestations et la protection des données de santé', () => {
    expect(JSON.stringify(sectorExemplesFor(SANTE, 'evenementsRedoutes', 'fr', 'sante-amo'))).toMatch(/fraude/i)
    expect(JSON.stringify(sectorExemplesFor(SANTE, 'evenementsRedoutes', 'fr', 'sante-amc'))).toMatch(/données de santé/i)
  })
  it('traduit en EN / DE / ES / IT (aucun repli sur le français pour les nouveaux exemples)', () => {
    for (const loc of ['en', 'de', 'es', 'it'] as Locale[]) {
      for (const id of NOUVEAUX) {
        const fr = sectorExemplesFor(SANTE, 'valeursMetier', 'fr', id).map(x => x.nom)
        const tr = sectorExemplesFor(SANTE, 'valeursMetier', loc, id).map(x => x.nom)
        expect(tr.length).toBe(fr.length)
        const spe = tr.filter((n, i) => n === fr[i])
        expect(spe, `${loc}/${id}`).toEqual([])
      }
    }
  })
  it('sans sous-secteur choisi, les exemples détaillés ne noient pas les exemples généraux du secteur santé', () => {
    const tout = JSON.stringify(['valeursMetier', 'biensSupports', 'evenementsRedoutes', 'scenariosStrategiques'].flatMap(c => sectorExemplesFor(SANTE, c as never, 'fr')))
    expect(tout).not.toMatch(/liquidation|gestion de cabinet|tiers payant/i)
    expect(tout).toMatch(/Dossier Patient Informatisé/)
  })
})
