// Vue des dépendances des fonctions critiques ou importantes : synthèse, concentration, écarts libellés.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DependancesCritiques from '@/components/DependancesCritiques'
import { analyserDependances } from '@/lib/dependances-critiques'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
const u = (id: string) => ({ id, useCase: 'Paiement', tiersId: 't1', tiersNom: 'PSP', offre: 'Passerelle', criticite: 'CRITIQUE', couvert: id !== 'u2', evalue: true, exposeInternet: false, perimetrePci: true, avecSi: true, interconnexion: 'LIGNE_SPECIALISEE', hotes: ['api.psp.example'] })
const donnees = analyserDependances([
  { id: 'p1', nom: 'Paiements', criticiteDora: 'CRITIQUE', proprietaire: 'DP', rtoMinutes: 480, rpoMinutes: 15, toleranceImpactMinutes: 240, nbControles: 1, nbRisques: 2, nbIncidents12m: 0, usages: [u('u1')] },
  { id: 'p2', nom: 'Virements', criticiteDora: 'IMPORTANTE', proprietaire: 'DV', rtoMinutes: 60, rpoMinutes: 15, toleranceImpactMinutes: 240, nbControles: 1, nbRisques: 0, nbIncidents12m: 1, usages: [u('u2')] },
])

describe('DependancesCritiques', () => {
  it('synthèse, concentration et écarts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(donnees)) })))
    render(<DependancesCritiques />)
    expect(await screen.findByTestId('synthese-dependances')).toHaveTextContent('2 fonction(s) critique(s) ou importante(s) · 2 avec des écarts · 2 écart(s) majeur(s)')
    expect(screen.getByText('PSP soutient plusieurs fonctions : Paiements, Virements')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Écarts — Paiements' })).getByText('RTO au-delà de la tolérance')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Écarts — Virements' })).getByText('Service sans contrat — PSP')).toBeInTheDocument()
    expect(screen.getAllByText(/RTO 8 h · RPO 15 min · tolérance 4 h/)).toHaveLength(1)
  })
})
