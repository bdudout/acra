import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import PlansActionsView, { type SerializedActionItem } from '@/components/PlansActionsView'
import { lireFiltresActions, listerActionsPage, TRIS_ACTIONS } from '@/lib/action-items-liste'
import { lirePagination } from '@/lib/pagination'
import type { ActionItem } from '@/lib/action-items'
import type { EntiteRef } from '@/lib/entites'

// Liste paginée côté serveur (lot V1) : l'URL est un petit magasin observable (router.replace la modifie et
// re-rend), et le « serveur » (fetch /api/actions) applique la vraie logique pure de la route sur les données du test.
const nav = vi.hoisted(() => {
  let params = new URLSearchParams()
  const abonnes = new Set<() => void>()
  return {
    get: () => params,
    set: (q: string) => { params = new URLSearchParams(q); abonnes.forEach(f => f()) },
    abonnes,
    replace: vi.fn(),
  }
})
vi.mock('next/navigation', async () => {
  const React = await import('react')
  return {
    useSearchParams: () => React.useSyncExternalStore(cb => { nav.abonnes.add(cb); return () => { nav.abonnes.delete(cb) } }, nav.get),
    useRouter: () => ({ replace: (url: string, o?: unknown) => { nav.replace(url, o); nav.set(url.split('?')[1] ?? '') }, refresh: vi.fn(), push: vi.fn() }),
    usePathname: () => '/actions',
  }
})
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    locale: 'fr',
    t: {
      entites: { filtre: { label: 'Entité', toutes: 'Toutes les entités', sousEntites: 'avec les sous-entités' } },
      pagination: { navigation: 'Pagination', resultats: '{debut} à {fin} sur {total}', parPage: 'Par page', precedente: 'Précédente', suivante: 'Suivante', page: 'Page {page} sur {pages}' },
      table: { sortAsc: 'A→Z', sortDesc: 'Z→A', sortNone: 'Sans tri', filterTitle: 'Filtrer', search: 'Rechercher', selectAll: 'Tout', selectNone: 'Aucun', onlyThis: 'Uniquement', clear: 'Effacer', menu: 'Trier et filtrer' },
      plansActions: {
        title: 'Plans d\'action', subtitle: 'sous-titre',
        kpiTotal: 'Actions', kpiRetard: 'En retard', kpiAvancement: 'Avancement',
        filterSource: 'Source', filterOrigine: 'Origine', filterPriorite: 'Priorité', filterStatut: 'Statut', filterPorteur: 'Porteur',
        filterAll: 'Toutes', searchPh: 'Rechercher', clear: 'Effacer',
        resultCount: '{n}/{total}', empty: 'Aucune action.',
        colTitre: 'Action', colSource: 'Source', colOrigine: 'Origine', colPorteur: 'Porteur', colPriorite: 'Priorité',
        colStatut: 'Statut', colEcheance: 'Échéance', open: 'Ouvrir', voir: 'Voir', sansEcheance: '—', sansPorteur: 'Non attribué',
        sources: { MESURE: 'Mesure', RISK_ACTION: 'Registre', CONFORMITE: 'Conformité', AUDIT: 'Audit', CONTROLE: 'Contrôle', INCIDENT: 'Incident' },
        origines: { risque: 'Risque', conformite: 'Conformité', controle: 'Contrôle', audit: 'Audit', regulateur: 'Régulateur', incident: 'Incident', resilience: 'Résilience', preconisation: 'Préconisation', orpheline: 'Orpheline' },
        orphanAlert: '{n} orpheline(s)', save: 'Enregistrer',
        priorites: { CRITIQUE: 'Critique', MAJEUR: 'Majeur', MODERE: 'Modéré' },
        statuts: { A_FAIRE: 'À faire', EN_COURS: 'En cours', FAIT: 'Fait', EN_RETARD: 'En retard' },
      },
    },
  }),
}))

