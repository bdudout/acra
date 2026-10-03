import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjetsPortefeuille from '@/components/ProjetsPortefeuille'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const cell = (count: number, max: number | null, ap: number) => ({ count, maxEffectif: max, auDessusAppetit: ap })
const vide = { count: 0, maxEffectif: null, auDessusAppetit: 0 }
const ligne = { id: 'p1', nom: 'Migration cloud', statut: 'EN_COURS', parDomaine: { CYBER: cell(2, 12, 1), IT: vide, PROJECT: vide, BUSINESS: vide, FRAUD: vide, OUTSOURCING: cell(1, 6, 0) }, nonClasses: 0, total: 3, auDessusAppetit: 1, maxEffectif: 12 }
const data = { appetit: 8, projets: [ligne], projetsTries: [ligne], totaux: {} }

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data }) as Response)) })

describe('ProjetsPortefeuille', () => {
  it('affiche la carte de chaleur domaine × projet, signale le dépassement d’appétit et propose l’export Excel', async () => {
    render(<ProjetsPortefeuille />)
    const table = await screen.findByRole('table', { name: /Portefeuille/ })
    expect(within(table).getByText('Migration cloud')).toBeInTheDocument()
    expect(within(table).getByText('Cyber')).toBeInTheDocument()
    expect(within(table).getByText('2 · 12')).toBeInTheDocument()
    expect(within(table).getByText('2 · 12').className).toMatch(/red/)       // au-dessus de l'appétit
    expect(within(table).getByText('1 · 6').className).not.toMatch(/red/)
    expect(screen.getByRole('link', { name: /Exporter \(Excel\)/ }).getAttribute('href')).toContain('/api/projets/portefeuille?format=xlsx')
  })
  it('rien à afficher sans projet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ appetit: null, projets: [], projetsTries: [], totaux: {} }) }) as Response))
    const { container } = render(<ProjetsPortefeuille />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container.querySelector('table')).toBeNull()
  })
})
