// Page « À traiter » — déclarations d'incident à effectuer : pour les organisations où la personne est RSSI ou gestionnaire
// des risques (administrateur seulement si l'organisation n'en a pas), phases non soumises à faire ou en retard (DORA pour
// un incident majeur, autres régimes activés), module Incidents actif ; mêmes destinataires que l'alerte urgente.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ memberships: vi.fn(), incidents: vi.fn(), cfg: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { orgMembership: { findMany: m.memberships }, incident: { findMany: m.incidents } } }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.cfg }))
import { declarationsATraiter } from '@/lib/declarations-a-traiter.server'

const now = new Date('2026-10-11T10:00:00Z')
const incident = (o: Record<string, unknown> = {}) => ({
  id: 'i1', organizationId: 'org1', intitule: 'Rançongiciel', dateDetection: new Date('2026-10-11T06:00:00Z'), doraCriteres: { serviceCritique: true, clientsAffectes: 100000, dureeIndispoMinutes: 600, reputation: true, geo: true, economique: true },
  doraClasseMajeurLe: new Date('2026-10-11T07:00:00Z'), doraInitialeSoumiseLe: null, doraIntermediaireSoumiseLe: null, doraFinaleSoumiseLe: null, alertesDora: {}, attributs: { significatif: true }, notifications: {},
  organization: { nom: 'Banque' }, ...o,
})
beforeEach(() => {
  vi.clearAllMocks()
  m.memberships.mockImplementation(async (a: { where: { userId?: string } }) => (a.where.userId ? [{ organizationId: 'org1', role: 'RSSI' }] : [{ role: 'RSSI' }]))
  m.cfg.mockResolvedValue({ incidentsActive: true, reglementaireActive: true, incidentsConfig: { regimes: [{ code: 'NIS2', actif: true }] } })
  m.incidents.mockResolvedValue([incident()])
})

describe('declarationsATraiter', () => {
  it('phases DORA et NIS2 non soumises de l’incident ; organisations de la personne seulement', async () => {
    const r = await declarationsATraiter('u1', now)
    expect(m.incidents.mock.calls[0][0].where.organizationId).toEqual({ in: ['org1'] })
    expect(r.some(x => x.phase === 'INITIALE' && x.organisationId === 'org1' && x.incident === 'Rançongiciel')).toBe(true)
    expect(r.some(x => x.regimeLabelKey === 'notifRegimes.NIS2.label' && x.phaseCode === 'ALERTE_PRECOCE')).toBe(true)
    expect(r.every(x => x.statut === 'A_FAIRE' || x.statut === 'EN_RETARD')).toBe(true)
  })
  it('phase déjà soumise : absente ; module Incidents inactif : rien', async () => {
    m.incidents.mockResolvedValue([incident({ doraInitialeSoumiseLe: new Date('2026-10-11T08:00:00Z') })])
    expect((await declarationsATraiter('u1', now)).some(x => x.phase === 'INITIALE')).toBe(false)
    m.cfg.mockResolvedValue({ incidentsActive: false, reglementaireActive: true, incidentsConfig: {} })
    expect(await declarationsATraiter('u1', now)).toEqual([])
  })
  it('administrateur d’une organisation qui a un RSSI : pas destinataire', async () => {
    m.memberships.mockImplementation(async (a: { where: { userId?: string } }) => (a.where.userId ? [{ organizationId: 'org1', role: 'ADMIN' }] : [{ role: 'RSSI' }]))
    expect(await declarationsATraiter('u1', now)).toEqual([])
    expect(m.incidents).not.toHaveBeenCalled()
  })
})
