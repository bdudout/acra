import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RecommandationSuivi from '@/components/RecommandationSuivi'
import MissionSuiviPanel from '@/components/MissionSuiviPanel'
import AuditPlanView from '@/components/AuditPlanView'

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const base = { id: 'c1', statut: 'EN_COURS', echeance: '2026-10-31T00:00:00.000Z', echeanceInitiale: null, reports: [] as unknown[], critere: null, cause: null, consequence: null }

describe('RecommandationSuivi', () => {
  it('l’audité déclare la réalisation ou demande un report (échéance + motif)', () => {
    const onAction = vi.fn()
    render(<RecommandationSuivi constat={base} canAudit={false} canFollow busy={false} onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer réalisée' }))
    expect(onAction).toHaveBeenCalledWith({ action: 'DECLARER_REALISE' })
    fireEvent.change(screen.getByLabelText('Nouvelle échéance'), { target: { value: '2026-12-31' } })
    fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'Dépendance projet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    expect(onAction).toHaveBeenLastCalledWith({ action: 'DEMANDER_REPORT', nouvelleEcheance: '2026-12-31', motif: 'Dépendance projet' })
    expect(screen.queryByRole('button', { name: 'Vérifier (clôture par l’audit)' })).toBeNull()
  })
  it('l’audit vérifie une recommandation réalisée (commentaire) ou la rouvre (motif)', () => {
    const onAction = vi.fn()
    render(<RecommandationSuivi constat={{ ...base, statut: 'RESOLU' }} canAudit canFollow busy={false} onAction={onAction} />)
    fireEvent.change(screen.getByLabelText('Commentaire de vérification'), { target: { value: 'Preuves contrôlées' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier (clôture par l’audit)' }))
    expect(onAction).toHaveBeenCalledWith({ action: 'VERIFIER', commentaire: 'Preuves contrôlées' })
    fireEvent.change(screen.getByLabelText('Motif de réouverture'), { target: { value: 'Preuve insuffisante' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rouvrir' }))
    expect(onAction).toHaveBeenLastCalledWith({ action: 'REOUVRIR', commentaire: 'Preuve insuffisante' })
  })
  it('reports listés avec statut ; l’audit approuve ou refuse une demande en attente ; échéance initiale visible', () => {
    const onAction = vi.fn()
    const reports = [{ ancienne: '2026-10-31T00:00:00.000Z', nouvelle: '2026-12-31T00:00:00.000Z', motif: 'Dépendance projet', demandePar: 'u2', demandeLe: '2026-09-20T00:00:00.000Z', statut: 'DEMANDE' }]
    render(<RecommandationSuivi constat={{ ...base, reports, echeanceInitiale: '2026-09-30T00:00:00.000Z' }} canAudit canFollow={false} busy={false} onAction={onAction} />)
    expect(screen.getByText('Dépendance projet')).toBeTruthy()
    expect(screen.getByText('Demandé')).toBeTruthy()
    expect(screen.getByText(/Échéance initiale/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approuver' }))
    expect(onAction).toHaveBeenCalledWith({ action: 'DECIDER_REPORT', index: 0, decision: 'APPROUVE' })
    fireEvent.click(screen.getByRole('button', { name: 'Refuser' }))
    expect(onAction).toHaveBeenLastCalledWith({ action: 'DECIDER_REPORT', index: 0, decision: 'REFUSE' })
  })
  it('constat structuré : critère, cause et conséquence affichés', () => {
    render(<RecommandationSuivi constat={{ ...base, critere: 'Politique d’accès §4', cause: 'Turn-over', consequence: 'Comptes orphelins' }} canAudit={false} canFollow={false} busy={false} onAction={() => {}} />)
    for (const x of ['Politique d’accès §4', 'Turn-over', 'Comptes orphelins']) expect(screen.getByText(x)).toBeTruthy()
  })
})

describe('MissionSuiviPanel', () => {
  it('libellés de notation personnalisés par l’organisation (liste et lecture)', () => {
    render(<MissionSuiviPanel mission={{ ...mission, notation: 2 }} canWrite={false} busy={false} onSave={() => {}} onIndependance={() => {}} libellesNotation={{ 2: 'Maîtrise partielle' }} />)
    expect(screen.getByText(/Maîtrise partielle/)).toBeInTheDocument()
  })
  const mission = { id: 'm1', notation: null as number | null, jalons: {} as Record<string, string>, independance: {} as Record<string, unknown> }
  it('enregistre notation et jalons', () => {
    const onSave = vi.fn()
    render(<MissionSuiviPanel mission={mission} canWrite busy={false} onSave={onSave} onIndependance={() => {}} />)
    fireEvent.change(screen.getByLabelText('Notation de la mission'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Lettre de mission'), { target: { value: '2026-01-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onSave).toHaveBeenCalledWith({ notation: 3, jalons: { lettreMission: '2026-01-05' } })
  })
  it('déclaration d’indépendance : un conflit exige un commentaire ; « non déclarée » signalé', () => {
    const onInd = vi.fn()
    render(<MissionSuiviPanel mission={mission} canWrite busy={false} onSave={() => {}} onIndependance={onInd} />)
    expect(screen.getByText(/Indépendance non déclarée/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Conflit d’intérêts déclaré'))
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer' }))
    expect(onInd).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Commentaire (obligatoire en cas de conflit)'), { target: { value: 'Ancien responsable' } })
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer' }))
    expect(onInd).toHaveBeenCalledWith({ conflit: true, commentaire: 'Ancien responsable' })
  })
  it('lecture seule sans droit d’écriture', () => {
    render(<MissionSuiviPanel mission={{ ...mission, notation: 2 }} canWrite={false} busy={false} onSave={() => {}} onIndependance={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
    expect(screen.getByText('À améliorer')).toBeTruthy()
  })
})

describe('AuditPlanView', () => {
  const fetchMock = vi.fn()
  const data = {
    active: true,
    univers: [{ id: 'u1', intitule: 'Paiements', type: 'PROCESSUS', risque: 4, cycleAns: null, processusId: null, commentaire: null, actif: true }],
    plan: {
      entrees: [{ universId: 'u1', derniere: '2025-03-01', cycleAns: 1, prochaine: '2026-03-01', statut: 'EN_RETARD', planifiee: null }],
      synthese: { total: 1, aJour: 0, aPlanifier: 0, planifie: 0, enRetard: 1, jamais: 0, couverturePct: 0 },
      parAnnee: [{ annee: 2026, universIds: ['u1'] }, { annee: 2027, universIds: [] }, { annee: 2028, universIds: [] }],
    },
  }
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => Promise.resolve({ ok: true, status: init?.method === 'POST' ? 201 : 200, json: async () => (init?.method === 'POST' ? { id: 'u2' } : { ...data, canWrite: true }) } as Response))
    vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('confirm', () => true)
  })
  it('affiche la couverture, les statuts et le plan par année ; ajout d’une entrée', async () => {
    render(<AuditPlanView />)
    expect(await screen.findByRole('heading', { name: 'Univers et plan d’audit' })).toBeTruthy()
    expect(screen.getAllByText('En retard').length).toBeGreaterThanOrEqual(2) // indicateur + statut de la ligne
    expect(screen.getByText('0 %')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une entrée' }))
    fireEvent.change(screen.getByLabelText('Intitulé'), { target: { value: 'Filiale Nord' } })
    fireEvent.change(screen.getByLabelText('Risque (1-4)'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0] === '/api/audit/univers' && c[1]?.method === 'POST')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1].body)
    expect(body).toMatchObject({ intitule: 'Filiale Nord', risque: 3, type: 'PROCESSUS' })
  })
})
