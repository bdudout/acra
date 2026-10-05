import { describe, expect, it } from 'vitest'
import { nouvelObjectifVise, majObjectifVise } from '@/lib/objectifs-vises'

const EX = [
  { nom: 'Extorsion (ransomware)', description: 'Chiffrer les données et exiger une rançon pour les restituer' },
  { nom: 'Fraude financière', description: 'Réaliser des virements frauduleux, détourner des fonds' },
]

describe('objectifs visés — description courte pré-remplie', () => {
  it('un OV ajouté depuis un exemple reprend sa description', () => {
    expect(nouvelObjectifVise('id1', EX[0])).toEqual({ id: 'id1', nom: 'Extorsion (ransomware)', description: 'Chiffrer les données et exiger une rançon pour les restituer', priorite: 'P2', pertinenceOV: 3 })
  })
  it('un OV vide reste vide', () => {
    expect(nouvelObjectifVise('id2')).toMatchObject({ nom: '', description: '' })
  })
  it('saisir le nom d’un OV connu pré-remplit la description si elle est vide (casse et espaces ignorés)', () => {
    const ov = { id: 'a', nom: '', description: '', priorite: 'P2', pertinenceOV: 3 }
    expect(majObjectifVise(ov, 'nom', '  fraude FINANCIÈRE ', EX).description).toBe('Réaliser des virements frauduleux, détourner des fonds')
  })
  it('ne remplace jamais une description déjà saisie ; nom inconnu = description inchangée', () => {
    const ov = { id: 'a', nom: 'x', description: 'Ma description', priorite: 'P2', pertinenceOV: 3 }
    expect(majObjectifVise(ov, 'nom', 'Fraude financière', EX).description).toBe('Ma description')
    expect(majObjectifVise({ ...ov, description: '' }, 'nom', 'Autre objectif', EX).description).toBe('')
  })
  it('les autres champs sont mis à jour tels quels', () => {
    const ov = { id: 'a', nom: 'x', description: '', priorite: 'P2', pertinenceOV: 3 }
    expect(majObjectifVise(ov, 'priorite', 'P1', EX)).toMatchObject({ priorite: 'P1', description: '' })
  })
})
