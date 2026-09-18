import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConformiteGrid from '@/components/ConformiteGrid'
import { fr } from '@/lib/i18n/fr'
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ t: fr, locale: 'fr' }) }))
it('une exclusion annulée ne change rien ; une justification est sauvegardée avec NA', () => {
 const onChange = vi.fn()
 const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce(null).mockReturnValueOnce('Hors périmètre métier')
 render(<ConformiteGrid controles={[{ ref: '5.1', nom: 'Politique', description: '', categorie: '', type: 'ORGANISATIONNELLE' } as never]} entries={[]} onChange={onChange} />)
 const button = screen.getByRole('button', { name: fr.conformite.statuts.na })
 fireEvent.click(button)
 expect(onChange).not.toHaveBeenCalled()
 fireEvent.click(button)
 expect(onChange).toHaveBeenCalledWith([{ ref: '5.1', statut: 'na', commentaire: 'Hors périmètre métier' }])
 prompt.mockRestore()
})
