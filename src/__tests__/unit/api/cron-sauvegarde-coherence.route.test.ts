// @vitest-environment node
// Tâches planifiées de sauvegarde (profil ha et mono-instance) : POST /api/cron/sauvegarde-base (compte rendu de l'agent, relance)
// et POST /api/cron/coherence-documents (tous les documents référencés existent dans le stockage). Authentification, bail et
// journal d'exécution sont ceux de cronRoute (testés ailleurs) : remplacés ici par un passe-plat.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

vi.mock('@/lib/cron-route.server', () => ({ cronRoute: (_t: string, h: (r: unknown) => Promise<Response>) => h }))
const db = vi.hoisted(() => ({ documents: [] as { id: string; storageKey: string }[], campagnes: [] as { id: string; rapports: unknown }[], missions: [] as { id: string; rapports: unknown }[] }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  document: { findMany: vi.fn(async () => db.documents) },
  campagneControle: { findMany: vi.fn(async () => db.campagnes) },
  auditMission: { findMany: vi.fn(async () => db.missions) },
} }))

import { POST as sauvegarde } from '@/app/api/cron/sauvegarde-base/route'
import { POST as coherence } from '@/app/api/cron/coherence-documents/route'
import { resetDocumentStorageCache } from '@/lib/document-storage'

const req = (body?: unknown) => ({ json: async () => { if (body === undefined) throw new Error('vide'); return body } }) as never
let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acra-cron-bk-'))
  process.env.ACRA_UPDATE_DIR = path.join(dir, 'upd'); fs.mkdirSync(path.join(dir, 'upd', 'inbox'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'upd', 'agent.json'), JSON.stringify({ at: new Date().toISOString() }))
  process.env.DOCUMENT_STORAGE_DIR = path.join(dir, 'docs'); delete process.env.DOCUMENT_STORAGE; resetDocumentStorageCache()
  db.documents = []; db.campagnes = []; db.missions = []
})
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.ACRA_UPDATE_DIR; delete process.env.DOCUMENT_STORAGE_DIR; resetDocumentStorageCache() })

describe('POST /api/cron/sauvegarde-base', () => {
  it('rapport OK ⇒ 200 ; rapport ECHEC ⇒ 502 sauvegarde_echec_<code> (exécution en échec, alerte)', async () => {
    const ok = await sauvegarde(req({ rapport: { statut: 'OK', code: 0, raison: 'scheduled', pointId: '20261004T020000Z-scheduled-1.0.4', tiers: 'daily', controleDocuments: 'ok' } }))
    expect(ok.status).toBe(200)
    const ko = await sauvegarde(req({ rapport: { statut: 'ECHEC', code: 20, raison: 'scheduled' } }))
    expect(ko.status).toBe(502); expect(await ko.json()).toMatchObject({ ok: false, error: 'sauvegarde_echec_20' })
    expect(fs.existsSync(path.join(dir, 'upd', 'inbox', 'request.json'))).toBe(false)
  })
  it('rapport invalide ⇒ 400, rien n’est déposé', async () => {
    expect((await sauvegarde(req({ rapport: { statut: 'OK', code: 0, raison: 'rm -rf' } }))).status).toBe(400)
    expect(fs.existsSync(path.join(dir, 'upd', 'inbox', 'request.json'))).toBe(false)
  })
  it('relance (sans rapport) ⇒ demande de sauvegarde immédiate pour l’agent (202) ; agent absent ⇒ 409', async () => {
    const r = await sauvegarde(req())
    expect(r.status).toBe(202)
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'upd', 'inbox', 'request.json'), 'utf8'))).toMatchObject({ action: 'backup-now', requestedBy: 'tache-planifiee' })
    fs.rmSync(path.join(dir, 'upd', 'inbox', 'request.json')); fs.rmSync(path.join(dir, 'upd', 'agent.json'))
    const k = await sauvegarde(req())
    expect(k.status).toBe(409); expect(await k.json()).toMatchObject({ error: 'agent_unavailable' })
  })
})

describe('POST /api/cron/coherence-documents', () => {
  const put = (k: string) => { const p = path.join(dir, 'docs', k); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'x') }
  it('tous présents ⇒ 200 avec comptes et empreinte', async () => {
    db.documents = [{ id: 'd1', storageKey: 'o1/d1/a.pdf' }]; db.campagnes = [{ id: 'c1', rapports: [{ storageKey: 'o1/c1/r.pdf' }] }]
    put('o1/d1/a.pdf'); put('o1/c1/r.pdf')
    const r = await coherence(req())
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ ok: true, stockage: 'local', references: 2, presents: 2, manquants: 0 })
  })
  it('document référencé absent ⇒ 409 documents_manquants, lignes concernées sans clé ni nom de fichier', async () => {
    db.documents = [{ id: 'd1', storageKey: 'o1/d1/secret-plan.pdf' }, { id: 'd2', storageKey: 'o1/d2/b.pdf' }]
    db.missions = [{ id: 'm1', rapports: [{ storageKey: 'o1/m1/rapport.pdf' }] }]
    put('o1/d2/b.pdf')
    const r = await coherence(req())
    expect(r.status).toBe(409)
    const b = await r.json()
    expect(b).toMatchObject({ ok: false, error: 'documents_manquants', references: 3, presents: 1, manquants: 2 })
    expect(b.echantillon).toEqual([{ type: 'document', id: 'd1' }, { type: 'mission', id: 'm1' }])
    expect(JSON.stringify(b)).not.toMatch(/secret-plan|rapport\.pdf/)
  })
})
