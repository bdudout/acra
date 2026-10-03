// Lot A1 — sélection des patterns d'architecture par cases à cocher.
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PatternsArchiPicker from '@/components/PatternsArchiPicker'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

describe('PatternsArchiPicker', () => {
  it('affiche les 24 patterns regroupés par famille, chacun avec son aide', () => {
    render(<PatternsArchiPicker value={[]} onChange={() => {}} max={12} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(24)
    expect(screen.getByText('Exposition et zones de sécurité')).toBeTruthy()
    expect(screen.getByText('Interconnexions, tiers et externalisation')).toBeTruthy()
    expect(screen.getByText(/Frontaux, reverse proxy, relais et filtrage/)).toBeTruthy()
  })
  it('cocher / décocher appelle onChange avec la liste (ordre de sélection)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<PatternsArchiPicker value={[]} onChange={onChange} max={12} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Zone démilitarisée/ }))
    expect(onChange).toHaveBeenLastCalledWith(['DMZ'])
    rerender(<PatternsArchiPicker value={['DMZ']} onChange={onChange} max={12} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Exposition sur Internet/ }))
    expect(onChange).toHaveBeenLastCalledWith(['DMZ', 'EXPOSITION_INTERNET'])
    fireEvent.click(screen.getByRole('checkbox', { name: /Zone démilitarisée/ }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })
  it('plafond : compteur, cases non cochées désactivées une fois atteint, message explicite', () => {
    render(<PatternsArchiPicker value={['DMZ', 'SI_TPE']} onChange={() => {}} max={2} />)
    expect(screen.getByText('2 sélectionné(s) sur 2')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: /Exposition sur Internet/ }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('checkbox', { name: /Zone démilitarisée/ }) as HTMLInputElement).disabled).toBe(false)
    expect(screen.getByText(/Maximum atteint/)).toBeTruthy()
  })
  it('lecture seule : aucune case modifiable', () => {
    render(<PatternsArchiPicker value={['DMZ']} onChange={() => {}} max={12} disabled />)
    for (const c of screen.getAllByRole('checkbox')) expect((c as HTMLInputElement).disabled).toBe(true)
  })
  it('un code inconnu dans la valeur est ignoré à l’affichage', () => {
    render(<PatternsArchiPicker value={['PIRATE', 'DMZ']} onChange={() => {}} max={12} />)
    expect(screen.getByText('1 sélectionné(s) sur 12')).toBeTruthy()
  })
  it('masque les patterns non pertinents sans cacher un pattern déjà porté par l’analyse', () => {
    const { rerender } = render(<PatternsArchiPicker value={[]} hiddenCodes={['DMZ']} onChange={() => {}} max={12} />)
    expect(screen.queryByRole('checkbox', { name: /Zone démilitarisée/ })).toBeNull()
    rerender(<PatternsArchiPicker value={['DMZ']} hiddenCodes={['DMZ']} onChange={() => {}} max={12} />)
    expect(screen.getByRole('checkbox', { name: /Zone démilitarisée/ })).toBeTruthy()
  })
})
