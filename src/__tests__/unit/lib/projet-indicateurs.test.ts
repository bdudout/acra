/** Indicateurs d'un projet 360 : avancement des plans d'action, retards, plans incomplets, risques sans plan, réduction. */
import { describe, expect, it } from 'vitest'
import { indicateursProjet } from '@/lib/projet-indicateurs'
import { resolveScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT } from '@/lib/appetit'

const ctx = { scale: resolveScaleConfig(null), appetit: APPETIT_DEFAULT }
const now = new Date('2026-10-06T12:00:00Z')
const j = (n: number) => new Date(now.getTime() + n * 86_400_000)
const r = (id: string, g: number, v: number, o: Record<string, number | null> = {}) => ({ id, nom: id, gravite: g, vraisemblance: v, niveauRisque: g * v, ...o })
const plan = (statut: string, o: { echeance?: Date | null; porteur?: string | null; risqueIds?: string[] } = {}) => ({ statut, echeance: o.echeance ?? null, porteur: o.porteur ?? null, risqueIds: o.risqueIds ?? [] })

describe('indicateursProjet', () => {
  it('plans : avancement, en retard, échéance proche, sans porteur ni échéance (plans non terminés)', () => {
    const i = indicateursProjet({
      risques: [],
      plans: [
        plan('FAIT', { echeance: j(-10) }),                       // terminé : jamais en retard
        plan('EN_COURS', { echeance: j(-1), porteur: 'Chef de projet' }), // en retard
        plan('A_FAIRE', { echeance: j(10), porteur: 'DPO' }),      // échéance dans 30 jours
        plan('A_FAIRE'),                                          // sans porteur, sans échéance
      ],
      ctx, now,
    })
    expect(i.plans).toEqual({ total: 4, faits: 1, enCours: 1, aFaire: 2, avancement: 25, enRetard: 1, echeanceProche: 1, sansPorteur: 1, sansEcheance: 1 })
  })
  it('risques à traiter sans plan, réduction brut → résiduel, résiduels hors appétit', () => {
    const i = indicateursProjet({
      risques: [
        r('a', 4, 4, { graviteResiduelle: 2, vraisemblanceResiduelle: 2 }), // à traiter, avec plan, ramené bas
        r('b', 4, 3),                                                    // à traiter, sans plan, résiduel élevé
        r('c', 1, 1),                                                    // acceptable
      ],
      plans: [plan('A_FAIRE', { risqueIds: ['a'] })],
      ctx, now,
    })
    expect(i.risquesATraiterSansPlan).toBe(1)
    expect(i.residuelsHorsAppetit).toBe(1)
    // Σ brut = 16 + 12 + 1 = 29 ; Σ résiduel = 4 + 12 + 1 = 17 → 41 % de réduction.
    expect(i.reductionPct).toBe(41)
  })
  it('projet vide : pas de division par zéro', () => {
    const i = indicateursProjet({ risques: [], plans: [], ctx, now })
    expect(i.plans.avancement).toBeNull()
    expect(i.reductionPct).toBeNull()
  })
})

describe('indicateursProjet — date de mise en service', () => {
  it('jours restants, plans ouverts dont l’échéance tombe après la mise en service', () => {
    const i = indicateursProjet({
      risques: [], ctx, now, miseEnService: j(20),
      plans: [plan('A_FAIRE', { echeance: j(30) }), plan('FAIT', { echeance: j(40) }), plan('EN_COURS', { echeance: j(10) }), plan('A_FAIRE')],
    })
    expect(i.miseEnService).toEqual({ joursRestants: 20, plansApres: 1 })
  })
  it('sans date : pas d’indicateur ; date passée : jours négatifs', () => {
    expect(indicateursProjet({ risques: [], plans: [], ctx, now }).miseEnService).toBeNull()
    expect(indicateursProjet({ risques: [], plans: [], ctx, now, miseEnService: j(-3) }).miseEnService).toEqual({ joursRestants: -3, plansApres: 0 })
  })
})
