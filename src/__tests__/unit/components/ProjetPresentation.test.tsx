import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjetPresentation from '@/components/projet360/ProjetPresentation'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('@/components/AccessPanel', () => ({ default: (p: { statut: string; canSubmit: boolean }) => <div data-testid="access">{p.statut}·{String(p.canSubmit)}</div> }))
vi.mock('@/components/ResidualRisksPanel', () => ({ default: (p: { statut: string }) => <div data-testid="residuels">{p.statut}</div> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
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
  matrice: [
    { id: 'r1', nom: 'Fuite de données de paie', domaine: 'CYBER', brut: { g: 4, v: 4 }, actuel: { g: 4, v: 3 }, residuel: { g: 2, v: 2 } },
    { id: 'r2', nom: 'Dérive du planning', domaine: 'PROJECT', brut: { g: 2, v: 2 }, actuel: { g: 2, v: 2 }, residuel: { g: 2, v: 2 } },
  ],
  scale: null,
  indicateurs: {
    plans: { total: 8, faits: 2, enCours: 2, aFaire: 4, avancement: 25, enRetard: 1, echeanceProche: 3, sansPorteur: 5, sansEcheance: 4 },
    risquesATraiterSansPlan: 2, reductionPct: 41, residuelsHorsAppetit: 1,
    miseEnService: { joursRestants: 20, plansApres: 1 },
  },
  miseEnService: '2026-10-26',
  cyberLies: [{ id: 'c1', nom: 'Cyber — paie', aImporter: 2, exemples: ['Rançongiciel sur la paie'] }],
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
    expect(within(screen.getByRole('region', { name: 'Principaux risques (niveau actuel)' })).getByText('Fuite de données de paie')).toBeTruthy()
    // Indicateurs du projet, notamment sur les plans d'action.
    const ind = screen.getByRole('region', { name: 'Indicateurs du projet' })
    expect(within(ind).getByText('25 %')).toBeTruthy()
    expect(within(ind).getByText('2 terminé(s) sur 8')).toBeTruthy()
    expect(within(ind).getByText('Plans sans porteur').parentElement!.textContent).toMatch(/5/)
    expect(within(ind).getByText('Risques à traiter sans plan').parentElement!.textContent).toMatch(/2/)
    expect(within(ind).getByText('-41 %')).toBeTruthy()
    // Matrice brut / actuel / résiduel avec filtre par catégorie.
    const mat = screen.getByRole('region', { name: 'Matrice des risques' })
    expect(within(mat).getByRole('tab', { name: 'Actuel' })).toBeTruthy()
    expect(within(mat).getByRole('button', { name: 'Projet (1)' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Cyber — paie' })[0].getAttribute('href')).toBe('/analyses/c1')
  })
  it('mise en service, validation, analyses cyber liées, export PowerPoint', () => {
    render(<ProjetPresentation projet={base} canEdit canCreateCyber validation={{
      access: { analyseId: 'p1', statut: 'EN_COURS', ownerId: 'u', currentUserId: 'u', currentUserRole: 'ANALYSTE', canManage: true, canSubmit: true, canApprove: false } as never,
      residuels: { analyseId: 'p1', statut: 'EN_ATTENTE', le: null, commentaire: null, canAct: false, locale: 'fr' } as never,
    }} />)
    // Date de mise en service (modifiable), jours restants, plans prévus après elle.
    expect((screen.getByLabelText('Date de mise en service') as HTMLInputElement).value).toBe('2026-10-26')
    expect(screen.getByText('J-20')).toBeTruthy()
    expect(screen.getByText('1 plan(s) prévu(s) après la mise en service')).toBeTruthy()
    // Validation du projet (soumission / approbation) et acceptation des résiduels, sur la page du projet.
    const val = screen.getByRole('region', { name: 'Validation du projet' })
    expect(within(val).getByTestId('access').textContent).toBe('EN_COURS·true')
    expect(within(val).getByTestId('residuels')).toBeTruthy()
    // Analyses cyber liées : risques à traiter pas encore importés, avec accès à l'import.
    const lies = screen.getByRole('region', { name: 'Analyses cyber liées' })
    expect(within(lies).getByText('2 risque(s) à traiter non importé(s)')).toBeTruthy()
    expect(within(lies).getByText(/Rançongiciel sur la paie/)).toBeTruthy()
    expect(within(lies).getByRole('link', { name: 'Importer dans le projet' }).getAttribute('href')).toBe('/analyses/p1/atelier/1?phase=qualification')
    expect(screen.getByRole('link', { name: /Exporter \(PowerPoint\)/ }).getAttribute('href')).toBe('/api/projets/p1/export?lang=fr')
  })
  it('lecture seule : date affichée sans champ', () => {
    render(<ProjetPresentation projet={base} canEdit={false} canCreateCyber={false} />)
    expect(screen.queryByLabelText('Date de mise en service')).toBeNull()
    expect(screen.getByText(/26\/10\/2026/)).toBeTruthy()
  })
  it('lecture seule : pas de bouton Modifier ; projet sans risque : message', () => {
    render(<ProjetPresentation projet={{ ...base, synthese: { ...base.synthese, total: 0, principaux: [], paliers: [] } }} canEdit={false} canCreateCyber={false} />)
    expect(screen.queryByRole('link', { name: 'Modifier le projet' })).toBeNull()
    expect(screen.getByText(/Aucun risque pour l’instant/)).toBeTruthy()
  })
})
