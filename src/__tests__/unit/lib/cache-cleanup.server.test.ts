// Lot B : exécution par lots, aperçu = suppression, idempotence, verrou (client Prisma simulé).
import { describe, it, expect } from 'vitest'
import { previewCleanup, runCleanup, type CleanupDb } from '@/lib/cache-cleanup.server'

const NOW = new Date('2026-10-05T12:00:00.000Z')

function fakeDb(rows: Record<string, string[]>, opts: { lock?: boolean } = {}) {
  const calls: string[] = []
  const delegate = (model: string) => ({
    count: async () => rows[model]?.length ?? 0,
    findMany: async ({ take }: { take: number }) => (rows[model] ?? []).slice(0, take).map(id => ({ id, token: id })),
    deleteMany: async ({ where }: { where: { id?: { in: string[] }; token?: { in: string[] } } }) => {
      const ids = where.id?.in ?? where.token?.in ?? []
      calls.push(`${model}:${ids.length}`)
      rows[model] = (rows[model] ?? []).filter(x => !ids.includes(x)); return { count: ids.length }
    },
  })
  const db = {
    passwordResetToken: delegate('passwordResetToken'), verificationToken: delegate('verificationToken'), mfaChallenge: delegate('mfaChallenge'),
    session: delegate('session'), trustedDevice: delegate('trustedDevice'), orgInvitation: delegate('orgInvitation'),
    webhookDelivery: delegate('webhookDelivery'), analysisImport: delegate('analysisImport'),
    configuration: { updateMany: async () => ({ count: (opts.lock ?? true) ? 1 : 0 }) },
  } as unknown as CleanupDb
  return { db, calls, rows }
}
const many = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`)

describe('previewCleanup', () => {
  it('compte par catégorie et estime les octets', async () => {
    const { db } = fakeDb({ session: many(3, 's'), webhookDelivery: many(2, 'w') })
    const r = await previewCleanup(db, NOW, ['B4', 'B7'])
    expect(r).toEqual([{ id: 'B4', count: 3, bytes: 600 }, { id: 'B7', count: 2, bytes: 4096 }])
  })
})

describe('runCleanup', () => {
  it('supprime par lots (taille bornée) et rend les comptes ; l’aperçu égale la suppression', async () => {
    const { db, calls, rows } = fakeDb({ session: many(2500, 's') })
    const prev = await previewCleanup(db, NOW, ['B4'])
    const r = await runCleanup(db, NOW, ['B4'], { batchSize: 1000 })
    expect(r.ok).toBe(true)
    expect(r.ok && r.counts).toEqual({ B4: 2500 }); expect(prev[0].count).toBe(2500)
    expect(calls).toEqual(['session:1000', 'session:1000', 'session:500'])
    expect(rows.session).toEqual([])
  })
  it('utilise la colonne token pour B2', async () => {
    const { db } = fakeDb({ verificationToken: many(3, 't') })
    const r = await runCleanup(db, NOW, ['B2'])
    expect(r.ok && r.counts).toEqual({ B2: 3 })
  })
  it('idempotent : second passage = 0', async () => {
    const { db } = fakeDb({ session: many(5, 's') })
    await runCleanup(db, NOW, ['B4'])
    expect((await runCleanup(db, NOW, ['B4']) as { counts: object }).counts).toEqual({ B4: 0 })
  })
  it('verrou déjà pris : refus sans rien supprimer', async () => {
    const { db, calls } = fakeDb({ session: many(5, 's') }, { lock: false })
    expect(await runCleanup(db, NOW, ['B4'])).toEqual({ ok: false, error: 'already_running' })
    expect(calls).toEqual([])
  })
  it('catégorie hors sélection ignorée', async () => {
    const { db, calls } = fakeDb({ session: many(5, 's'), mfaChallenge: many(2, 'm') })
    await runCleanup(db, NOW, ['B3']); expect(calls).toEqual(['mfaChallenge:2'])
  })
})
