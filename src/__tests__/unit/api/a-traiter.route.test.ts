// @vitest-environment node
// Page « À traiter » : éléments de la personne connectée (moteur des relances en aperçu), libellés dans sa langue ;
// `?compte=1` pour le compteur du menu ; non connecté : 401.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), elements: vi.fn(), user: vi.fn(), declarations: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/relances.server', () => ({ elementsATraiter: m.elements }))
vi.mock('@/lib/declarations-a-traiter.server', () => ({ declarationsATraiter: m.declarations }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: m.user } } }))
import { GET } from '@/app/api/a-traiter/route'

const ITEMS = [
  { categorie: 'TEST_RESILIENCE', intitule: 'Test de bascule', type: 'EN_RETARD', echeance: '2026-10-01', organisationId: 'o1', organisation: 'Banque', lien: '/reglementaire/tests-resilience' },
  { categorie: 'PLAN_ANNUEL_A_VALIDER', intitule: 'Programme 2027 — 2027', type: 'EN_ATTENTE', echeance: '2026-10-05', organisationId: 'o1', organisation: 'Banque', lien: '/plans/p1' },
]
beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', email: 'rssi@x.fr' } })
  m.user.mockResolvedValue({ email: 'rssi@x.fr', locale: 'fr' })
  m.elements.mockResolvedValue(ITEMS)
  m.declarations.mockResolvedValue([])
})

describe('GET /api/a-traiter', () => {
  it('éléments de la personne connectée avec libellés de catégorie et d’état dans sa langue', async () => {
    const j = await (await GET(new NextRequest('http://x/api/a-traiter'))).json()
    expect(m.elements).toHaveBeenCalledWith('rssi@x.fr')
    expect(j.total).toBe(2)
    expect(j.items[0]).toMatchObject({ categorie: 'TEST_RESILIENCE', libelleCategorie: 'Test de résilience planifié', etat: 'en retard (échéance le 2026-10-01)', lien: '/reglementaire/tests-resilience' })
  })
  it('compteur seul (menu) : total et nombre en retard', async () => {
    const j = await (await GET(new NextRequest('http://x/api/a-traiter?compte=1'))).json()
    expect(j).toEqual({ total: 2, enRetard: 1 })
  })
  it('non connecté : 401', async () => {
    m.session.mockResolvedValue(null)
    expect((await GET(new NextRequest('http://x/api/a-traiter'))).status).toBe(401)
  })
  it('déclarations d’incident non soumises fusionnées (en retard en tête), comptées', async () => {
    m.declarations.mockResolvedValue([{ organisationId: 'o1', incidentId: 'i1', organisation: 'Banque', incident: 'Rançongiciel', statut: 'EN_RETARD', echeance: new Date('2026-10-10T10:00:00Z'), phaseCode: 'ALERTE_PRECOCE', regimeLabelKey: 'notifRegimes.NIS2.label', phaseLabelKey: 'notifRegimes.NIS2.phases.ALERTE_PRECOCE' }])
    const j = await (await GET(new NextRequest('http://x/api/a-traiter'))).json()
    expect(j.total).toBe(3); expect(j.enRetard).toBe(2)
    // Retards d'abord, puis par échéance (le test de résilience, échu le 1er, précède la déclaration échue le 10).
    expect(j.items.map((i: { categorie: string }) => i.categorie)).toEqual(['TEST_RESILIENCE', 'DECLARATION_INCIDENT', 'PLAN_ANNUEL_A_VALIDER'])
    const d = j.items[1]
    expect(d).toMatchObject({ type: 'EN_RETARD', lien: '/incidents', libelleCategorie: 'Déclaration d’incident à effectuer' })
    expect(d.intitule).toContain('Rançongiciel — NIS2')
    expect(d.intitule).toContain('Alerte précoce')
  })
})
