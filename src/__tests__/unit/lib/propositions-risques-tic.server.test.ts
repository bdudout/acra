// @vitest-environment node
// Isolation et concurrence des risques proposés (accès base) avec un faux prisma : chaque requête est bornée à
// l'organisation (where.organizationId), une clé d'une autre organisation n'entraîne ni création ni écart, et les
// courses (double validation, valider/écarter croisés) sont refusées proprement (409).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'

type Args = { where?: Record<string, unknown> & { organizationId?: unknown }; select?: Record<string, unknown>; data?: Record<string, unknown> }
const m = vi.hoisted(() => ({
  appels: [] as { modele: string; args: unknown }[],
  risquesExistants: [] as { sourceId: string }[],
  riskTx: null as null | { id: string },
  ecarteeTx: null as null | { id: string },
  create: vi.fn(), upsert: vi.fn(),
}))
// Données par organisation : seule orgA a un contrat critique sans stratégie de sortie ; orgB a le sien (b1).
const CONTRATS: Record<string, { id: string; reference: string; prestataireNom: string; criticite: string; strategieSortie: string | null }[]> = {
  orgA: [{ id: 'a1', reference: 'CT-A', prestataireNom: 'PSP', criticite: 'CRITIQUE', strategieSortie: null }],
  orgB: [{ id: 'b1', reference: 'CT-B', prestataireNom: 'Cloud', criticite: 'CRITIQUE', strategieSortie: null }],
}
vi.mock('@/lib/prisma', () => {
  const trace = (modele: string, impl: (a: Args) => unknown) => async (a: Args) => { m.appels.push({ modele, args: a }); return impl(a) }
  const org = (a: Args) => String(a.where?.organizationId ?? '')
  const p = {
    processus: { findMany: trace('processus.findMany', () => []) },
    testResilience: { findMany: trace('testResilience.findMany', () => []) },
    arrangementTic: { findMany: trace('arrangementTic.findMany', a => CONTRATS[org(a)] ?? []) },
    propositionRisqueEcartee: {
      findMany: trace('propositionRisqueEcartee.findMany', () => []),
      findUnique: trace('propositionRisqueEcartee.findUnique', () => m.ecarteeTx),
      upsert: trace('propositionRisqueEcartee.upsert', a => m.upsert(a)),
    },
    riskItem: {
      findMany: trace('riskItem.findMany', () => m.risquesExistants),
      findFirst: trace('riskItem.findFirst', () => m.riskTx),
      create: trace('riskItem.create', a => m.create(a)),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(p),
  }
  return { prisma: p }
})
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn() }))
vi.mock('@/lib/webhook.server', () => ({ emitWebhookEvent: vi.fn() }))

import { propositionsOuvertesOrg, validerPropositionTic, ecarterPropositionTic } from '@/lib/propositions-risques-tic.server'
import { chargerFonctionsCritiques } from '@/lib/dependances-critiques.server'

const acteur = (cle: string) => ({ orgId: 'orgA', cle, userId: 'u1', role: 'RSSI' as const })
/** Toute requête (et le filtre imbriqué des usages) porte organizationId = orgA ; transaction exclue. */
function toutBorneA() {
  expect(m.appels.length).toBeGreaterThan(0)
  for (const c of m.appels) {
    const a = c.args as Args
    if (c.modele.endsWith('.create')) expect(a.data?.organizationId, c.modele).toBe('orgA')
    else if (c.modele === 'propositionRisqueEcartee.findUnique') expect(a.where, c.modele).toEqual({ organizationId_cle: expect.objectContaining({ organizationId: 'orgA' }) })
    else if (c.modele === 'propositionRisqueEcartee.upsert') {
      expect(a.where, c.modele).toEqual({ organizationId_cle: expect.objectContaining({ organizationId: 'orgA' }) })
      expect((a as unknown as { create: { organizationId: string } }).create.organizationId).toBe('orgA')
    } else expect(a.where?.organizationId, c.modele).toBe('orgA')
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.appels = []; m.risquesExistants = []; m.riskTx = null; m.ecarteeTx = null
  m.create.mockImplementation(async (a: Args) => ({ id: 'r1', intitule: a.data?.intitule }))
  m.upsert.mockResolvedValue({})
})

