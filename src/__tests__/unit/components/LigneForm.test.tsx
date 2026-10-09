// Saisie d'une ligne de plan : la liste de cibles du prisme choisi est dépliée d'office (les autres restent repliées),
// pour qu'on ne valide pas une ligne sans cible en croyant en avoir coché ; une liste déjà renseignée reste dépliée.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LigneForm, { ligneVide, type Options } from '@/components/plans/LigneForm'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ exigences: [] }) })))

const options: Options = {
  organisations: [{ id: 'f1', nom: 'Filiale Nord' }], entites: [{ id: 'e1', nom: 'DSI' }], tiers: [{ id: 't1', nom: 'Hébergeur' }],
  risques: [{ id: 'r1', intitule: 'Fraude' }], processus: [{ id: 'p1', nom: 'Paie', criticite: 3, criticiteDora: null }], referentiels: [],
}
const ouverte = (debut: string) => (screen.getByText(new RegExp(`^${debut} —`)).closest('details') as HTMLDetailsElement).open
const rendre = (prisme: 'RISQUE' | 'PROCESSUS' | 'PERIMETRE', initial = ligneVide(prisme)) =>
  render(<LigneForm initial={initial} options={options} annee={2027} onSave={async () => null} onCancel={() => {}} />)

describe('LigneForm — liste du prisme dépliée', () => {
  it('prisme « Risques » : liste des risques dépliée, les autres repliées', () => {
    rendre('RISQUE')
    expect(ouverte('Risques')).toBe(true)
    expect(ouverte('Processus')).toBe(false)
    expect(ouverte('Filiales \\(organisations\\)')).toBe(false)
  })
  it('changement de prisme : la nouvelle liste se déplie', () => {
    rendre('RISQUE')
    fireEvent.change(screen.getByLabelText('Prisme'), { target: { value: 'PROCESSUS' } })
    expect(ouverte('Processus')).toBe(true)
  })
  it('prisme « Périmètres » : filiales, entités et tiers dépliés', () => {
    rendre('PERIMETRE')
    expect(ouverte('Filiales \\(organisations\\)')).toBe(true)
    expect(ouverte('Entités du référentiel')).toBe(true)
    expect(ouverte('Tiers')).toBe(true)
    expect(ouverte('Risques')).toBe(false)
  })
  it('une liste qui contient déjà des cibles reste dépliée (modification d’une ligne)', () => {
    const initial = ligneVide('RISQUE'); initial.cibles.processus = ['p1']
    rendre('RISQUE', initial)
    expect(ouverte('Processus')).toBe(true)
  })
})
