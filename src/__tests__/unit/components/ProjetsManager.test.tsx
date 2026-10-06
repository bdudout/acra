import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProjetsManager from '@/components/ProjetsManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const projets = [
  { id: 'p1', nom: 'Refonte portail', statut: 'EN_COURS', risques: 7, updatedAt: '2026-09-20T00:00:00.000Z', analyses: [{ id: 'c1', nom: 'Cyber — portail' }] },
  { id: 'p2', nom: 'Migration cloud', statut: 'APPROUVE', risques: 12, updatedAt: '2026-10-01T00:00:00.000Z' },
]
const noms = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[0].textContent)

describe('ProjetsManager — liste des projets 360', () => {
  it('liste les projets (plus récent d’abord) avec statut et nombre de risques', () => {
    render(<ProjetsManager projets={projets} canCreate />)
    expect(screen.getByRole('link', { name: 'Refonte portail' }).getAttribute('href')).toBe('/projets/p1')
    expect(screen.getByText('7')).toBeTruthy()
    expect(noms()).toEqual(['Migration cloud', 'Refonte portail'])
  })
  it('« Lancer un projet 360 » ouvre la page dédiée', () => {
    render(<ProjetsManager projets={projets} canCreate />)
    expect(screen.getByRole('link', { name: 'Lancer un projet 360' }).getAttribute('href')).toBe('/projets/nouveau')
  })
  it('recherche rapide, filtre par statut, tri par colonne', () => {
    render(<ProjetsManager projets={projets} canCreate />)
    fireEvent.change(screen.getByLabelText('Rechercher un projet'), { target: { value: 'portail' } })
    expect(noms()).toEqual(['Refonte portail'])
    fireEvent.change(screen.getByLabelText('Rechercher un projet'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'APPROUVE' } })
    expect(noms()).toEqual(['Migration cloud'])
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Trier par Risques' }))
    expect(noms()).toEqual(['Migration cloud', 'Refonte portail'])
    fireEvent.click(screen.getByRole('button', { name: 'Trier par Risques' }))
    expect(noms()).toEqual(['Refonte portail', 'Migration cloud'])
  })
  it('recherche sans résultat : message', () => {
    render(<ProjetsManager projets={projets} canCreate />)
    fireEvent.change(screen.getByLabelText('Rechercher un projet'), { target: { value: 'zzz' } })
    expect(screen.getByText('Aucun projet ne correspond à la recherche.')).toBeTruthy()
  })
  it('propose de lancer une analyse cyber depuis le projet et liste les analyses déjà rattachées', () => {
    render(<ProjetsManager projets={projets} canCreate />)
    expect(screen.getAllByRole('link', { name: 'Lancer une analyse cyber' })[0].getAttribute('href')).toMatch(/^\/analyses\/new\?projet=p/)
    expect(screen.getByRole('link', { name: 'Cyber — portail' }).getAttribute('href')).toBe('/analyses/c1')
  })
  it('export du portefeuille disponible ; sans droit de création : ni lancement ni analyse cyber', () => {
    render(<ProjetsManager projets={[]} canCreate={false} />)
    expect(screen.queryByRole('link', { name: 'Lancer un projet 360' })).toBeNull()
    expect(screen.getByText('Aucun projet pour le moment.')).toBeTruthy()
  })
})
