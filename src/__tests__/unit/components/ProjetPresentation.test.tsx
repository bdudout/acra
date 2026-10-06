import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjetPresentation from '@/components/projet360/ProjetPresentation'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => <a href={href} className={className}>{children}</a> }))
beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ plans: [] }) }))) })

const base = {
  id: 'p1', nom: 'Migration paie', statut: 'EN_COURS', secteur: 'Banque / Finance', patterns: ['CLOUD_IAAS_PAAS'],
  perimetre: 'Paie et RH', objectifs: 'Bascule sans perte', analyses: [{ id: 'c1', nom: 'Cyber — paie' }],
  synthese: {
    total: 3, aTraiter: 1, acceptables: 2,
    paliers: [{ label: 'Faible', couleur: '#22c55e', brut: 1, actuel: 1, residuel: 2 }, { label: 'Critique', couleur: '#ef4444', brut: 2, actuel: 1, residuel: 0 }],
    principaux: [{ id: 'r1', nom: 'Fuite de données de paie', niveau: 12, domaine: 'CYBER', palier: { label: 'Critique', couleur: '#ef4444', scoreMin: 12, scoreMax: 16 } }],
  },
  parDomaine: [{ domaine: 'CYBER', total: 2, aTraiter: 1 }],
  plans: { ouverts: 4, enRetard: 1 },
}

describe('ProjetPresentation', () => {
  it('description, indicateurs, répartition brut/actuel/résiduel, principaux risques, bouton Modifier', () => {
    render(<ProjetPresentation projet={base} canEdit canCreateCyber />)
    expect(screen.getByRole('heading', { name: 'Migration paie' })).toBeTruthy()
    expect(screen.getByText('Bascule sans perte')).toBeTruthy()
    expect(screen.getByText('Hébergement en nuage (IaaS / PaaS)')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Modifier le projet' }).getAttribute('href')).toBe('/analyses/p1/atelier/1?phase=contexte')
    const graphe = screen.getByRole('figure', { name: 'Répartition des risques par niveau' })
    expect(within(graphe).getByRole('img', { name: 'Critique — Brut : 2' })).toBeTruthy()
    expect(within(graphe).getByRole('img', { name: 'Faible — Résiduel : 2' })).toBeTruthy()
    expect(screen.getByText('Fuite de données de paie')).toBeTruthy()
    expect(screen.getByText('dont en retard 1')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Cyber — paie' }).getAttribute('href')).toBe('/analyses/c1')
  })
  it('lecture seule : pas de bouton Modifier ; projet sans risque : message', () => {
    render(<ProjetPresentation projet={{ ...base, synthese: { ...base.synthese, total: 0, principaux: [], paliers: [] } }} canEdit={false} canCreateCyber={false} />)
    expect(screen.queryByRole('link', { name: 'Modifier le projet' })).toBeNull()
    expect(screen.getByText(/Aucun risque pour l’instant/)).toBeTruthy()
  })
})
