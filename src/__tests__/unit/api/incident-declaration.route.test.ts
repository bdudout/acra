/** GET/PUT /api/incidents/[id]/declaration : compléments de déclaration et fichiers JSON (DORA ITS 2025/302, autres régimes). */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn(), find: vi.fn(), update: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { incident: { findUnique: m.find, update: m.update } } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/incident-access.server', () => ({ loadIncidentInScope: m.load, peutQualifier: (role: string) => ['RISK_MANAGER', 'RSSI', 'ADMIN'].includes(role) }))
import { GET, PUT } from '@/app/api/incidents/[id]/declaration/route'

const params = { params: Promise.resolve({ id: 'i1' }) }
const get = (qs = '') => GET(new NextRequest(`http://x/api/incidents/i1/declaration${qs}`), params)
const put = (body: unknown) => PUT(new NextRequest('http://x/api/incidents/i1/declaration', { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), params)
const row = {
  id: 'i1', intitule: 'Rançongiciel sur le SI', description: 'Chiffrement des serveurs', dateSurvenance: new Date('2026-10-05T06:00:00Z'), dateDetection: new Date('2026-10-05T07:00:00Z'),
  doraClasseMajeurLe: new Date('2026-10-05T08:00:00Z'), doraCriteres: { clientsAffectes: 5000, serviceCritique: true }, montantBrut: 1_500_000, recuperations: null,
  clotureLe: null, clotureCommentaire: null, causeRacine: 'EXTERNE', causeDetail: null, typeEvenement: 'CYBER', statut: 'QUALIFIE',
  attributs: { significatif: true }, notifications: [], declaration: { '2.8': 'Prestataire X;LEI123;LEI;', '9.9': 'inconnu' }, organization: { nom: 'Banque Exemple' },
}

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.load.mockResolvedValue({ userId: 'u1', userRole: 'RSSI', secondeLigneActive: true, incident: { id: 'i1', organizationId: 'o1' },
    incidentsConfig: { deviseReference: 'EUR', regimes: [{ code: 'CRA_14', actif: true }, { code: 'NIS2', actif: true }] } })
  m.find.mockResolvedValue(row)
  m.update.mockResolvedValue({})
})

describe('GET declaration', () => {
  it('401 sans session ; 403 pour un rôle non habilité (aucune lecture de l’incident)', async () => {
    m.session.mockResolvedValue(null); expect((await get()).status).toBe(401)
    m.session.mockResolvedValue({ user: { id: 'u1' } })
    m.load.mockResolvedValue({ userRole: 'LECTEUR', secondeLigneActive: true, incident: { id: 'i1', organizationId: 'o1' }, incidentsConfig: {} })
    expect((await get('?regime=DORA&stage=INITIAL')).status).toBe(403); expect(m.find).not.toHaveBeenCalled()
  })
  it('sans paramètre : compléments saisis, nettoyés (champ inconnu retiré)', async () => {
    expect(await (await get()).json()).toEqual({ declaration: { '2.8': 'Prestataire X;LEI123;LEI;' } })
  })
  it('DORA initiale : JSON prérempli (organisation, critères, devise), compléments pris en compte, export journalisé', async () => {
    const res = await get('?regime=DORA&stage=INITIAL&download=1')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="dora-initial-i1.json"')
    const j = await res.json()
    expect(j.schema).toBe('acra.dora-incident-report/1'); expect(j.submissionType).toBe('initial_notification')
    expect(j.fields['1.5']).toBe('Banque Exemple'); expect(j.fields['1.15']).toBe('EUR'); expect(j.fields['2.1']).toBe('ACRA-i1')
    expect(j.fields['2.5']).toEqual(['clients_counterparts_transactions', 'critical_services_affected'])
    expect(j.fields['2.8']).toBe('Prestataire X;LEI123;LEI;'); expect(j.missing).not.toContain('2.8'); expect(j.missing).toContain('2.7')
    expect(m.audit.mock.calls[0][1].details).toMatchObject({ action: 'declaration-export', regime: 'DORA' })
  })
  it('étape DORA invalide : 400 ; régime ou phase inconnus : 400', async () => {
    expect((await get('?regime=DORA&stage=X')).status).toBe(400)
    expect((await get('?regime=NOPE&phase=X')).status).toBe(400)
    expect((await get('?regime=CRA_14&phase=X')).status).toBe(400)
  })
  it('autre régime (CRA) : JSON commun avec échéance calculée depuis la détection (alerte précoce 24 h) ; régime non activé inclus dans l’aperçu', async () => {
    const j = await (await get('?regime=CRA_14&phase=ALERTE_PRECOCE')).json()
    expect(j.schema).toBe('acra.incident-notification/1')
    expect(j.regime).toMatchObject({ code: 'CRA_14', phase: 'ALERTE_PRECOCE', deadline: '2026-10-06T07:00:00.000Z', submittedAt: null })
    expect(j.incident).toMatchObject({ reference: 'ACRA-i1', organisation: 'Banque Exemple' })
  })
})

describe('PUT declaration', () => {
  it('enregistre uniquement les champs ITS éditables (bornés) et journalise', async () => {
    const res = await put({ declaration: { '2.7': 'Détecté par la supervision', '2.2': 'interdit', '3.4': '1200', 'x': 'y' } })
    expect(res.status).toBe(200)
    expect(m.update.mock.calls[0][0].data.declaration).toEqual({ '2.7': 'Détecté par la supervision', '3.4': 1200 })
    expect(m.audit.mock.calls[0][1].details).toMatchObject({ action: 'declaration-update', champs: 2 })
  })
  it('refusé hors 2ᵉ ligne : aucune écriture', async () => {
    m.load.mockResolvedValue({ userRole: 'ANALYSTE', secondeLigneActive: true, incident: { id: 'i1', organizationId: 'o1' }, incidentsConfig: {} })
    expect((await put({ declaration: { '2.7': 'x' } })).status).toBe(403); expect(m.update).not.toHaveBeenCalled()
  })
})
