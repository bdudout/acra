import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IncidentTypePicker from '@/components/IncidentTypePicker'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

describe('IncidentTypePicker', () => {
  it('liste cherchable : phishing trouvé par synonyme, filtre cyber / autres, choix = modèle prérempli sans fait inventé', () => {
    const onPick = vi.fn()
    render(<IncidentTypePicker onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choisir un incident type' }))
    const list = screen.getByRole('listbox', { name: 'Incidents types' })
    expect(within(list).getAllByRole('option').length).toBeGreaterThanOrEqual(26)
    fireEvent.change(screen.getByLabelText(/Rechercher un incident type/), { target: { value: 'hameçonnage' } })
    const found = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(found).toHaveLength(1); expect(found[0]).toHaveTextContent('Hameçonnage')
    fireEvent.click(within(found[0]).getByRole('button'))
    expect(onPick).toHaveBeenCalledTimes(1)
    const tpl = onPick.mock.calls[0][0]
    expect(tpl).toMatchObject({ catalogueKey: 'cyber.phishing', typeEvenement: 'CYBER', significatif: false })
    expect(tpl.description).toContain('À compléter')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument() // liste refermée après le choix
  })
  it('filtres : « Autres risques » exclut le cyber ; aucun résultat : message', () => {
    render(<IncidentTypePicker onPick={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choisir un incident type' }))
    fireEvent.click(screen.getByRole('button', { name: 'Autres risques' }))
    const opts = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(opts.some(o => /Rançongiciel/.test(o.textContent ?? ''))).toBe(false); expect(opts.some(o => /Panne majeure/.test(o.textContent ?? ''))).toBe(true)
    fireEvent.change(screen.getByLabelText(/Rechercher un incident type/), { target: { value: 'zzzzqq' } })
    expect(screen.getByText(/Aucun incident type/)).toBeInTheDocument()
  })
  it('type choisi affiché avec sa catégorie ; « Retirer » appelle onClear', () => {
    const onClear = vi.fn()
    render(<IncidentTypePicker selectedKey="cyber.ddos" onPick={vi.fn()} onClear={onClear} />)
    expect(screen.getByText(/Déni de service distribué/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retirer l’incident type' })); expect(onClear).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Changer d’incident type' })).toBeInTheDocument()
  })
})