const mk = (p: Partial<SerializedActionItem>): SerializedActionItem => ({
  id: p.id ?? 'x', source: p.source ?? 'MESURE', origine: p.origine ?? 'risque', sourceId: p.sourceId ?? 'x', entiteId: p.entiteId ?? null,
  titre: p.titre ?? 't', description: p.description ?? null, porteur: p.porteur ?? null,
  entite: p.entite ?? null, echeance: p.echeance ?? null, statut: p.statut ?? 'A_FAIRE',
  priorite: p.priorite ?? 'MAJEUR', lien: p.lien === undefined ? '/x' : p.lien, riskItemId: p.riskItemId ?? null, ...(p.lecture ? { lecture: true } : {}),
})

const items: SerializedActionItem[] = [
  mk({ id: '1', source: 'MESURE', origine: 'risque', titre: 'Chiffrer les sauvegardes', priorite: 'CRITIQUE', statut: 'A_FAIRE', porteur: 'DSI' }),
  mk({ id: '2', source: 'AUDIT', origine: 'audit', titre: 'Revue trimestrielle', priorite: 'MODERE', statut: 'FAIT', porteur: 'Audit' }),
  mk({ id: '3', source: 'INCIDENT', origine: 'incident', titre: 'Fuite de données', priorite: 'MAJEUR', statut: 'A_FAIRE', porteur: 'RSSI', echeance: '2020-01-01T00:00:00.000Z' }),
]

let donnees: SerializedActionItem[] = items
let entitesServeur: EntiteRef[] = []
let fetchMock: ReturnType<typeof vi.fn>
const hydrate = (l: SerializedActionItem[]): ActionItem[] => l.map(i => ({ ...i, echeance: i.echeance ? new Date(i.echeance) : null }))
const serveur = (url: string) => {
  const sp = new URLSearchParams(url.split('?')[1] ?? '')
  const pg = lirePagination(sp, { tris: TRIS_ACTIONS, triDefaut: 'defaut' })!
  const f = lireFiltresActions(sp)
  f.filtre.q = pg.q || undefined
  return listerActionsPage(hydrate(donnees), f, pg, entitesServeur, new Date())
}
const appelsActions = () => fetchMock.mock.calls.map(c => String(c[0])).filter(u => u.startsWith('/api/actions'))
const rendre = (props: { orgId?: string } = {}, url = '', d: SerializedActionItem[] = items) => {
  donnees = d
  nav.set(url)
  return render(<PlansActionsView {...props} />)
}

beforeEach(() => {
  nav.replace.mockClear()
  entitesServeur = []
  fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
    if (opts?.method === 'PATCH') return { ok: true, json: async () => ({}) }
    if (url.startsWith('/api/actions')) return { ok: true, json: async () => JSON.parse(JSON.stringify(serveur(url))) }
    if (url === '/api/referentiel-entites') return { ok: true, json: async () => ({ entites: entitesServeur }) }
    return { ok: true, json: async () => ({}) }
  })
  vi.stubGlobal('fetch', fetchMock)
})

const pret = () => screen.findAllByText('Chiffrer les sauvegardes')

