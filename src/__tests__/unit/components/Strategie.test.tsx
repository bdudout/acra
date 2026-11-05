// Stratégie cyber / IT / résilience (lot S1b) : liste et création (identifiants internes), détail (axes, objectifs,
// rattachements), boîte de justification, cadre figé désactivé, boutons masqués pour AUDITEUR et LECTEUR, historique.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StrategiesListe from '@/components/strategie/StrategiesListe'
import StrategieDetail from '@/components/strategie/StrategieDetail'
import JustificationDialog from '@/components/strategie/JustificationDialog'
import StrategieHistorique from '@/components/strategie/StrategieHistorique'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
type Init = { method?: string; body?: string }
const appels = (url: string, method: string) => fetchMock.mock.calls.filter(([u, i]) => u === url && (i as Init | undefined)?.method === method)
const corps = (url: string, method: string) => JSON.parse(((appels(url, method).at(-1)?.[1]) as Init).body ?? '{}')
beforeEach(() => { fetchMock.mockReset(); push.mockReset(); vi.stubGlobal('fetch', fetchMock) })

const LISTE = { strategies: [
  { id: 's1', titre: 'Stratégie cyber 2027', type: 'CYBER', statut: 'VALIDEE', version: 2, periodeDebut: '2027-01-01T00:00:00.000Z', periodeFin: '2029-12-31T00:00:00.000Z', referenceInterne: 'CC-4102' },
] }

