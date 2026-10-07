/** Données et services d'un projet 360 et leur criticité ; import depuis les valeurs métier d'une analyse cyber. */
import { describe, expect, it } from 'vitest'
import { sanitizeActifsProjet, actifsDepuisValeursMetier, fusionnerActifs, ACTIFS_MAX } from '@/lib/actifs-projet'

describe('sanitizeActifsProjet', () => {
  it('borne nom, type (donnée / service), criticité (1 à 4), description ; ignore les lignes vides ; plafonne', () => {
    const a = sanitizeActifsProjet([
      { id: 'x1', nom: '  Dossiers clients ', type: 'DONNEE', criticite: 9, description: 'd'.repeat(600) },
      { nom: 'Portail', type: 'INCONNU', criticite: 0 },
      { nom: '   ', type: 'SERVICE', criticite: 2 },
      'n’importe quoi',
      ...Array.from({ length: ACTIFS_MAX + 5 }, (_, i) => ({ nom: `A${i}`, type: 'SERVICE', criticite: 2 })),
    ])
    expect(a[0]).toEqual({ id: 'x1', nom: 'Dossiers clients', type: 'DONNEE', criticite: 4, description: 'd'.repeat(500) })
    expect(a[1]).toMatchObject({ nom: 'Portail', type: 'SERVICE', criticite: 1 })
    expect(a[1].id).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a).toHaveLength(ACTIFS_MAX)
    expect(sanitizeActifsProjet(null)).toEqual([])
  })
})

describe('import depuis les valeurs métier d’une analyse cyber', () => {
  it('information → donnée, processus → service ; criticité = besoin DICT le plus élevé, sinon gravité des événements redoutés', () => {
    const vm = [
      { id: 'v1', nom: 'Données de santé des patients', type: 'INFORMATION', description: 'Dossier médical', disponibilite: 2, integrite: 3, confidentialite: 4, tracabilite: 3 },
      { id: 'v2', nom: 'Prise de rendez-vous', type: 'PROCESSUS' },
      { id: 'v3', nom: '' },
    ]
    const er = [{ valeurMetierId: 'v2', gravite: 3 }, { valeurMetierId: 'v2', gravite: 2 }]
    expect(actifsDepuisValeursMetier(vm, er, 'Analyse cyber — portail')).toEqual([
      expect.objectContaining({ nom: 'Données de santé des patients', type: 'DONNEE', criticite: 4, description: 'Dossier médical', source: 'Analyse cyber — portail' }),
      expect.objectContaining({ nom: 'Prise de rendez-vous', type: 'SERVICE', criticite: 3, source: 'Analyse cyber — portail' }),
    ])
  })
  it('fusion sans doublon d’intitulé : une ligne saisie n’est jamais écrasée', () => {
    const existants = sanitizeActifsProjet([{ id: 'a', nom: 'Prise de rendez-vous', type: 'SERVICE', criticite: 1 }])
    const nouveaux = actifsDepuisValeursMetier([{ id: 'v2', nom: 'prise de RENDEZ-VOUS', type: 'PROCESSUS' }, { id: 'v4', nom: 'Annuaire', type: 'INFORMATION' }], [], 'S')
    const { actifs, ajoutes } = fusionnerActifs(existants, nouveaux)
    expect(ajoutes).toBe(1)
    expect(actifs.map(x => [x.nom, x.criticite])).toEqual([['Prise de rendez-vous', 1], ['Annuaire', 2]])
  })
})
