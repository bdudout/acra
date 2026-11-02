// Cockpit de pilotage GRC — services TIC : synthèse des usages (PCI, exposition, interconnexion), combinaisons à risque.
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PilotageGrc from '@/components/PilotageGrc'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/components/NouvelleAnalyseMenu', () => ({ default: () => null }))
vi.mock('@/components/ProjetsSuivi', () => ({ default: () => null }))
vi.mock('@/components/HeatmapGridHtml', () => ({ default: () => null }))

const vide = { total: 0, eleve: 0, moyen: 0, faible: 0, nonCote: 0 }
const actions = { total: 0, faits: 0, enCours: 0, aFaire: 0, enRetard: 0, tauxAvancement: 0 }
const rollup = (servicesTic?: object) => ({
  active: true, orgCount: 1, modules: { incidents: false, controles: false, audit: false, appetit: false, kri: false, reglementaire: true },
  consolide: { risques: vide, actions, ...(servicesTic ? { servicesTic } : {}) }, parOrg: [],
})
const ok = (b: unknown) => Promise.resolve({ ok: true, json: async () => b })
let donnees: unknown
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => (url.startsWith('/api/grc/rollup') ? ok(donnees) : ok({ taxonomie: [], processus: [], risks: [], entites: [] }))))
})

describe('PilotageGrc — services TIC', () => {
  it('affiche la synthèse et les combinaisons à risque', async () => {
    donnees = rollup({ total: 12, pci: 4, exposesInternet: 5, avecSi: 9, viaInternet: 3, viaLs: 6, pciExposes: 2, critiquesViaInternet: 1, nonQualifies: 3 })
    render(<PilotageGrc />)
    const section = await screen.findByRole('region', { name: 'Services TIC (usages)' })
    expect(within(section).getByText('PCI exposés sur Internet')).toBeInTheDocument()
    expect(within(section).getByText('Interconnectés par LS')).toBeInTheDocument()
    expect(within(section).getByText('(12)')).toBeInTheDocument()
  })
  it('aucun usage : pas de section', async () => {
    donnees = rollup({ total: 0, pci: 0, exposesInternet: 0, avecSi: 0, viaInternet: 0, viaLs: 0, pciExposes: 0, critiquesViaInternet: 0, nonQualifies: 0 })
    render(<PilotageGrc />)
    await screen.findAllByText(/./)
    expect(screen.queryByRole('region', { name: 'Services TIC (usages)' })).toBeNull()
  })
})
