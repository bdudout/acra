// Encart « Risques proposés » du registre : compteur, liste avec origine et cotation suggérée, Valider / Écarter.
// Rien sans droit (403) ou sans proposition ; une réponse inattendue n'affiche rien.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PropositionsRisquesTic from '@/components/PropositionsRisquesTic'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

const prop = (cle: string, intitule: string) => ({
  cle, type: 'CONTRAT_SANS_SORTIE', famille: 'TIERS_TIC', processusId: null, params: {}, gravite: 4, vraisemblance: 2,
  origine: { type: 'CONTRAT_TIC', id: 'a1', libelle: 'CT-01 — PSP', lien: '/registre-tic' }, intitule, description: 'Description ' + intitule,
})
const LISTE = { propositions: [prop('CONTRAT_SANS_SORTIE:a1', 'Absence de stratégie de sortie — CT-01'), prop('CONTRAT_SANS_SORTIE:a2', 'Absence de stratégie de sortie — CT-02')] }

afterEach(() => { vi.unstubAllGlobals() })

describe('PropositionsRisquesTic', () => {
  it('lecture seule (peutTraiter=false) : liste visible, sans boutons Valider / Écarter', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ...JSON.parse(JSON.stringify(LISTE)), peutTraiter: false }) })))
    render(<PropositionsRisquesTic />)
    expect(await screen.findByText('2 risque(s) proposé(s)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Valider/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Écarter/ })).toBeNull()
  })
  it('compteur, origine liée, cotation ; Valider crée le risque et retire la proposition', async () => {
    const onValidee = vi.fn()
    const fetchMock = vi.fn(async (_u: string, init?: RequestInit) => ({ ok: true, status: init?.method === 'POST' ? 201 : 200, json: async () => (init?.method === 'POST' ? { id: 'r1' } : JSON.parse(JSON.stringify(LISTE))) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PropositionsRisquesTic onValidee={onValidee} />)
    expect(await screen.findByText('2 risque(s) proposé(s)')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'CT-01 — PSP' })[0]).toHaveAttribute('href', '/registre-tic')
    expect(screen.getAllByText(/Risque lié aux prestataires tiers de services TIC · Cotation suggérée : gravité 4 · vraisemblance 2/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Valider — Absence de stratégie de sortie — CT-01' }))
    await waitFor(() => expect(screen.getByText('1 risque(s) proposé(s)')).toBeInTheDocument())
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(post[0]).toBe('/api/risk-items/propositions-tic')
    expect(JSON.parse(String(post[1]!.body))).toEqual({ cle: 'CONTRAT_SANS_SORTIE:a1', action: 'VALIDER' })
    expect(onValidee).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Risque créé dans le registre.')
  })
  it('Écarter retire la proposition sans recharger le registre', async () => {
    const onValidee = vi.fn()
    const fetchMock = vi.fn(async (_u: string, init?: RequestInit) => ({ ok: true, status: 200, json: async () => (init?.method === 'POST' ? { cle: 'x' } : JSON.parse(JSON.stringify(LISTE))) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PropositionsRisquesTic onValidee={onValidee} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Écarter — Absence de stratégie de sortie — CT-02' }))
    await waitFor(() => expect(screen.queryByText('Absence de stratégie de sortie — CT-02')).not.toBeInTheDocument())
    expect(JSON.parse(String(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1]!.body))).toEqual({ cle: 'CONTRAT_SANS_SORTIE:a2', action: 'ECARTER' })
    expect(onValidee).not.toHaveBeenCalled()
  })
  it('échec de l’action : message d’erreur, proposition conservée', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: RequestInit) => (init?.method === 'POST' ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(LISTE)) })))
    render(<PropositionsRisquesTic />)
    fireEvent.click(await screen.findByRole('button', { name: 'Valider — Absence de stratégie de sortie — CT-01' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Action impossible. Réessayez.')
    expect(screen.getByText('2 risque(s) proposé(s)')).toBeInTheDocument()
  })
  it('sans droit (403), sans proposition ou réponse inattendue : rien n’est affiché', async () => {
    for (const rep of [{ ok: false, status: 403, json: async () => ({}) }, { ok: true, status: 200, json: async () => ({ propositions: [] }) }, { ok: true, status: 200, json: async () => ({ risks: [] }) }]) {
      const f = vi.fn(async () => rep)
      vi.stubGlobal('fetch', f)
      const { container, unmount } = render(<PropositionsRisquesTic />)
      await waitFor(() => expect(f).toHaveBeenCalled())
      await new Promise(r => setTimeout(r, 0))
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
  })
})

describe('PropositionsRisquesTic — lien profond', () => {
  it('avec #propositions-tic, ramène l’encart à l’écran une seule fois après chargement', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    window.location.hash = '#propositions-tic'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(LISTE)) })))
    render(<PropositionsRisquesTic />)
    await screen.findByText('2 risque(s) proposé(s)')
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Écarter — Absence de stratégie de sortie — CT-01' }))
    expect(scroll).toHaveBeenCalledTimes(1)
    window.location.hash = ''
  })
  it('sans ancre, ne défile pas', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    window.location.hash = ''
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(LISTE)) })))
    render(<PropositionsRisquesTic />)
    await screen.findByText('2 risque(s) proposé(s)')
    expect(scroll).not.toHaveBeenCalled()
  })
})
