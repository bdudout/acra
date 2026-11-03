/**
 * Journal d'audit infalsifiable, sur base réelle : le déclencheur refuse modification et suppression ; le scellement
 * chaîne les entrées ; la vérification détecte une falsification faite en contournant le déclencheur (administrateur de
 * base malveillant), puis la chaîne redevient intègre une fois le contenu d'origine rétabli.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { scellerJournal, verifierJournal } from '@/lib/audit-chaine.server'

afterAll(async () => { await prisma.$disconnect() })
const futur = () => new Date(Date.now() + 10 * 60_000) // au-delà de la marge : tout est scellable

describe('journal d’audit infalsifiable (base réelle)', () => {
  it('modification et suppression refusées par la base', async () => {
    const e = await prisma.auditLog.create({ data: { action: 'TEST_CHAINE', details: '{"n":1}' } })
    await expect(prisma.auditLog.update({ where: { id: e.id }, data: { action: 'FALSIFIE' } })).rejects.toThrow(/immuable/)
    await expect(prisma.auditLog.delete({ where: { id: e.id } })).rejects.toThrow(/immuable/)
  })

  it('scellement puis vérification : chaîne intègre ; une entrée scellée ne se re-scelle pas', async () => {
    await prisma.auditLog.create({ data: { action: 'TEST_CHAINE', details: '{"n":2}' } })
    const s = await scellerJournal(futur())
    expect(s.scellees).toBeGreaterThan(0)
    expect(await prisma.auditLog.count({ where: { hash: null } })).toBe(0)
    const v = await verifierJournal()
    expect(v).toMatchObject({ ok: true, nonScellees: 0, rupture: null })
    expect(v.verifiees).toBeGreaterThan(1)
    const e = await prisma.auditLog.findFirst({ where: { action: 'TEST_CHAINE' }, orderBy: { seq: 'desc' } })
    await expect(prisma.auditLog.update({ where: { id: e!.id }, data: { hash: 'x' } })).rejects.toThrow(/immuable/)
  })

  it('falsification en contournant le déclencheur : rupture détectée et localisée', async () => {
    const cible = await prisma.auditLog.findFirst({ where: { action: 'TEST_CHAINE', details: '{"n":1}' } })
    const avant = cible!.details
    await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER "AuditLog_immuable"')
    try {
      await prisma.$executeRaw`UPDATE "AuditLog" SET details = '{"n":999}' WHERE id = ${cible!.id}`
      const v = await verifierJournal()
      expect(v).toMatchObject({ ok: false, rupture: { seq: cible!.seq.toString(), raison: 'contenu_modifie' } })
      await prisma.$executeRaw`UPDATE "AuditLog" SET details = ${avant} WHERE id = ${cible!.id}`
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER "AuditLog_immuable"')
    }
    expect((await verifierJournal()).ok).toBe(true)
  })
})

import { purgerJournal } from '@/lib/audit-purge.server'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getDocumentStorage } from '@/lib/document-storage'

describe('rétention : purge archivée (base réelle)', () => {
  it('sans rétention : rien n’est purgé', async () => {
    await prisma.siemConfig.upsert({ where: { id: 'global' }, create: { id: 'global', auditRetentionMois: null }, update: { auditRetentionMois: null } })
    expect(await purgerJournal()).toEqual({ purgees: 0, raison: 'retention_non_definie' })
  })
  it('purge des entrées scellées anciennes : archive vérifiable, ancre, chaîne toujours intègre, scellement qui reprend', async () => {
    await scellerJournal(futur())
    await prisma.siemConfig.update({ where: { id: 'global' }, data: { auditRetentionMois: 12 } })
    const dansDeuxAns = new Date(Date.now() + 2 * 365 * 86_400_000) // tout le journal actuel devient « ancien »
    const avant = await prisma.auditLog.count()
    const r = await purgerJournal(dansDeuxAns)
    expect(r.purgees).toBe(avant)
    if (!('archiveCle' in r)) throw new Error('pas d’archive')
    const archive = await (await getDocumentStorage()).get(r.archiveCle)
    expect(createHash('sha256').update(archive).digest('hex')).toBe(r.archiveSha256)
    expect(gunzipSync(archive).toString('utf8').trim().split('\n')).toHaveLength(avant)
    expect(await prisma.auditLog.count()).toBe(0)
    // Nouvelles entrées : elles se chaînent à l'ancre de la purge, la vérification reste intègre.
    await prisma.auditLog.create({ data: { action: 'TEST_APRES_PURGE' } })
    await scellerJournal(futur())
    expect(await verifierJournal()).toMatchObject({ ok: true, verifiees: 1 })
    await prisma.siemConfig.update({ where: { id: 'global' }, data: { auditRetentionMois: null } })
  })
})
