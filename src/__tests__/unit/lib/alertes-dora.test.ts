import { describe, it, expect } from 'vitest'
import { alertesDoraDues } from '@/lib/alertes-dora'
import { planifierDeclarationDora } from '@/lib/dora-reporting'

const H = 3_600_000
const now = new Date('2026-10-01T10:00:00Z')
const h = (n: number) => new Date(now.getTime() + n * H)

describe('alertes DORA', () => {
  it('incident majeur classé il y a 1 h : notification initiale à faire immédiatement, rien d’autre encore', () => {
    const e = planifierDeclarationDora({ classe: 'MAJEUR', dateDetection: h(-2), dateClassification: h(-1) }, now)
    expect(alertesDoraDues(e, {}, now).map(a => a.cle)).toEqual(['INITIALE:A_FAIRE'])
  })
  it('une seule alerte par phase et statut ; le retard déclenche une nouvelle alerte', () => {
    const e = planifierDeclarationDora({ classe: 'MAJEUR', dateDetection: h(-30), dateClassification: h(-10) }, now)
    expect(alertesDoraDues(e, { 'INITIALE:A_FAIRE': 'x' }, now).map(a => a.cle)).toEqual(['INITIALE:EN_RETARD'])
    expect(alertesDoraDues(e, { 'INITIALE:A_FAIRE': 'x', 'INITIALE:EN_RETARD': 'x' }, now)).toEqual([])
  })
  it('rapport intermédiaire 24 h avant, rapport final 7 jours avant', () => {
    // Initiale soumise il y a 50 h : intermédiaire à 72 h → dans 22 h ; finale à 1 mois → hors fenêtre.
    const e = planifierDeclarationDora({ classe: 'MAJEUR', dateDetection: h(-60), dateClassification: h(-55), initialeSoumiseLe: h(-50) }, now)
    expect(alertesDoraDues(e, {}, now).map(a => a.cle)).toEqual(['INTERMEDIAIRE:A_FAIRE'])
    const tard = new Date(h(-50).getTime() + 25 * 24 * H)
    const eTard = planifierDeclarationDora({ classe: 'MAJEUR', dateDetection: h(-60), dateClassification: h(-55), initialeSoumiseLe: h(-50) }, tard)
    expect(alertesDoraDues(eTard, { 'INTERMEDIAIRE:A_FAIRE': 'x' }, tard).map(a => a.cle)).toEqual(['INTERMEDIAIRE:EN_RETARD', 'FINALE:A_FAIRE'])
  })
  it('incident non majeur ou phases soumises : aucune alerte', () => {
    expect(alertesDoraDues(planifierDeclarationDora({ classe: 'MINEUR', dateDetection: h(-50) }, now), {}, now)).toEqual([])
    const e = planifierDeclarationDora({ classe: 'MAJEUR', dateDetection: h(-2), dateClassification: h(-1), initialeSoumiseLe: h(-0.5) }, now)
    expect(alertesDoraDues(e, {}, now)).toEqual([])
  })
})
