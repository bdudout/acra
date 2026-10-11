import { describe, expect, it } from 'vitest'
import { cadrageInitial } from '@/lib/cadrage-initial'

describe('cadrage créé avec l’analyse', () => {
  it('projet 360 : la description devient le périmètre et les objectifs saisis à la création sont repris', () => {
    expect(cadrageInitial({ methode: 'PROJET_360', description: 'Paie et RH', objectifsEtude: 'Sécuriser la bascule' })).toEqual({ perimetre: 'Paie et RH', objectifsEtude: 'Sécuriser la bascule' })
    expect(cadrageInitial({ methode: 'PROJET_360' })).toEqual({ perimetre: null, objectifsEtude: null })
  })
  it('analyse issue d’un socle : périmètre, objectifs, missions, valeurs métier et biens supports hérités ; objectifs saisis prioritaires', () => {
    const socle = { perimetre: 'P', objectifsEtude: 'O socle', missions: 'M', valeursMetier: [1], biensSupports: [2], evenementsRedoutes: [3] }
    expect(cadrageInitial({ methode: 'EBIOS_RM' }, socle)).toEqual({ perimetre: 'P', objectifsEtude: 'O socle', missions: 'M', valeursMetier: [1], biensSupports: [2] })
    expect(cadrageInitial({ methode: 'EBIOS_RM', objectifsEtude: 'Mes objectifs' }, socle).objectifsEtude).toBe('Mes objectifs')
  })
  it('autre analyse : cadrage vide, sauf objectifs saisis', () => {
    expect(cadrageInitial({ methode: 'EBIOS_RM' })).toEqual({})
    expect(cadrageInitial({ methode: 'ISO_27005', objectifsEtude: '  Objectif  ' })).toEqual({ objectifsEtude: 'Objectif' })
  })
})

// Recette n° 16 : petite structure par défaut intelligent — profil « TPE » présélectionné quand le pattern
// « SI de très petite entreprise » est coché ou que l'organisation est une petite structure.
describe('cadrageInitial — profil de dimensionnement', () => {
  it('pattern SI_TPE ou petite structure → TPE ; sinon rien (défaut STANDARD du schéma)', () => {
    expect(cadrageInitial({ methode: 'EBIOS_RM', patterns: ['SAAS', 'SI_TPE'] })).toEqual({ tailleAnalyse: 'TPE' })
    expect(cadrageInitial({ methode: 'EBIOS_RM', petiteStructure: true })).toEqual({ tailleAnalyse: 'TPE' })
    expect(cadrageInitial({ methode: 'EBIOS_RM', patterns: ['SAAS'] })).toEqual({})
    expect(cadrageInitial({ methode: 'EBIOS_RM', patterns: ['SI_TPE'] }, { perimetre: 'P' })).toMatchObject({ perimetre: 'P', tailleAnalyse: 'TPE' })
  })
})