describe('StrategiesListe', () => {
  it('colonnes type, période, statut, version, référence ; lien vers le détail', async () => {
    fetchMock.mockResolvedValue(json(LISTE))
    render(<StrategiesListe role="RSSI" />)
    const lien = await screen.findByRole('link', { name: 'Stratégie cyber 2027' })
    expect(lien).toHaveAttribute('href', '/strategie/s1')
    const ligne = lien.closest('tr')!
    for (const txt of ['Cyber', '01/01/2027 – 31/12/2029', 'Validée', 'v2', 'CC-4102']) expect(within(ligne).getByText(txt)).toBeTruthy()
  })
  it('AUDITEUR : pas de bouton « Nouvelle stratégie »', async () => {
    fetchMock.mockResolvedValue(json(LISTE))
    render(<StrategiesListe role="AUDITEUR" />)
    await screen.findByRole('link', { name: 'Stratégie cyber 2027' })
    expect(screen.queryByRole('button', { name: /Nouvelle stratégie/ })).toBeNull()
  })
  it('création : identifiants (référence + couples éditables, 10 au maximum), erreur i18n, puis ouverture du détail', async () => {
    let reponse = json({ error: 'identifiants_invalides' }, 400)
    fetchMock.mockImplementation(async (_u: string, init?: Init) => (init?.method === 'POST' ? reponse : json({ strategies: [] })))
    render(<StrategiesListe role="RSSI" />)
    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle stratégie/ }))
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Stratégie IT' } })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'IT' } })
    fireEvent.change(screen.getByLabelText('Référence interne'), { target: { value: 'CC-1' } })
    const ajouter = screen.getByRole('button', { name: 'Ajouter un identifiant' })
    fireEvent.click(ajouter)
    fireEvent.change(screen.getByLabelText('Système 1'), { target: { value: 'SAP' } })
    fireEvent.change(screen.getByLabelText('Valeur 1'), { target: { value: '4102' } })
    for (let i = 0; i < 9; i++) fireEvent.click(ajouter)
    expect(ajouter).toBeDisabled()
    for (let i = 10; i >= 2; i--) fireEvent.click(screen.getByRole('button', { name: `Retirer l’identifiant ${i}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer la stratégie' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Identifiants internes invalides')
    expect(corps('/api/strategies', 'POST')).toMatchObject({ titre: 'Stratégie IT', type: 'IT', referenceInterne: 'CC-1', identifiantsExternes: [{ systeme: 'SAP', valeur: '4102' }] })
    reponse = json({ strategie: { id: 's9' } }, 201)
    fireEvent.click(screen.getByRole('button', { name: 'Créer la stratégie' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/strategie/s9'))
  })
})

const strategie = (statut: string, o: Record<string, unknown> = {}) => ({
  id: 's1', titre: 'Stratégie cyber 2027', type: 'CYBER', statut, version: 1, description: null, periodeDebut: null, periodeFin: null,
  referenceInterne: null, identifiantsExternes: null, valideeLe: statut === 'BROUILLON' ? null : '2027-01-10T09:00:00.000Z', valideeParNom: statut === 'BROUILLON' ? null : 'Alice Martin',
  axes: [{
    id: 'a1', ordre: 0, titre: 'Protéger', description: null, referenceRef: null,
    objectifs: [{ id: 'ob1', axeId: 'a1', titre: 'MFA généralisée', indicateur: 'Taux de comptes MFA', cible: '100 %', echeance: '2027-06-30T00:00:00.000Z', kriId: 'k1' }],
    rattachements: [{ id: 'r1', axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1', provenance: 'MANUEL' }],
  }],
  ...o,
})
const ACTIONS = { items: [
  { source: 'AUDIT', sourceId: 'c1', titre: 'Revue des accès', lien: '/audit/m1' },
  { source: 'CONTROLE', sourceId: 'k9', titre: 'Sauvegardes non testées', lien: '/controles/k9' },
] }
function api(statut: string, cadreFige = true, ecriture: (url: string, init: Init) => unknown = () => json({ ok: true }), o: Record<string, unknown> = {}) {
  fetchMock.mockImplementation(async (url: string, init?: Init) => {
    if (init?.method && init.method !== 'GET') return ecriture(url, init)
    if (url === '/api/strategies/s1') return json({ strategie: strategie(statut, o), cadreFige })
    if (url === '/api/actions') return json(ACTIONS)
    if (url === '/api/kri') return json({ kris: [{ id: 'k1', intitule: 'Comptes sans MFA' }] })
    return json({})
  })
}

describe('StrategieDetail', () => {
  it('BROUILLON (RSSI) : axes, objectifs (indicateur, cible, échéance, KRI), rattachements (lien, provenance) ; ajout d’axe sans justification', async () => {
    api('BROUILLON')
    render(<StrategieDetail id="s1" role="RSSI" />)
    expect(await screen.findByRole('heading', { name: 'Protéger' })).toBeTruthy()
    expect(screen.getByText('MFA généralisée')).toBeTruthy()
    expect(screen.getByText(/Taux de comptes MFA/)).toBeTruthy()
    expect(screen.getByText(/30\/06\/2027/)).toBeTruthy()
    expect(await screen.findByText(/Comptes sans MFA/)).toBeTruthy()
    expect(await screen.findByRole('link', { name: 'Revue des accès' })).toHaveAttribute('href', '/audit/m1')
    expect(screen.getByText(/Manuel/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Valider' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nouvelle version' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un axe' }))
    fireEvent.change(screen.getByLabelText('Titre de l’axe'), { target: { value: 'Détecter' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(appels('/api/strategies/s1/axes', 'POST')).toHaveLength(1))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(corps('/api/strategies/s1/axes', 'POST')).toEqual({ titre: 'Détecter', ordre: 1 })
  })

  it('VALIDEE, cadre figé : bandeau de validation, contrôles du cadre désactivés et expliqués ; rattachement justifié', async () => {
    api('VALIDEE', true)
    render(<StrategieDetail id="s1" role="RSSI" />)
    expect(await screen.findByText('Version validée le 10/01/2027 par Alice Martin.')).toBeTruthy()
    expect(screen.getByText(/créez une nouvelle version/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ajouter un axe' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Modifier Protéger' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ajouter un objectif' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Nouvelle version' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Archiver' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Valider' })).toBeNull()
    // Rattacher reste possible, avec justification.
    const choix = await screen.findByLabelText('Élément du plan d’action')
    fireEvent.change(choix, { target: { value: 'CONTROLE:k9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rattacher' }))
    const dialog = await screen.findByRole('dialog')
    const champ = within(dialog).getByLabelText('Justification (obligatoire)')
    expect(document.activeElement).toBe(champ)
    const confirmer = within(dialog).getByRole('button', { name: 'Confirmer' })
    expect(confirmer).toBeDisabled()
    fireEvent.change(champ, { target: { value: 'Constat du contrôle annuel' } })
    fireEvent.click(confirmer)
    await waitFor(() => expect(appels('/api/strategies/s1/rattachements', 'POST')).toHaveLength(1))
    expect(corps('/api/strategies/s1/rattachements', 'POST')).toEqual({ axeId: 'a1', sourceType: 'CONTROLE', sourceId: 'k9', justification: 'Constat du contrôle annuel' })
  })

  it('VALIDEE, cadre non figé : modifier un axe ouvre la boîte de justification ; erreur API affichée via i18n', async () => {
    api('VALIDEE', false, () => json({ error: 'axe_non_vide' }, 409))
    render(<StrategieDetail id="s1" role="RISK_MANAGER" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Protéger' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Justification (obligatoire)'), { target: { value: 'Axe fusionné' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cet axe contient des objectifs ou des éléments rattachés')
    expect(corps('/api/strategies/s1/axes/a1', 'DELETE')).toEqual({ justification: 'Axe fusionné' })
  })

  it('nouvelle version déjà en préparation : message i18n et lien vers elle', async () => {
    api('VALIDEE', true, () => json({ error: 'version_en_cours', strategieId: 's2' }, 409))
    render(<StrategieDetail id="s1" role="RSSI" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle version' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('déjà en préparation')
    expect(screen.getByRole('link', { name: 'Ouvrir la version en préparation' })).toHaveAttribute('href', '/strategie/s2')
  })

  it('validation d’une nouvelle version : éléments non reportés signalés', async () => {
    api('BROUILLON', true, () => json({ ok: true, rattachementsNonReportes: [{ axeTitre: 'Détecter', sourceType: 'AUDIT', sourceId: 'c3' }] }))
    render(<StrategieDetail id="s1" role="RSSI" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Valider' }))
    expect(await screen.findByText(/1 élément\(s\) rattaché\(s\) à la version précédente n’ont pas été reportés.*Détecter/)).toBeTruthy()
  })

  it.each(['AUDITEUR', 'LECTEUR'] as const)('%s : aucun bouton d’action ni de modification', async role => {
    api('VALIDEE', false)
    render(<StrategieDetail id="s1" role={role} />)
    await screen.findByRole('heading', { name: 'Protéger' })
    for (const nom of ['Valider', 'Archiver', 'Nouvelle version', 'Ajouter un axe', 'Ajouter un objectif', 'Rattacher', 'Modifier Protéger', 'Retirer Revue des accès']) {
      expect(screen.queryByRole('button', { name: nom })).toBeNull()
    }
    expect(screen.queryByLabelText('Élément du plan d’action')).toBeNull()
  })
})

describe('StrategieDetail — passe de correctifs S1b', () => {
  const deuxAxes = () => ({ axes: [
    { ...strategie('BROUILLON').axes[0], ordre: 0 },
    { id: 'a2', ordre: 1, titre: 'Détecter', description: null, referenceRef: null, objectifs: [], rattachements: [] },
  ] })
  it('BROUILLON : suppression d’un axe confirmée (objectifs et rattachements cités) avant le DELETE', async () => {
    api('BROUILLON')
    render(<StrategieDetail id="s1" role="RSSI" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Protéger' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Ses objectifs et ses éléments rattachés sont supprimés aussi/)).toBeTruthy()
    expect(appels('/api/strategies/s1/axes/a1', 'DELETE')).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(appels('/api/strategies/s1/axes/a1', 'DELETE')).toHaveLength(1))
    expect((appels('/api/strategies/s1/axes/a1', 'DELETE')[0][1] as Init).body).toBeUndefined()
  })
  it('ordre des axes : « Descendre » renumérote via le champ ordre ; désactivé si figé ; justifié si non figé', async () => {
    api('BROUILLON', true, () => json({ ok: true }), deuxAxes())
    const { unmount } = render(<StrategieDetail id="s1" role="RSSI" />)
    expect(await screen.findByRole('button', { name: 'Monter Protéger' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Descendre Protéger' }))
    await waitFor(() => expect(appels('/api/strategies/s1/axes/a2', 'PATCH')).toHaveLength(1))
    expect(corps('/api/strategies/s1/axes/a1', 'PATCH')).toEqual({ ordre: 1 })
    expect(corps('/api/strategies/s1/axes/a2', 'PATCH')).toEqual({ ordre: 0 })
    unmount(); fetchMock.mockReset()
    api('VALIDEE', true, () => json({ ok: true }), deuxAxes())
    const r2 = render(<StrategieDetail id="s1" role="RSSI" />)
    expect(await screen.findByRole('button', { name: 'Descendre Protéger' })).toBeDisabled()
    r2.unmount(); fetchMock.mockReset()
    api('VALIDEE', false, () => json({ ok: true }), deuxAxes())
    render(<StrategieDetail id="s1" role="RSSI" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Monter Détecter' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Justification (obligatoire)'), { target: { value: 'Priorité du comité' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(appels('/api/strategies/s1/axes/a1', 'PATCH')).toHaveLength(1))
    expect(corps('/api/strategies/s1/axes/a2', 'PATCH')).toEqual({ ordre: 0, justification: 'Priorité du comité' })
    expect(corps('/api/strategies/s1/axes/a1', 'PATCH')).toEqual({ ordre: 1, justification: 'Priorité du comité' })
  })
  it('identifiants internes d’un axe : modifiables même cadre figé, sans justification', async () => {
    api('VALIDEE', true)
    render(<StrategieDetail id="s1" role="RSSI" />)
    const bouton = (await screen.findAllByRole('button', { name: 'Identifiants internes (0)' }))[0]
    fireEvent.click(bouton)
    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    const zone = bouton.parentElement!
    fireEvent.change(within(zone).getByLabelText('Référence interne'), { target: { value: 'BUD-7' } })
    fireEvent.click(within(zone).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(appels('/api/strategies/s1/axes/a1', 'PATCH')).toHaveLength(1))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(corps('/api/strategies/s1/axes/a1', 'PATCH')).toEqual({ referenceInterne: 'BUD-7', identifiantsExternes: null })
  })
  it('onglets ARIA : tabpanel relié, flèche droite vers « Historique »', async () => {
    api('BROUILLON')
    render(<StrategieDetail id="s1" role="RSSI" />)
    const cadre = await screen.findByRole('tab', { name: 'Cadre' })
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', cadre.getAttribute('aria-controls'))
    fireEvent.keyDown(cadre, { key: 'ArrowRight' })
    const hist = screen.getByRole('tab', { name: 'Historique' })
    expect(hist).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(hist)
  })
  it('création : identifiants regroupés sous une légende', async () => {
    fetchMock.mockResolvedValue(json({ strategies: [] }))
    render(<StrategiesListe role="RSSI" />)
    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle stratégie/ }))
    expect(screen.getByRole('group', { name: 'Identifiants internes' })).toBeTruthy()
  })
})

describe('JustificationDialog', () => {
  it('rend le focus au déclencheur à la fermeture', () => {
    const { rerender } = render(<><button>Déclencheur</button></>)
    const btn = screen.getByRole('button', { name: 'Déclencheur' })
    btn.focus()
    rerender(<><button>Déclencheur</button><JustificationDialog onConfirm={vi.fn()} onCancel={vi.fn()} /></>)
    expect(document.activeElement).not.toBe(btn)
    rerender(<><button>Déclencheur</button></>)
    expect(document.activeElement).toBe(btn)
  })
  it('focus sur le champ, confirmation impossible à vide, Échap annule', () => {
    const onConfirm = vi.fn(), onCancel = vi.fn()
    render(<JustificationDialog onConfirm={onConfirm} onCancel={onCancel} />)
    const champ = screen.getByLabelText('Justification (obligatoire)')
    expect(document.activeElement).toBe(champ)
    const confirmer = screen.getByRole('button', { name: 'Confirmer' })
    fireEvent.change(champ, { target: { value: '   ' } })
    expect(confirmer).toBeDisabled()
    fireEvent.change(champ, { target: { value: ' Arbitrage du comité ' } })
    fireEvent.click(confirmer)
    expect(onConfirm).toHaveBeenCalledWith('Arbitrage du comité')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('StrategieHistorique', () => {
  it('évolutions lisibles (type, avant / après, justification, auteur, date) et écart du cadre', async () => {
    fetchMock.mockImplementation(async (url: string) => url === '/api/strategies/s1/historique' ? json({
      statut: 'VALIDEE', valideeLe: '2027-01-10T09:00:00.000Z',
      evolutions: [{ id: 'e1', type: 'AJOUT_RATTACHEMENT', avant: null, apres: { axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1', provenance: 'MANUEL' }, justification: 'Constat d’audit', auteurNom: 'Alice Martin', createdAt: '2027-02-03T10:00:00.000Z' }],
      ecart: { identique: false, axes: { ajoutes: [{ id: 'a2', titre: 'Répondre' }], modifies: [], supprimes: [] }, objectifs: { ajoutes: [], modifies: [], supprimes: [] } },
      rattachementsDepuisValidation: [{ id: 'r1' }],
    }) : json({}))
    render(<StrategieHistorique id="s1" axes={new Map([['a1', 'Protéger']])} elements={new Map([['AUDIT:c1', 'Revue des accès']])} />)
    const ligne = (await screen.findByText('Élément rattaché')).closest('tr')!
    expect(within(ligne).getByText('Axe : Protéger · Source : Recommandation d’audit · Élément : Revue des accès · Provenance : Manuel')).toBeTruthy()
    expect(within(ligne).getByText('Constat d’audit')).toBeTruthy()
    expect(within(ligne).getByText('Alice Martin')).toBeTruthy()
    expect(within(ligne).getByText(/03\/02\/2027/)).toBeTruthy()
    expect(screen.getByText('Axes ajoutés')).toBeTruthy()
    expect(screen.getByText('Répondre')).toBeTruthy()
    expect(screen.getByText('Éléments rattachés depuis la validation : 1')).toBeTruthy()
  })
})
