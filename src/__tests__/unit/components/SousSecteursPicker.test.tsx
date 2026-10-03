import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SousSecteursPicker from '@/components/SousSecteursPicker'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const SANTE = 'Santé / Médico-social'

describe('SousSecteursPicker — plusieurs sous-secteurs, seulement ceux cohérents avec le secteur', () => {
  it('rien sans secteur', () => {
    const { container } = render(<SousSecteursPicker secteur="" value={[]} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('propose les sous-secteurs du secteur et, à part, les interconnexions ; jamais ceux d’un autre secteur', () => {
    render(<SousSecteursPicker secteur={SANTE} value={[]} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/Complémentaire santé/)).toBeInTheDocument()
    expect(screen.getByText(/Interconnexions entre SI/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Interconnexion avec un prestataire qui livre des données/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Banque de détail/)).toBeNull()
  })
  it('coche dans l’ordre (le premier est le principal), décoche, et bloque au-delà du plafond', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SousSecteursPicker secteur={SANTE} value={['sante-amc']} onChange={onChange} />)
    expect(screen.getByText('(principal)')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Interconnexion avec un prestataire qui livre des données/))
    expect(onChange).toHaveBeenLastCalledWith(['sante-amc', 'technique-interco-prestataire'])
    fireEvent.click(screen.getByLabelText(/Complémentaire santé/))
    expect(onChange).toHaveBeenLastCalledWith([])
    rerender(<SousSecteursPicker secteur={SANTE} value={['sante-amc', 'sante-amo', 'sante-portail', 'sante-esante']} onChange={onChange} />)
    expect(screen.getByLabelText(/Cabinet médical/)).toBeDisabled()
  })
  it('ignore une valeur incohérente reçue (changement de secteur)', () => {
    render(<SousSecteursPicker secteur={SANTE} value={['banque-detail', 'sante-amo']} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/Assurance maladie obligatoire/)).toBeChecked()
  })
})
