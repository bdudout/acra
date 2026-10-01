import { describe, it, expect } from 'vitest'
import { sanitizeQuestions, questionsDepuisExigences, sanitizeReponses, questionsIncompletes, appliquerRevue, nonConformitesExigences, anomaliesControles, peutRepondre, peutReviser, MAX_PREUVES_PAR_QUESTION } from '@/lib/questionnaire'

const pdf = (n = 'p.pdf') => ({ nom: n, mime: 'application/pdf', taille: 10, dataUrl: 'data:application/pdf;base64,AAAA' })

describe('questions d’un modèle', () => {
  it('écarte les questions invalides, borne les choix, donne des identifiants uniques et garde les cibles valides', () => {
    const q = sanitizeQuestions([
      { id: 'a', libelle: 'Les accès sont-ils revus ?', type: 'OUI_NON', cible: { type: 'CONTROLE', id: 'c1' } },
      { id: 'a', libelle: 'Doublon d’identifiant', type: 'TEXTE', obligatoire: false },
      { libelle: 'Fréquence', type: 'CHOIX', choix: ['Mensuelle', 'Mensuelle', 'Annuelle'] },
      { libelle: 'Un seul choix', type: 'CHOIX', choix: ['X'] },
      { libelle: '', type: 'TEXTE' },
      { libelle: 'Type inconnu', type: 'SCRIPT' },
      { libelle: 'Exigence', type: 'OUI_NON', preuveRequise: true, cible: { type: 'EXIGENCE', referentielCode: 'ISO27001', ref: '5.15' } },
      { libelle: 'Cible invalide', type: 'TEXTE', cible: { type: 'EXIGENCE', ref: '5.15' } },
    ])
    expect(q.map(x => x.id)).toEqual(['a', 'q2', 'q3', 'q4', 'q5'])
    expect(q[0]).toMatchObject({ obligatoire: true, preuveRequise: false, cible: { type: 'CONTROLE', id: 'c1' } })
    expect(q[1].obligatoire).toBe(false)
    expect(q[2].choix).toEqual(['Mensuelle', 'Annuelle'])
    expect(q[3]).toMatchObject({ preuveRequise: true, cible: { type: 'EXIGENCE', referentielCode: 'ISO27001', ref: '5.15' } })
    expect(q[4].cible).toBeUndefined()
  })
  it('mode exigences : une question oui/non avec preuve requise par exigence', () => {
    const q = questionsDepuisExigences('ISO27001', [{ ref: '5.15', nom: 'Contrôle d’accès' }], e => `${e.ref} — ${e.nom} : conforme ?`)
    expect(q).toEqual([{ id: 'ex1', libelle: '5.15 — Contrôle d’accès : conforme ?', type: 'OUI_NON', obligatoire: true, preuveRequise: true, cible: { type: 'EXIGENCE', referentielCode: 'ISO27001', ref: '5.15' } }])
  })
})

describe('réponses du métier', () => {
  const questions = sanitizeQuestions([
    { id: 'oui', libelle: 'Q1', type: 'OUI_NON', preuveRequise: true },
    { id: 'nb', libelle: 'Q2', type: 'NOMBRE' },
    { id: 'ch', libelle: 'Q3', type: 'CHOIX', choix: ['A', 'B'] },
    { id: 'opt', libelle: 'Q4', type: 'TEXTE', obligatoire: false },
  ])
  it('valeurs typées, questions inconnues écartées, preuves bornées, revue existante conservée', () => {
    const r = sanitizeReponses(questions, [
      { questionId: 'oui', valeur: true, preuves: [pdf(), pdf(), pdf(), pdf(), { nom: 'x.html', dataUrl: 'data:text/html;base64,AA' }] },
      { questionId: 'nb', valeur: '12' },
      { questionId: 'ch', valeur: 'Z' },
      { questionId: 'inconnue', valeur: 'x' },
    ], [{ questionId: 'oui', valeur: false, preuves: [], revue: { statut: 'A_COMPLETER', par: 'u', le: 'd' } }])
    expect(r.map(x => x.questionId)).toEqual(['oui', 'nb', 'ch'])
    expect(r[0].preuves).toHaveLength(MAX_PREUVES_PAR_QUESTION)
    expect(r[0].revue?.statut).toBe('A_COMPLETER')
    expect(r[1].valeur).toBe(12)
    expect(r[2].valeur).toBeNull()
  })
  it('soumission refusée tant qu’une réponse obligatoire ou une preuve requise manque', () => {
    expect(questionsIncompletes(questions, [])).toEqual(['oui', 'nb', 'ch'])
    const ok = sanitizeReponses(questions, [{ questionId: 'oui', valeur: false, preuves: [pdf()] }, { questionId: 'nb', valeur: 0 }, { questionId: 'ch', valeur: 'A' }])
    expect(questionsIncompletes(questions, ok)).toEqual([])
    expect(peutRepondre('A_COMPLETER')).toBe(true); expect(peutRepondre('SOUMISE')).toBe(false)
    expect(peutReviser('SOUMISE')).toBe(true); expect(peutReviser('REVUE')).toBe(false)
  })
})

