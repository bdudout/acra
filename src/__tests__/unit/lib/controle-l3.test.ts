/** Contrôle permanent L3 : typologie, conception vs efficacité, échantillon, plan annuel, flux continu, récurrence. */
import { describe, expect, it } from 'vitest'
import {
  TYPES_CONTROLE, MODES_CONTROLE, METHODES_ECHANTILLON, sanitizeTypologie, cleanConceptionInput, sanitizeConception,
  appreciationControle, tailleEchantillonSuggeree, planAnnuel, fluxInterrompu, analyseRecurrence, escaladeAnomalie,
  champsL3Creation, champsL3Modification, vueControleL3,
} from '@/lib/controle-l3'

describe('typologie', () => {
  it('catalogues livrés', () => {
    expect(TYPES_CONTROLE).toEqual(['PREVENTIF', 'DETECTIF', 'CORRECTIF'])
    expect(MODES_CONTROLE).toEqual(['MANUEL', 'AUTOMATIQUE'])
    expect(METHODES_ECHANTILLON).toEqual(['FIXE', 'STATISTIQUE', 'ALEATOIRE', 'EXHAUSTIF'])
  })
  it('valeurs inconnues écartées ; défaut manuel, non clé (rétrocompatible)', () => {
    expect(sanitizeTypologie({})).toEqual({ typeControle: null, modeControle: 'MANUEL', cle: false, methodeEchantillon: null })
    expect(sanitizeTypologie({ typeControle: 'DETECTIF', modeControle: 'AUTOMATIQUE', cle: true, methodeEchantillon: 'STATISTIQUE' }))
      .toEqual({ typeControle: 'DETECTIF', modeControle: 'AUTOMATIQUE', cle: true, methodeEchantillon: 'STATISTIQUE' })
    expect(sanitizeTypologie({ typeControle: 'x', modeControle: 'y', cle: 'oui', methodeEchantillon: 'z' })).toEqual({ typeControle: null, modeControle: 'MANUEL', cle: false, methodeEchantillon: null })
  })
})

describe('conception (évaluation de la conception du contrôle)', () => {
  const now = new Date('2026-09-29T10:00:00Z')
  it('entrée nettoyée avec évaluateur et date posés côté serveur', () => {
    expect(cleanConceptionInput({ statut: 'A_AMELIORER', commentaire: '  Couverture partielle ' }, { evaluateurId: 'u1', now }))
      .toEqual({ statut: 'A_AMELIORER', commentaire: 'Couverture partielle', evaluateurId: 'u1', evalueLe: '2026-09-29T10:00:00.000Z' })
    expect(cleanConceptionInput({ statut: 'NOPE' }, { evaluateurId: 'u1', now })).toBeNull()
    expect(cleanConceptionInput(null, { evaluateurId: 'u1', now })).toBeNull()
  })
  it('lecture d’une valeur stockée : vide ou invalide → null', () => {
    expect(sanitizeConception({})).toBeNull()
    expect(sanitizeConception({ statut: 'ADEQUATE', evalueLe: '2026-09-29T10:00:00.000Z', evaluateurId: 'u1' })).toMatchObject({ statut: 'ADEQUATE' })
  })
})

describe('appréciation conception × efficacité opérationnelle', () => {
  it.each([
    [null, null, 'NON_EVALUE'],
    ['ADEQUATE', 'FORTE', 'EFFICACE'],
    ['ADEQUATE', 'MOYENNE', 'A_SURVEILLER'],
    ['A_AMELIORER', 'FORTE', 'A_SURVEILLER'],
    ['ADEQUATE', null, 'A_SURVEILLER'],
    [null, 'FORTE', 'A_SURVEILLER'],
    ['INADEQUATE', 'FORTE', 'DEFAILLANT'],
    ['ADEQUATE', 'FAIBLE', 'DEFAILLANT'],
  ] as const)('conception %s, efficacité %s → %s', (c, e, attendu) => {
    expect(appreciationControle(c, e)).toBe(attendu)
  })
})

describe('taille d’échantillon suggérée (proposition, jamais imposée)', () => {
  it('exhaustif = population ; méthodes par échantillonnage selon la population ; contrôle clé majoré', () => {
    expect(tailleEchantillonSuggeree('EXHAUSTIF', 300, false)).toBe(300)
    expect(tailleEchantillonSuggeree('STATISTIQUE', 8, false)).toBe(8)
    expect(tailleEchantillonSuggeree('STATISTIQUE', 40, false)).toBe(10)
    expect(tailleEchantillonSuggeree('ALEATOIRE', 200, false)).toBe(25)
    expect(tailleEchantillonSuggeree('STATISTIQUE', 900, false)).toBe(40)
    expect(tailleEchantillonSuggeree('STATISTIQUE', 5000, false)).toBe(60)
    expect(tailleEchantillonSuggeree('STATISTIQUE', 200, true)).toBe(38)
  })
  it('méthode fixe ou population inconnue → aucune suggestion', () => {
    expect(tailleEchantillonSuggeree('FIXE', 200, false)).toBeNull()
    expect(tailleEchantillonSuggeree('STATISTIQUE', 0, false)).toBeNull()
  })
})

