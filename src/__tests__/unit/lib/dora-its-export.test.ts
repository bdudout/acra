import { describe, it, expect } from 'vitest'
import {
  buildDoraItsRow, DORA_ITS_CSV_HEADER, estDeclarableIts,
  type DoraItsIncident,
} from '../../../lib/dora-its-export'
import { evaluerReportingIncident } from '../../../lib/dora-reporting'

const NOW = new Date('2026-06-10T00:00:00Z')

// Incident majeur : critères qui déclenchent MAJEUR (service critique + données).
const majeurCriteres = { serviceCritique: true, pertesDonnees: true, clientsAffectes: 200000, reputation: true }

describe('estDeclarableIts', () => {
  it('vrai uniquement pour un incident classé majeur', () => {
    const majeur = evaluerReportingIncident({ doraCriteres: majeurCriteres, dateDetection: '2026-06-09T08:00:00Z', doraClasseMajeurLe: '2026-06-09T09:00:00Z' }, NOW)
    const mineur = evaluerReportingIncident({ doraCriteres: {}, dateDetection: '2026-06-09T08:00:00Z' }, NOW)
    expect(estDeclarableIts(majeur)).toBe(true)
    expect(estDeclarableIts(mineur)).toBe(false)
  })
})

describe('buildDoraItsRow', () => {
  const inc: DoraItsIncident = {
    id: 'abcdef1234', intitule: 'Panne du service de paiement',
    dateDetection: '2026-06-09T08:00:00Z', doraClasseMajeurLe: '2026-06-09T09:00:00Z',
  }
  const reporting = evaluerReportingIncident({
    doraCriteres: majeurCriteres, dateDetection: inc.dateDetection, doraClasseMajeurLe: inc.doraClasseMajeurLe,
    doraInitialeSoumiseLe: '2026-06-09T10:00:00Z',
  }, NOW)

  it('produit une ligne alignée sur l’en-tête', () => {
    const row = buildDoraItsRow(inc, reporting)
    expect(row.length).toBe(DORA_ITS_CSV_HEADER.length)
  })

  it('reporte la classification et le statut des trois phases', () => {
    const row = buildDoraItsRow(inc, reporting)
    expect(row).toContain('MAJEUR')
    // La phase initiale a été soumise.
    expect(row).toContain('SOUMIS')
    // Les phases intermédiaire/finale restent à faire ou en retard.
    expect(row.some(c => c === 'A_FAIRE' || c === 'EN_RETARD')).toBe(true)
  })

  it('neutralise l’injection de formule dans l’intitulé', () => {
    const row = buildDoraItsRow({ ...inc, intitule: '=SUM(A1)' }, reporting)
    expect(row.some(c => c.startsWith("'="))).toBe(true)
  })
})
