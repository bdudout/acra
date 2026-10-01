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

it('constat du contrôle / de l’audit : affiché, et appliqué en un clic (non conforme + trace), jamais d’office', () => {
 const onChange = vi.fn()
 const constats = new Map([['5.1', { ref: '5.1', statut: 'ANOMALIE' as const, nbControles: 1, nbAnomaliesAudit: 0, divergent: true }]])
 render(<ConformiteGrid controles={[{ ref: '5.1', nom: 'Politique', description: '', categorie: '', type: 'ORGANISATIONNELLE' } as never]} entries={[{ ref: '5.1', statut: 'conforme' }]} onChange={onChange} constats={constats} />)
 expect(screen.getByTestId('constat-exigence').textContent).toContain(fr.conformiteConstats.divergent)
 expect(onChange).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: fr.conformiteConstats.appliquer }))
 const [next] = onChange.mock.calls[0]
 expect(next).toEqual([expect.objectContaining({ ref: '5.1', statut: 'non_conforme', commentaire: expect.stringContaining('contrôle permanent') })])
})