describe('PlansActionsView', () => {
  it('affiche les actions de la page et les KPI (total/retard/avancement) calculés par le serveur', async () => {
    rendre()
    expect(await pret()).toHaveLength(2)
    expect(screen.getAllByText('Revue trimestrielle')).toHaveLength(2)
    expect(screen.getAllByText('Fuite de données')).toHaveLength(2)
    // 1 fait / 3 → 33 % ; 1 en retard (échéance 2020 + non fait)
    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(appelsActions()[0]).toBe('/api/actions?page=1')
    expect(screen.getByText('1 à 3 sur 3')).toBeInTheDocument() // barre de pagination
  })

  it('propose des cartes dédiées aux petits écrans', async () => {
    rendre()
    await pret()
    expect(screen.getByTestId('actions-mobile-list')).toHaveClass('md:hidden')
    expect(screen.getByTestId('actions-desktop-table')).toHaveClass('hidden')
  })

  it('filtre par origine (typologie) côté serveur, état dans l\'URL', async () => {
    rendre()
    await pret()
    fireEvent.change(screen.getByLabelText('Origine'), { target: { value: 'risque' } })
    expect(nav.replace).toHaveBeenLastCalledWith('/actions?origine=risque', { scroll: false })
    await waitFor(() => expect(screen.queryAllByText('Revue trimestrielle')).toHaveLength(0))
    expect(screen.getAllByText('Chiffrer les sauvegardes')).toHaveLength(2)
    expect(appelsActions().at(-1)).toBe('/api/actions?origine=risque&page=1')
  })

  it('filtre par statut effectif EN_RETARD', async () => {
    rendre()
    await pret()
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'EN_RETARD' } })
    await waitFor(() => expect(screen.queryAllByText('Chiffrer les sauvegardes')).toHaveLength(0))
    expect(screen.getAllByText('Fuite de données')).toHaveLength(2)
  })

  it('deep-links historiques : ?priorite=1 → Critique, ?filtre=retard → en retard', async () => {
    rendre({}, 'priorite=1')
    expect(await pret()).toHaveLength(2)
    expect(screen.queryAllByText('Revue trimestrielle')).toHaveLength(0)
    expect((screen.getByLabelText('Priorité') as HTMLSelectElement).value).toBe('CRITIQUE')
  })

  it('recherche texte sur le titre (envoyée au serveur après une pause)', async () => {
    rendre()
    await pret()
    fireEvent.change(screen.getByPlaceholderText('Rechercher'), { target: { value: 'revue' } })
    await waitFor(() => expect(screen.queryAllByText('Chiffrer les sauvegardes')).toHaveLength(0))
    expect(screen.getAllByText('Revue trimestrielle')).toHaveLength(2)
    expect(appelsActions().at(-1)).toBe('/api/actions?q=revue&page=1')
  })

  it('affiche un message quand aucune action ne correspond', async () => {
    rendre()
    await pret()
    fireEvent.change(screen.getByLabelText('Porteur'), { target: { value: 'inexistant' } })
    await waitFor(() => expect(screen.getAllByText('Aucune action.')).toHaveLength(2))
  })

  it('trie les retards en tête', async () => {
    rendre()
    await pret()
    const rows = screen.getAllByRole('row').slice(1) // hors en-tête
    expect(within(rows[0]).getByText('Fuite de données')).toBeInTheDocument()
  })

  it('tri par colonne au clic sur l\'en-tête (porteur, asc) — tri serveur', async () => {
    rendre()
    await pret()
    // Porteurs : DSI / Audit / RSSI → asc alpha = Audit en tête
    fireEvent.click(screen.getByRole('button', { name: /Porteur/ }))
    expect(nav.replace).toHaveBeenLastCalledWith('/actions?tri=porteur&ordre=asc', { scroll: false })
    await waitFor(() => expect(within(screen.getAllByRole('row')[1]).getByText('Revue trimestrielle')).toBeInTheDocument()) // porteur Audit
  })

  it('filtre par colonne façon tableur : décocher une valeur retire les lignes (codes dans l\'URL)', async () => {
    rendre()
    await pret()
    // Ouvre le menu de la colonne Origine (2ᵉ colonne)
    fireEvent.click(screen.getAllByRole('button', { name: 'Trier et filtrer' })[1])
    // Valeurs distinctes triées : Audit(0), Incident(1), Risque(2) → décocher Risque
    const checks = screen.getAllByRole('checkbox')
    fireEvent.click(checks[2])
    expect(new URLSearchParams(nav.get()).get('col')).toBe(JSON.stringify({ origine: ['audit', 'incident'] }))
    await waitFor(() => expect(screen.queryAllByText('Chiffrer les sauvegardes')).toHaveLength(0)) // origine Risque
    expect(screen.getAllByText('Revue trimestrielle')).toHaveLength(2) // origine Audit
  })

  it('pagination : seule la page demandée est rendue ; changer de page passe par l\'URL', async () => {
    const beaucoup = Array.from({ length: 30 }, (_, i) => mk({ id: `n${i}`, titre: `Action ${String(i).padStart(2, '0')}`, priorite: 'MAJEUR' }))
    rendre({}, 'taille=25', beaucoup)
    expect(await screen.findAllByText('Action 00')).toHaveLength(2)
    expect(screen.queryAllByText('Action 29')).toHaveLength(0)
    expect(screen.getByText('1 à 25 sur 30')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Suivante' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/actions?taille=25&page=2', { scroll: false })
    expect(await screen.findAllByText('Action 29')).toHaveLength(2)
    expect(screen.queryAllByText('Action 00')).toHaveLength(0)
  })

  it('action orpheline : alerte + édition en place (PATCH plans-actions) puis rechargement de la page', async () => {
    const orphan = { ...mk({ id: 'PLAN_ACTION:p7', sourceId: 'p7', source: 'PLAN_ACTION', origine: 'orpheline', titre: 'Action isolée' }), lien: null }
    rendre({ orgId: 'o1' }, '', [orphan])
    // Bandeau d'alerte présent
    expect(await screen.findByText('1 orpheline(s)')).toBeInTheDocument()
    // Ouvre l'éditeur en place, modifie le titre, enregistre
    fireEvent.click(within(screen.getByTestId('actions-desktop-table')).getByRole('button', { name: /Modifier|Ouvrir|Edit/ }))
    const titre = within(screen.getByTestId('actions-desktop-table')).getByDisplayValue('Action isolée')
    fireEvent.change(titre, { target: { value: 'Action corrigée' } })
    const avant = appelsActions().length
    fireEvent.click(within(screen.getByTestId('actions-desktop-table')).getByText('Enregistrer'))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PATCH')).toBe(true))
    const [url, opts] = fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')!
    expect(url).toBe('/api/organizations/o1/plans-actions/p7')
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body).titre).toBe('Action corrigée')
    await waitFor(() => expect(appelsActions().length).toBeGreaterThan(avant)) // liste rechargée
  })
})