describe('planAnnuel', () => {
  const now = new Date('2026-05-15T00:00:00Z')
  const controles = [
    { id: 'c1', intitule: 'Revue des accès', periodicite: 'MENSUEL', responsable: 'Alice', niveau: 'N1', actif: true, cle: true, creeLe: new Date('2025-01-01T00:00:00Z') },
    { id: 'c2', intitule: 'Sauvegardes', periodicite: 'TRIMESTRIEL', responsable: 'Alice', niveau: 'N1', actif: true, cle: false, creeLe: new Date('2025-01-01T00:00:00Z') },
    { id: 'c3', intitule: 'Contrôle inactif', periodicite: 'ANNUEL', responsable: 'Bob', niveau: 'N2', actif: false, cle: false, creeLe: new Date('2025-01-01T00:00:00Z') },
    { id: 'c4', intitule: 'Créé après', periodicite: 'MENSUEL', responsable: 'Bob', niveau: 'N1', actif: true, cle: false, creeLe: new Date('2026-09-01T00:00:00Z') },
  ]
  const executions = [
    { controleId: 'c1', dateRealisation: new Date('2026-01-10T00:00:00Z'), resultat: 'CONFORME' },
    { controleId: 'c1', dateRealisation: new Date('2026-02-12T00:00:00Z'), resultat: 'ANOMALIE' },
    { controleId: 'c1', dateRealisation: new Date('2026-04-03T00:00:00Z'), resultat: 'CONFORME' },
    { controleId: 'c2', dateRealisation: new Date('2026-02-01T00:00:00Z'), resultat: 'CONFORME' },
  ]
  const p = planAnnuel(controles, executions, 2026, now)
  it('une occurrence par période ; contrôles inactifs exclus ; un contrôle créé en cours d’année ne compte que dès sa création', () => {
    expect(p.lignes.map(l => l.controleId)).toEqual(['c1', 'c2', 'c4'])
    expect(p.lignes.find(l => l.controleId === 'c1')!.occurrences).toHaveLength(12)
    expect(p.lignes.find(l => l.controleId === 'c2')!.occurrences).toHaveLength(4)
    const c4 = p.lignes.find(l => l.controleId === 'c4')!.occurrences
    expect(c4).toHaveLength(4) // septembre → décembre
    expect(c4[0].debut).toBe('2026-09-01')
  })
  it('statuts : réalisée, en retard (période échue sans exécution), en cours, à venir', () => {
    const st = (id: string) => p.lignes.find(l => l.controleId === id)!.occurrences.map(o => o.statut)
    expect(st('c1').slice(0, 5)).toEqual(['REALISEE', 'REALISEE', 'EN_RETARD', 'REALISEE', 'EN_COURS'])
    expect(st('c1').slice(5).every(x => x === 'A_VENIR')).toBe(true)
    expect(st('c2')).toEqual(['REALISEE', 'EN_COURS', 'A_VENIR', 'A_VENIR'])
  })
  it('synthèse : prévues, échues, réalisées, en retard, taux de réalisation (l’en cours ne pénalise pas)', () => {
    expect(p.synthese).toMatchObject({ prevues: 20, echues: 5, realisees: 4, enRetard: 1, enCours: 2, tauxRealisation: 80 })
  })
  it('répartition par mois d’échéance', () => {
    expect(p.parMois).toHaveLength(12)
    expect(p.parMois[2]).toMatchObject({ mois: 3, prevues: 2, realisees: 1, enRetard: 1 }) // mars : c1 mensuel (en retard) + fin T1 (réalisé)
  })
  it('charge par responsable et par mois, pics signalés', () => {
    const alice = p.charge.find(c => c.responsable === 'Alice')!
    expect(alice.parMois).toHaveLength(12)
    expect(alice.parMois[2]).toBe(2) // mars : contrôle mensuel + fin du T1
    const pics = planAnnuel(Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, intitule: 'x', periodicite: 'ANNUEL', responsable: 'Zoé', niveau: 'N1', actif: true, cle: false, creeLe: new Date('2025-01-01') })), [], 2026, now)
    expect(pics.charge.find(c => c.responsable === 'Zoé')!.pics).toEqual([11])
  })
})

