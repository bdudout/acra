import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ControleL3Fields, { type L3FormValue } from '@/components/ControleL3Fields'
import ConceptionPanel from '@/components/ConceptionPanel'
import ControleL3Badges from '@/components/ControleL3Badges'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const v0: L3FormValue = { typeControle: '', modeControle: 'MANUEL', cle: false, methodeEchantillon: '' }

describe('ControleL3Fields', () => {
  it('émet chaque modification (type, mode, clé, méthode)', () => {
    const onChange = vi.fn()
    render(<ControleL3Fields value={v0} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Type de contrôle'), { target: { value: 'PREVENTIF' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...v0, typeControle: 'PREVENTIF' })
    fireEvent.change(screen.getByLabelText('Mode d’exécution'), { target: { value: 'AUTOMATIQUE' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...v0, modeControle: 'AUTOMATIQUE' })
    fireEvent.click(screen.getByLabelText('Contrôle clé'))
    expect(onChange).toHaveBeenLastCalledWith({ ...v0, cle: true })
    fireEvent.change(screen.getByLabelText('Méthode d’échantillonnage'), { target: { value: 'STATISTIQUE' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...v0, methodeEchantillon: 'STATISTIQUE' })
  })
  it('propose une taille d’échantillon selon la population et la méthode, applicable en un clic', () => {
    const onChange = vi.fn(); const onSuggest = vi.fn()
    render(<ControleL3Fields value={{ ...v0, methodeEchantillon: 'STATISTIQUE' }} onChange={onChange} onApplySuggestion={onSuggest} />)
    fireEvent.change(screen.getByLabelText('Population contrôlée'), { target: { value: '200' } })
    const btn = screen.getByRole('button', { name: 'Taille suggérée : 25 (modifiable)' })
    fireEvent.click(btn)
    expect(onSuggest).toHaveBeenCalledWith(25)
  })
})

describe('ConceptionPanel', () => {
  it('évalue la conception avec un commentaire et enregistre', () => {
    const onSave = vi.fn()
    render(<ConceptionPanel conception={null} busy={false} canEdit onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Conception du contrôle'), { target: { value: 'A_AMELIORER' } })
    fireEvent.change(screen.getByLabelText('Commentaire de conception'), { target: { value: 'Couverture partielle' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onSave).toHaveBeenCalledWith({ statut: 'A_AMELIORER', commentaire: 'Couverture partielle' })
  })
  it('« Non évaluée » efface l’évaluation ; lecture seule sans droit', () => {
    const onSave = vi.fn()
    const { rerender } = render(<ConceptionPanel conception={{ statut: 'ADEQUATE', evalueLe: '2026-09-29T10:00:00.000Z' }} busy={false} canEdit onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Conception du contrôle'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onSave).toHaveBeenCalledWith(null)
    rerender(<ConceptionPanel conception={{ statut: 'ADEQUATE' }} busy={false} canEdit={false} onSave={onSave} />)
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
    expect(screen.getByText('Adéquate')).toBeTruthy()
  })
})

describe('ControleL3Badges', () => {
  it('affiche contrôle clé, automatique, flux interrompu, appréciation, récurrence et escalade', () => {
    render(<ControleL3Badges cle mode="AUTOMATIQUE" typeControle="DETECTIF" l3={{ appreciation: 'DEFAILLANT', fluxInterrompu: true, recurrence: { consecutives: 3, recurrente: true }, escalade: 'COMITE' }} />)
    for (const x of ['Contrôle clé', 'Automatique', 'Détectif', 'Flux interrompu', 'Défaillant', 'Anomalies récurrentes', 'Escalade au comité']) expect(screen.getByText(x)).toBeTruthy()
  })
  it('un contrôle simple n’affiche que le strict nécessaire', () => {
    const { container } = render(<ControleL3Badges cle={false} mode="MANUEL" typeControle={null} l3={{ appreciation: 'NON_EVALUE', fluxInterrompu: false, recurrence: { consecutives: 0, recurrente: false }, escalade: null }} />)
    expect(container.textContent).toBe('')
  })
})
