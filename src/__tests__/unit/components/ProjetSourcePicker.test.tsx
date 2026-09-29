import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProjetSourcePicker from '@/components/ProjetSourcePicker'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const projets = [{ id: 'p1', nom: 'Refonte portail', description: 'Portail client' }, { id: 'p2', nom: 'Migration cloud', description: null }]

describe('ProjetSourcePicker', () => {
  it('n’affiche rien quand aucun projet n’est disponible (module inactif ou aucun projet)', () => {
    const { container } = render(<ProjetSourcePicker projets={[]} value="" onChange={() => {}} />)
    expect(container.textContent).toBe('')
  })
  it('liste les projets et notifie le choix, « Aucun projet » remet à vide', () => {
    const onChange = vi.fn()
    render(<ProjetSourcePicker projets={projets} value="" onChange={onChange} />)
    const sel = screen.getByLabelText(/Partir d’un projet 360/)
    fireEvent.change(sel, { target: { value: 'p2' } })
    expect(onChange).toHaveBeenCalledWith(projets[1])
    fireEvent.change(sel, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