describe('flux continu et récurrence', () => {
  const now = new Date('2026-09-29T00:00:00Z')
  it('un contrôle automatique sans résultat depuis plus d’une période est signalé « flux interrompu »', () => {
    const c = { modeControle: 'AUTOMATIQUE', periodicite: 'MENSUEL', actif: true, creeLe: new Date('2026-01-01T00:00:00Z') }
    expect(fluxInterrompu(c, new Date('2026-09-25T00:00:00Z'), now)).toBe(false)
    expect(fluxInterrompu(c, new Date('2026-07-01T00:00:00Z'), now)).toBe(true)
    expect(fluxInterrompu({ ...c, modeControle: 'MANUEL' }, new Date('2026-07-01T00:00:00Z'), now)).toBe(false)
    expect(fluxInterrompu({ ...c, actif: false }, new Date('2026-07-01T00:00:00Z'), now)).toBe(false)
  })
  it('récurrence : deux anomalies consécutives ou trois sur les quatre dernières', () => {
    const ex = (...r: string[]) => r.map((resultat, i) => ({ resultat, dateRealisation: new Date(2026, 0, 1 + i) }))
    expect(analyseRecurrence(ex('CONFORME', 'ANOMALIE', 'ANOMALIE'))).toEqual({ consecutives: 2, recurrente: true })
    expect(analyseRecurrence(ex('ANOMALIE', 'CONFORME', 'ANOMALIE', 'CONFORME', 'ANOMALIE', 'CONFORME'))).toEqual({ consecutives: 0, recurrente: false })
    expect(analyseRecurrence(ex('ANOMALIE', 'ANOMALIE', 'CONFORME', 'ANOMALIE'))).toEqual({ consecutives: 1, recurrente: true })
    expect(analyseRecurrence(ex('CONFORME', 'CONFORME'))).toEqual({ consecutives: 0, recurrente: false })
    expect(analyseRecurrence(ex('CONFORME', 'NON_APPLICABLE', 'ANOMALIE'))).toEqual({ consecutives: 1, recurrente: false })
  })
  it('escalade : récurrente → N2 ; récurrente sur contrôle clé → comité ; sinon rien', () => {
    expect(escaladeAnomalie(true, { consecutives: 2, recurrente: true })).toBe('COMITE')
    expect(escaladeAnomalie(false, { consecutives: 2, recurrente: true })).toBe('N2')
    expect(escaladeAnomalie(true, { consecutives: 1, recurrente: false })).toBeNull()
  })
})

describe('champs L3 à persister', () => {
  const now = new Date('2026-09-29T10:00:00Z')
  it('création : typologie normalisée (défauts), conception vide', () => {
    expect(champsL3Creation({ typeControle: 'DETECTIF', cle: true })).toEqual({ typeControle: 'DETECTIF', modeControle: 'MANUEL', cle: true, methodeEchantillon: null, conception: {} })
  })
  it('modification partielle : seuls les champs présents sont écrits ; conception posée avec évaluateur ; null l’efface', () => {
    expect(champsL3Modification({ cle: true }, { evaluateurId: 'u1', now })).toEqual({ cle: true })
    expect(champsL3Modification({ modeControle: 'AUTOMATIQUE', conception: { statut: 'ADEQUATE' } }, { evaluateurId: 'u1', now }))
      .toEqual({ modeControle: 'AUTOMATIQUE', conception: { statut: 'ADEQUATE', evaluateurId: 'u1', evalueLe: now.toISOString() } })
    expect(champsL3Modification({ conception: null }, { evaluateurId: 'u1', now })).toEqual({ conception: {} })
    expect(champsL3Modification({ conception: { statut: 'NOPE' } }, { evaluateurId: 'u1', now })).toEqual({})
    expect(champsL3Modification({ typeControle: 'zzz' }, { evaluateurId: 'u1', now })).toEqual({ typeControle: null })
  })
})

describe('vueControleL3', () => {
  const now = new Date('2026-09-29T00:00:00Z')
  it('appréciation, récurrence, escalade et flux interrompu pour un contrôle', () => {
    const v = vueControleL3({
      cle: true, modeControle: 'AUTOMATIQUE', periodicite: 'MENSUEL', actif: true, creeLe: new Date('2026-01-01'), conception: { statut: 'ADEQUATE' },
      efficacite: 'FORTE', executions: [{ resultat: 'ANOMALIE', dateRealisation: new Date('2026-06-02') }, { resultat: 'ANOMALIE', dateRealisation: new Date('2026-07-01') }],
    }, now)
    expect(v).toMatchObject({ appreciation: 'EFFICACE', recurrence: { consecutives: 2, recurrente: true }, escalade: 'COMITE', fluxInterrompu: true })
    expect(v.conception).toMatchObject({ statut: 'ADEQUATE' })
  })
})
