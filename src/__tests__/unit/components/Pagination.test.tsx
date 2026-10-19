import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from '@/components/Pagination'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr }) }
})

describe('Pagination', () => {
  it('affiche la plage, le total et navigue ; bornes désactivées', () => {
    const onPage = vi.fn(); const onTaille = vi.fn()
    render(<Pagination pagination={{ page: 1, pages: 3, total: 120, taille: 50 }} onPage={onPage} onTaille={onTaille} />)
    expect(screen.getByText('1 à 50 sur 120')).toBeTruthy()
    expect(screen.getByText('Page 1 sur 3')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Précédente' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Suivante' }))
    expect(onPage).toHaveBeenCalledWith(2)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '100' } })
    expect(onTaille).toHaveBeenCalledWith(100)
  })
  it('rien sans métadonnées ; liste vide « 0 à 0 sur 0 »', () => {
    const { container } = render(<Pagination pagination={null} onPage={vi.fn()} onTaille={vi.fn()} />)
    expect(container.textContent).toBe('')
    render(<Pagination pagination={{ page: 1, pages: 1, total: 0, taille: 50 }} onPage={vi.fn()} onTaille={vi.fn()} />)
    expect(screen.getByText('0 à 0 sur 0')).toBeTruthy()
  })
})
