import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PertesEditor from '@/components/PertesEditor'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const typesPerte = [{ code: 'PERTE_DIRECTE', labelKey: 'incidents.typesPerte.PERTE_DIRECTE', actif: true }, { code: 'PENALITE', labelKey: 'incidents.typesPerte.PENALITE', actif: true }, { code: 'JOURS', label: 'Jours d’arrêt', actif: true, custom: true }, { code: 'PROVISION', labelKey: 'incidents.typesPerte.PROVISION', actif: false }]
const base = { deviseReference: 'EUR', taux: { USD: 0.5 } as Record<string, number>, typesPerte }

describe('PertesEditor', () => {
  it('ajoute une ligne de perte (type actif, devise de référence, statut estimé)', () => {
    const onChange = vi.fn()
    render(<PertesEditor pertes={[]} recups={[]} config={base} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une perte' }))
    expect(onChange).toHaveBeenCalledWith({ pertes: [{ type: 'PERTE_DIRECTE', montant: 0, devise: 'EUR', statut: 'ESTIME' }], recups: [] })
  })
  it('ne propose que les types actifs, y compris personnalisés', () => {
    render(<PertesEditor pertes={[{ type: 'PENALITE', montant: 10, devise: 'EUR', statut: 'ESTIME' }]} recups={[]} config={base} onChange={() => {}} />)
    const sel = screen.getByLabelText('Type — perte 1') as HTMLSelectElement
    expect([...sel.options].map(o => o.text)).toEqual(['Perte directe', 'Pénalité / amende', 'Jours d’arrêt'])
  })
  it('modifie un montant, retire une ligne, ajoute une récupération', () => {
    const onChange = vi.fn()
    render(<PertesEditor pertes={[{ type: 'PENALITE', montant: 10, devise: 'EUR', statut: 'ESTIME' }]} recups={[]} config={base} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Montant — perte 1'), { target: { value: '250.5' } })
    expect(onChange).toHaveBeenLastCalledWith({ pertes: [{ type: 'PENALITE', montant: 250.5, devise: 'EUR', statut: 'ESTIME' }], recups: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Retirer — perte 1' }))
    expect(onChange).toHaveBeenLastCalledWith({ pertes: [], recups: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une récupération' }))
    expect(onChange).toHaveBeenLastCalledWith({ pertes: [{ type: 'PENALITE', montant: 10, devise: 'EUR', statut: 'ESTIME' }], recups: [{ type: 'ASSURANCE', montant: 0, devise: 'EUR' }] })
  })
  it('affiche le brut, les récupérations et le net convertis, et signale une devise sans taux', () => {
    render(<PertesEditor pertes={[{ type: 'PERTE_DIRECTE', montant: 1000, devise: 'EUR', statut: 'ESTIME' }, { type: 'PENALITE', montant: 400, devise: 'USD', statut: 'ESTIME' }, { type: 'AUTRE', montant: 9, devise: 'CHF', statut: 'ESTIME' }]}
      recups={[{ type: 'ASSURANCE', montant: 300, devise: 'EUR' }]} config={base} onChange={() => {}} />)
    expect(screen.getByText(/CHF/)).toBeTruthy()
    expect(screen.getByTestId('pertes-net').textContent).toMatch(/900/)
  })
  it('lecture seule : aucun bouton d’édition', () => {
    render(<PertesEditor pertes={[{ type: 'PENALITE', montant: 10, devise: 'EUR', statut: 'ESTIME' }]} recups={[]} config={base} onChange={() => {}} readOnly />)
    expect(screen.queryByRole('button', { name: 'Ajouter une perte' })).toBeNull()
  })
})