describe('revue du contrôleur', () => {
  const reponses = [{ questionId: 'a', valeur: true, preuves: [] }, { questionId: 'b', valeur: false, preuves: [] }]
  const ctx = { acteur: 'ctrl', now: new Date('2026-10-01T10:00:00Z') }
  it('chaque question doit être revue ; un renvoi ou une non-conformité exige un commentaire', () => {
    expect(appliquerRevue(reponses, [{ questionId: 'a', statut: 'ACCEPTEE' }], ctx)).toEqual({ ok: false, error: 'revue_incomplete' })
    expect(appliquerRevue(reponses, [{ questionId: 'a', statut: 'ACCEPTEE' }, { questionId: 'b', statut: 'NON_CONFORME' }], ctx)).toEqual({ ok: false, error: 'commentaire_requis' })
  })
  it('statut REVUE si tout est tranché, A_COMPLETER si une question est renvoyée au métier', () => {
    const r1 = appliquerRevue(reponses, [{ questionId: 'a', statut: 'ACCEPTEE' }, { questionId: 'b', statut: 'NON_CONFORME', commentaire: 'Pas de revue des accès' }], ctx)
    expect(r1).toMatchObject({ ok: true, statut: 'REVUE' })
    if (r1.ok) expect(r1.reponses[1].revue).toEqual({ statut: 'NON_CONFORME', commentaire: 'Pas de revue des accès', par: 'ctrl', le: '2026-10-01T10:00:00.000Z' })
    const r2 = appliquerRevue(reponses, [{ questionId: 'a', statut: 'A_COMPLETER', commentaire: 'Preuve illisible' }, { questionId: 'b', statut: 'ACCEPTEE' }], ctx)
    expect(r2).toMatchObject({ ok: true, statut: 'A_COMPLETER' })
  })
  it('les non-conformités revues sur des exigences alimentent la conformité constatée', () => {
    const questions = [{ id: 'ex1', libelle: 'x', type: 'OUI_NON', cible: { type: 'EXIGENCE', referentielCode: 'ISO27001', ref: '5.15' } }, { id: 'q2', libelle: 'y', type: 'TEXTE' }]
    const nc = nonConformitesExigences([{ questions, reponses: [{ statut: 'REVUE', reponses: [
      { questionId: 'ex1', valeur: false, preuves: [], revue: { statut: 'NON_CONFORME', par: 'c', le: 'd' } },
      { questionId: 'q2', valeur: 'x', preuves: [], revue: { statut: 'NON_CONFORME', par: 'c', le: 'd' } },
    ] }] }])
    expect(nc).toEqual([{ referentielCode: 'ISO27001', ref: '5.15' }])
  })
})

describe('non-conformités déjà reprises par une préconisation', () => {
  it('ne sont pas comptées deux fois ; les autres restent comptées, question par question', () => {
    const questions = [
      { id: 'a', libelle: 'x', type: 'OUI_NON', cible: { type: 'EXIGENCE', referentielCode: 'ISO27001', ref: '5.15' } },
      { id: 'b', libelle: 'y', type: 'OUI_NON', cible: { type: 'EXIGENCE', referentielCode: 'ISO27001', ref: '8.2' } },
    ]
    const nc = { statut: 'NON_CONFORME', par: 'c', le: 'd' }
    const envois = [{ questions, reponses: [{ id: 'r1', statut: 'REVUE', reponses: [{ questionId: 'a', valeur: false, preuves: [], revue: nc }, { questionId: 'b', valeur: false, preuves: [], revue: nc }] }] }]
    expect(nonConformitesExigences(envois, new Set(['r1|a']))).toEqual([{ referentielCode: 'ISO27001', ref: '8.2' }])
  })
})

describe('anomalies de contrôle issues d’une revue', () => {
  const questions = sanitizeQuestions([
    { id: 'q1', libelle: 'Revue des accès faite ?', type: 'OUI_NON', cible: { type: 'CONTROLE', id: 'c1' } },
    { id: 'q2', libelle: 'Sauvegardes testées ?', type: 'OUI_NON', cible: { type: 'CONTROLE', id: 'c2' } },
    { id: 'q3', libelle: 'Exigence', type: 'OUI_NON', cible: { type: 'EXIGENCE', referentielCode: 'ISO27001', ref: '8.2' } },
  ])
  const revue = (statut: string, commentaire?: string) => ({ statut, commentaire, par: 'C', le: '2026-10-01' })
  it('une question NON_CONFORME rattachée à un point de contrôle donne une anomalie, avec commentaire et preuves', () => {
    const reponses = [
      { questionId: 'q1', valeur: true, preuves: [pdf()], revue: revue('NON_CONFORME', 'Revue non tracée') },
      { questionId: 'q2', valeur: true, preuves: [], revue: revue('ACCEPTEE') },
      { questionId: 'q3', valeur: false, preuves: [], revue: revue('NON_CONFORME', 'KO') },
    ]
    expect(anomaliesControles(questions, reponses as never)).toEqual([
      { controleId: 'c1', questionId: 'q1', libelle: 'Revue des accès faite ?', commentaire: 'Revue non tracée', preuves: [pdf()] },
    ])
  })
})