describe('isolation par organisation', () => {
  it('chargerFonctionsCritiques : processus, usages imbriqués et tests bornés à l’organisation', async () => {
    await chargerFonctionsCritiques('orgA')
    toutBorneA()
    const proc = m.appels.find(c => c.modele === 'processus.findMany')!.args as { select: { serviceUsages: { where: { organizationId: string } } } }
    expect(proc.select.serviceUsages.where.organizationId).toBe('orgA')
  })
  it('propositionsOuvertesOrg : toutes les lectures bornées ; seules les propositions de l’organisation', async () => {
    const r = await propositionsOuvertesOrg('orgA')
    expect(r.map(p => p.cle)).toEqual(['CONTRAT_SANS_SORTIE:a1'])
    toutBorneA()
  })
  it('clé d’une autre organisation : 404, aucune création ni écart', async () => {
    expect(await validerPropositionTic(acteur('CONTRAT_SANS_SORTIE:b1'), fr)).toEqual({ ok: false, status: 404 })
    expect(await ecarterPropositionTic(acteur('CONTRAT_SANS_SORTIE:b1'))).toEqual({ ok: false, status: 404 })
    expect(m.create).not.toHaveBeenCalled()
    expect(m.upsert).not.toHaveBeenCalled()
    toutBorneA()
  })
  it('valider : risque créé dans l’organisation, sourceType proposition-tic, sourceId = clé, libellé dans la langue', async () => {
    const r = await validerPropositionTic(acteur('CONTRAT_SANS_SORTIE:a1'), fr)
    expect(r).toEqual({ ok: true, value: { id: 'r1', intitule: 'Absence de stratégie de sortie — CT-A' } })
    expect(m.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'orgA', sourceType: 'proposition-tic', sourceId: 'CONTRAT_SANS_SORTIE:a1', familleRisqueTic: 'TIERS_TIC', graviteInherente: 4 })
    toutBorneA()
  })
})

describe('concurrence', () => {
  it('double validation (contrainte unique P2002) : 409', async () => {
    m.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    expect(await validerPropositionTic(acteur('CONTRAT_SANS_SORTIE:a1'), fr)).toEqual({ ok: false, status: 409 })
  })
  it('valider une clé écartée entre-temps : 409, aucune création', async () => {
    m.ecarteeTx = { id: 'e1' }
    expect(await validerPropositionTic(acteur('CONTRAT_SANS_SORTIE:a1'), fr)).toEqual({ ok: false, status: 409 })
    expect(m.create).not.toHaveBeenCalled()
  })
  it('écarter une clé validée entre-temps (risque existant) : 409, rien n’est mémorisé', async () => {
    m.riskTx = { id: 'r9' }
    expect(await ecarterPropositionTic(acteur('CONTRAT_SANS_SORTIE:a1'))).toEqual({ ok: false, status: 409 })
    expect(m.upsert).not.toHaveBeenCalled()
    const f = m.appels.find(c => c.modele === 'riskItem.findFirst')!.args as Args
    expect(f.where).toMatchObject({ organizationId: 'orgA', sourceType: 'proposition-tic', sourceId: 'CONTRAT_SANS_SORTIE:a1' })
  })
  it('écarter une clé ouverte : mémorisée', async () => {
    expect(await ecarterPropositionTic(acteur('CONTRAT_SANS_SORTIE:a1'))).toEqual({ ok: true, value: { cle: 'CONTRAT_SANS_SORTIE:a1' } })
    expect(m.upsert).toHaveBeenCalledTimes(1)
  })
  it('clé déjà validée (risque existant) : n’est plus proposée, valider → 404', async () => {
    m.risquesExistants = [{ sourceId: 'CONTRAT_SANS_SORTIE:a1' }]
    expect(await propositionsOuvertesOrg('orgA')).toEqual([])
    expect(await validerPropositionTic(acteur('CONTRAT_SANS_SORTIE:a1'), fr)).toEqual({ ok: false, status: 404 })
  })
})
