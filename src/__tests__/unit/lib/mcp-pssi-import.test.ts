// Application d'une PSSI acceptée : référentiel + document + suivi de conformité dans une transaction ; code pris → 409 ;
// échec de la transaction → le fichier déposé est retiré (pas d'orphelin).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  refFind: vi.fn(), refCreate: vi.fn(), docCreate: vi.fn(), confUpsert: vi.fn(), propUpdate: vi.fn(), put: vi.fn(), del: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    referentiel: { findFirst: (...a: unknown[]) => m.refFind(...a) },
    $transaction: async (cb: (tx: unknown) => unknown) => cb({
      referentiel: { create: m.refCreate }, document: { create: m.docCreate }, conformite: { upsert: m.confUpsert }, mcpProposal: { update: m.propUpdate },
    }),
  },
}))
vi.mock('@/lib/document-storage', () => ({ getDocumentStorage: async () => ({ put: m.put, delete: m.del }) }))

import { importerPssi } from '@/lib/mcp/pssi-import.server'
import { sanitizePssiProposal } from '@/lib/mcp/pssi-proposal'

const p = sanitizePssiProposal({ titre: 'PSSI groupe', version: '3.2', date: '2026-01-15', exigences: [{ ref: 'GOV-01', nom: 'Désigner un RSSI', categorie: 'Gouvernance' }] })
const ctx = { organizationId: 'orgA', userId: 'admin', proposalId: 'prop1', suiviConformite: true }

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset())
  m.refFind.mockResolvedValue(null); m.refCreate.mockResolvedValue({ id: 'ref1' }); m.confUpsert.mockResolvedValue({ id: 'conf1' }); m.del.mockResolvedValue(undefined)
})

describe('importerPssi', () => {
  it('crée le référentiel PSSI, le document Markdown rattaché, le suivi de conformité et accepte la proposition', async () => {
    const res = await importerPssi(p, ctx)
    expect(res).toMatchObject({ ok: true, referentielId: 'ref1', conformiteId: 'conf1' })
    expect(m.refCreate.mock.calls[0][0].data).toMatchObject({ organizationId: 'orgA', code: 'PSSI-3-2', type: 'PSSI', createdBy: 'admin' })
    const doc = m.docCreate.mock.calls[0][0].data
    expect(doc).toMatchObject({ organizationId: 'orgA', type: 'PSSI', portee: 'REFERENTIEL', referentielCode: 'PSSI-3-2', mime: 'text/markdown', fichierNom: 'PSSI-3-2-v3.2.md' })
    expect(doc.storageKey).toMatch(/^orgA\//)
    expect(m.put.mock.calls[0][0]).toBe(doc.storageKey)
    expect(m.confUpsert.mock.calls[0][0].create).toMatchObject({ organizationId: 'orgA', referentiel: 'PSSI-3-2', entite: '' })
    expect(m.propUpdate.mock.calls[0][0].data).toMatchObject({ statut: 'ACCEPTEE', appliedId: 'ref1' })
  })
  it('sans suivi demandé : aucun suivi de conformité créé', async () => {
    await importerPssi(p, { ...ctx, suiviConformite: false })
    expect(m.confUpsert).not.toHaveBeenCalled()
  })
  it('code déjà pris → 409 sans rien déposer ; échec de transaction → fichier retiré', async () => {
    m.refFind.mockResolvedValueOnce({ id: 'old' })
    expect(await importerPssi(p, ctx)).toEqual({ ok: false, error: 'code_existant', status: 409 })
    expect(m.put).not.toHaveBeenCalled()
    m.docCreate.mockRejectedValueOnce(new Error('db'))
    await expect(importerPssi(p, ctx)).rejects.toThrow('db')
    expect(m.del).toHaveBeenCalledWith(m.put.mock.calls[0][0])
  })
})
