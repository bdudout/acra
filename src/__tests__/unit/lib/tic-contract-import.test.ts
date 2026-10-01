import { describe, expect, it } from 'vitest'
import { mapTicContractColumns, planTicContractImport, MAX_TIC_ROWS } from '@/lib/tic-contract-import'

const row = (line: number, o: Record<string, string | undefined> = {}) => ({ line, reference: 'C-' + line, prestataire: 'Acme SAS', ...o })
const tiers = [{ id: 't1', nom: 'Acme', lei: '549300ABCDEFGHIJ1234', aliases: [] as string[] }, { id: 't2', nom: 'Beta Cloud', lei: null, aliases: [] as string[] }]

describe('colonnes du fichier de contrats TIC', () => {
  it('reconnaît les en-têtes français et anglais usuels, une colonne ne sert qu’un champ', () => {
    const m = mapTicContractColumns(['Référence du contrat', 'Prestataire', 'LEI', 'Pays', 'Type de service', 'Criticité', 'Date de début', 'Date de fin', 'Fonction supportée', 'Autre'])
    expect(m).toMatchObject({ reference: 'Référence du contrat', prestataire: 'Prestataire', lei: 'LEI', pays: 'Pays', typeService: 'Type de service', criticite: 'Criticité', dateDebut: 'Date de début', dateFin: 'Date de fin', fonction: 'Fonction supportée' })
    expect(mapTicContractColumns(['Contract ref', 'Provider name', 'Service type', 'Criticality', 'Start date', 'End date']))
      .toMatchObject({ reference: 'Contract ref', prestataire: 'Provider name', typeService: 'Service type', criticite: 'Criticality', dateDebut: 'Start date', dateFin: 'End date' })
  })
})

describe('aperçu d’import de contrats TIC', () => {
  it('ligne valide : prête, valeurs normalisées ; valeurs absentes = défauts signalés (jamais une criticité inventée en silence)', () => {
    const plan = planTicContractImport([row(2, { typeService: 'cloud', criticite: 'critique', dateDebut: '2024-01-15', dateFin: '2026-01-14', lei: '549300abcdefghij1234', pays: 'fr' })], [], [])
    const l = plan.lines[0]
    expect(l).toMatchObject({ status: 'READY', typeService: 'CLOUD', criticite: 'CRITIQUE', lei: '549300ABCDEFGHIJ1234', pays: 'FR' })
    expect(l.dateDebut).toBe('2024-01-15')
    const d = planTicContractImport([row(3)], [], []).lines[0]
    expect(d).toMatchObject({ status: 'READY', typeService: 'AUTRE', criticite: 'NON_CRITIQUE' })
    expect(d.warnings).toEqual(expect.arrayContaining(['criticite_default', 'type_default']))
  })
  it('rejette : référence ou prestataire manquant, référence en double dans le fichier, criticité/type/date/LEI invalides, dates incohérentes', () => {
    const plan = planTicContractImport([
      row(2, { reference: '' }), row(3, { prestataire: '' }), row(4, { reference: 'DUP' }), row(5, { reference: 'dup' }),
      row(6, { criticite: 'urgentissime' }), row(7, { dateDebut: 'pas une date' }), row(8, { lei: 'XYZ' }),
      row(9, { dateDebut: '2025-05-01', dateFin: '2025-01-01' }), row(10, { typeService: 'licorne' }),
    ], [], [])
    expect(plan.lines.map(l => l.reason)).toEqual(['missing_reference', 'missing_provider', undefined, 'duplicate_reference', 'invalid_criticality', 'invalid_date', 'invalid_lei', 'inconsistent_dates', 'invalid_type'])
    expect(plan.lines.map(l => l.status)).toEqual(['REJECTED', 'REJECTED', 'READY', 'REJECTED', 'REJECTED', 'REJECTED', 'REJECTED', 'REJECTED', 'REJECTED'])
    expect(plan.toCreate).toHaveLength(1)
  })
  it('référence déjà présente dans l’organisation : « déjà importé », jamais d’écrasement', () => {
    const plan = planTicContractImport([row(2, { reference: 'c-7' })], [{ reference: 'C-7' }], [])
    expect(plan.lines[0].status).toBe('ALREADY_IMPORTED'); expect(plan.toCreate).toHaveLength(0)
  })
  it('identité : LEI identique = candidat certain (lien proposé) ; nom seul = candidat faible, jamais lié ; aucun candidat = pas de lien', () => {
    const plan = planTicContractImport([row(2, { lei: '549300ABCDEFGHIJ1234', prestataire: 'Autre graphie' }), row(3, { prestataire: 'beta cloud sas' }), row(4, { prestataire: 'Inconnu' })], [], tiers)
    expect(plan.lines[0].tier).toEqual({ tierId: 't1', strength: 'STRONG' })
    expect(plan.lines[1].tier).toEqual({ tierId: 't2', strength: 'WEAK' })
    expect(plan.lines[2].tier).toBeUndefined()
    expect(plan.counts).toEqual({ ready: 3, alreadyImported: 0, rejected: 0, certainLinks: 1 })
  })
  it('limite de lignes exposée', () => { expect(MAX_TIC_ROWS).toBe(500) })
})
