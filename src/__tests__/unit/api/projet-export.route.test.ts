// @vitest-environment node
/** Export PowerPoint d'un projet 360 : accès selon le projet (404 sinon), fichier PPTX en pièce jointe. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ session: vi.fn(), charger: vi.fn(), render: vi.fn(async () => Buffer.from('PK-pptx')) }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/projet-vue.server', () => ({ chargerVueProjet: m.charger }))
vi.mock('@/lib/projet-pptx', async () => ({ ...(await vi.importActual<object>('@/lib/projet-pptx')), renderProjetPptx: m.render }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))

import { GET } from '@/app/api/projets/[id]/export/route'

const req = (qs = '') => ({ nextUrl: new URL(`http://x/api/projets/p/export${qs}`), headers: new Headers() }) as never
const params = { params: Promise.resolve({ id: 'p' }) }
const ind = { plans: { total: 0, faits: 0, enCours: 0, aFaire: 0, avancement: null, enRetard: 0, echeanceProche: 0, sansPorteur: 0, sansEcheance: 0 }, risquesATraiterSansPlan: 0, reductionPct: null, residuelsHorsAppetit: 0, miseEnService: null }
beforeEach(() => { vi.clearAllMocks(); m.session.mockResolvedValue({ user: { id: 'u', role: 'ANALYSTE' } }) })

describe('GET /api/projets/[id]/export', () => {
  it('401 sans session ; 404 si le projet n’est pas accessible', async () => {
    m.session.mockResolvedValueOnce(null)
    expect((await GET(req(), params)).status).toBe(401)
    m.charger.mockResolvedValueOnce(null)
    expect((await GET(req(), params)).status).toBe(404)
    expect(m.charger).toHaveBeenCalledWith('p', 'u', 'ANALYSTE', 'fr')
  })
  it('PPTX dans la langue demandée, en pièce jointe au nom du projet', async () => {
    m.charger.mockResolvedValueOnce({ vue: { nom: 'Migration / paie', statut: 'EN_COURS', secteur: null, patterns: [], perimetre: null, objectifs: null, analyses: [], miseEnService: null, synthese: { total: 0, aTraiter: 0, acceptables: 0, paliers: [], principaux: [] }, indicateurs: ind }, plans: [], parDomaine: [] })
    const r = await GET(req('?lang=en'), params)
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    expect(r.headers.get('Content-Disposition')).toBe('attachment; filename="acra-projet-migration-paie.pptx"')
    expect(m.charger).toHaveBeenCalledWith('p', 'u', 'ANALYSTE', 'en')
    expect((m.render.mock.calls[0] as unknown[])[1]).toMatchObject({ titre: 'Project review — risks and action plans' })
  })
})
