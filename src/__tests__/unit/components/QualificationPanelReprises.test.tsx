import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QualificationPanel from '@/components/QualificationPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ proposals: [] }) })))

describe('QualificationPanel — réponses reprises du projet 360', () => {
  it('déplié d’office, signale les réponses reprises à vérifier puis enregistrer', () => {
    render(<QualificationPanel analyseId="a" initial={{ expositionInternet: true, externalisation: true }} reprisesProjet={['expositionInternet', 'externalisation']} />)
    expect(screen.getByText('Réponses reprises de la qualification 360 du projet (2) : vérifiez-les puis enregistrez.')).toBeTruthy()
  })
})
