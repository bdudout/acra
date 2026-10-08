// Vue globale des plans d'audit et de contrôle (lot P5) : sollicitations multiples (et simultanées) des entités, filiales
// et tiers ; angles morts (risques critiques ou majeurs, processus critiques ou importants non couverts depuis N ans).
import { describe, expect, it } from 'vitest'
import { sollicitationsMultiples, anglesMorts, risqueCritiqueOuMajeur, processusCritiqueOuImportant, periodesSeChevauchent } from '@/lib/planification-vue'

const L = (id: string, plan: string, debut: string | null, fin: string | null, cibles: { organisations?: string[]; tiers?: string[] }) =>
  ({ ligneId: id, planId: plan, planNom: `Plan ${plan}`, type: 'AUDIT' as const, intitule: `Ligne ${id}`, debut, fin, statutManuel: null, cibles })

describe('chevauchement de périodes', () => {
  it('bornes incluses ; sans date de début : pas de chevauchement ; sans fin : un jour', () => {
    expect(periodesSeChevauchent({ debut: '2027-03-01', fin: '2027-03-31' }, { debut: '2027-03-31', fin: '2027-04-10' })).toBe(true)
    expect(periodesSeChevauchent({ debut: '2027-03-01', fin: '2027-03-30' }, { debut: '2027-03-31', fin: null })).toBe(false)
    expect(periodesSeChevauchent({ debut: null, fin: null }, { debut: '2027-03-31', fin: null })).toBe(false)
  })
})

describe('sollicitations multiples', () => {
  const lignes = [
    L('a', 'p1', '2027-03-01', '2027-03-31', { organisations: ['f1', 'f2'], tiers: ['t1'] }),
    L('b', 'p2', '2027-03-15', '2027-04-15', { organisations: ['f1'] }),
    L('c', 'p2', '2027-09-01', '2027-09-30', { organisations: ['f2'], tiers: ['t1'] }),
    L('d', 'p3', '2027-10-01', '2027-10-31', { organisations: ['f3'] }),
    { ...L('e', 'p3', '2027-03-20', '2027-03-25', { organisations: ['f1'] }), statutManuel: 'ANNULEE' },
  ]
  const noms = { f1: 'Filiale 1', f2: 'Filiale 2', f3: 'Filiale 3', t1: 'Hébergeur' }
  it('cibles visées par au moins deux lignes, simultanées en tête ; lignes annulées écartées', () => {
    const s = sollicitationsMultiples(lignes, noms)
    expect(s.organisations.map(o => [o.id, o.nombre, o.simultanee])).toEqual([['f1', 2, true], ['f2', 2, false]])
    expect(s.organisations[0]).toMatchObject({ nom: 'Filiale 1', plans: 2 })
    expect(s.tiers).toEqual([expect.objectContaining({ id: 't1', nom: 'Hébergeur', nombre: 2, simultanee: false })])
  })
})

describe('angles morts', () => {
  it('criticité : risque élevé ou critique (inhérent, à défaut résiduel) ; processus de criticité 3-4 ou DORA critique / important', () => {
    expect(risqueCritiqueOuMajeur({ graviteInherente: 4, vraisemblanceInherente: 2 })).toBe(true)
    expect(risqueCritiqueOuMajeur({ graviteInherente: 2, vraisemblanceInherente: 3 })).toBe(false)
    expect(risqueCritiqueOuMajeur({ graviteResiduelle: 3, vraisemblanceResiduelle: 3 })).toBe(true)
    expect(processusCritiqueOuImportant({ criticite: 3, criticiteDora: null })).toBe(true)
    expect(processusCritiqueOuImportant({ criticite: 1, criticiteDora: 'IMPORTANTE' })).toBe(true)
    expect(processusCritiqueOuImportant({ criticite: 2, criticiteDora: 'NON_CRITIQUE' })).toBe(false)
  })
  it('non couverts depuis le seuil ou jamais, les plus anciens d’abord ; prévus signalés', () => {
    const now = new Date('2027-06-01T00:00:00Z')
    const r = anglesMorts({
      maintenant: now, seuilAns: 3,
      risques: [
        { id: 'r1', intitule: 'Fraude', graviteInherente: 4, vraisemblanceInherente: 3 },
        { id: 'r2', intitule: 'Panne', graviteInherente: 4, vraisemblanceInherente: 4 },
        { id: 'r3', intitule: 'Mineur', graviteInherente: 1, vraisemblanceInherente: 1 },
        { id: 'r4', intitule: 'Récent', graviteInherente: 3, vraisemblanceInherente: 3 },
      ],
      processus: [{ id: 'p1', nom: 'Paie', criticite: 4, criticiteDora: null }, { id: 'p2', nom: 'Achats', criticite: 1, criticiteDora: null }],
      dernieresCouvertures: { risques: { r1: '2023-05-01', r4: '2026-01-10' }, processus: {} },
      prevus: { risques: ['r2'], processus: [] },
    })
    expect(r.risques).toEqual([
      { id: 'r2', nom: 'Panne', niveau: 16, derniere: null, prevu: true },
      { id: 'r1', nom: 'Fraude', niveau: 12, derniere: '2023-05-01', prevu: false },
    ])
    expect(r.processus).toEqual([{ id: 'p1', nom: 'Paie', criticite: 4, criticiteDora: null, derniere: null, prevu: false }])
  })
})