describe('PlansActionsView — filtre par entité (consolidation, lot E5)', () => {
  it('ne garde que les actions de l’entité choisie (lien ou texte identique), sous-entités comprises — côté serveur', async () => {
    const E = (id: string, nom: string, o = {}) => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })
    entitesServeur = [E('dsi', 'DSI'), E('ret', 'Réseaux', { parentId: 'dsi' })]
    rendre({}, '', [
      mk({ id: 'a', titre: 'Segmenter le réseau', entiteId: 'ret' }),
      mk({ id: 'b', titre: 'Revoir les habilitations', entite: 'dsi' }),
      mk({ id: 'c', titre: 'Former les acheteurs', entite: 'Achats' }),
    ])
    await screen.findAllByText('Former les acheteurs')
    fireEvent.change(await screen.findByLabelText('Entité'), { target: { value: 'dsi' } })
    expect(nav.replace).toHaveBeenLastCalledWith('/actions?entite=dsi', { scroll: false })
    await waitFor(() => expect(screen.queryAllByText('Former les acheteurs')).toHaveLength(0))
    const tableau = within(screen.getByTestId('actions-desktop-table'))
    expect(tableau.getByText('Segmenter le réseau')).toBeTruthy()
    expect(tableau.getByText('Revoir les habilitations')).toBeTruthy()
  })
  it('recette n° 22 : action en lecture seule → « Voir » ; sans lien accessible → ni « Ouvrir » ni « Voir »', async () => {
    rendre({}, '', [mk({ id: 'l1', titre: 'Lecture', lien: '/conformite', lecture: true }), mk({ id: 'l2', titre: 'Sans accès', source: 'CONFORMITE', origine: 'conformite', lien: null, lecture: true })])
    expect((await screen.findAllByText('Voir')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Ouvrir')).toBeNull()
  })
})
