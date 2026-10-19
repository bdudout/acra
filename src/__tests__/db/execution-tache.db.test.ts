/**
 * Journal d'exécution des tâches planifiées, sur base réelle : chaque exécution est tracée ; un échec
 * (exception OU réponse en erreur) est enregistré avec son message, signalé au journal d'audit, et la
 * réponse au planificateur est une erreur stable (pas de message interne).
 */
import { describe, it, expect, vi, afterAll } from 'vitest'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const audit = vi.hoisted(() => vi.fn())
vi.mock('@/lib/logger', async (orig) => ({ ...(await orig<object>()), auditLog: audit }))

import { executerTache } from '@/lib/taches.server'

afterAll(async () => { await prisma.$disconnect() })
const tache = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const derniere = (t: string) => prisma.executionTache.findFirstOrThrow({ where: { tache: t }, orderBy: { debut: 'desc' } })

describe('executerTache', () => {
  it('succès : statut OK, durée, résumé de la réponse', async () => {
    const t = tache()
    const res = await executerTache(t, 'CRON', async () => NextResponse.json({ ok: true, envoyes: 3 }))
    expect(res.status).toBe(200)
    const e = await derniere(t)
    expect(e).toMatchObject({ statut: 'OK', declencheur: 'CRON', erreur: null, resume: { ok: true, envoyes: 3 } })
    expect(e.fin).not.toBeNull()
    expect(e.dureeMs).toBeGreaterThanOrEqual(0)
  })
  it('exception : statut ECHEC, message enregistré, signalé, réponse 500 sans détail interne', async () => {
    const t = tache()
    const res = await executerTache(t, 'MANUEL', async () => { throw new Error('connexion SMTP refusée') })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false, error: 'tache_echec', tache: t })
    expect(await derniere(t)).toMatchObject({ statut: 'ECHEC', declencheur: 'MANUEL', erreur: 'connexion SMTP refusée' })
    expect(audit).toHaveBeenCalledWith('TACHE_PLANIFIEE_ECHEC', expect.objectContaining({ details: expect.objectContaining({ tache: t, erreur: 'connexion SMTP refusée' }) }))
  })
  it('réponse en erreur (ex. 409, 400) : ECHEC avec le code, réponse transmise telle quelle', async () => {
    const t = tache()
    const res = await executerTache(t, 'CRON', async () => NextResponse.json({ error: 'already_running' }, { status: 409 }))
    expect(res.status).toBe(409)
    expect(await derniere(t)).toMatchObject({ statut: 'ECHEC', erreur: 'HTTP 409 : already_running' })
  })
  it('rétention : les exécutions de plus de 90 jours sont purgées', async () => {
    const t = tache()
    await prisma.executionTache.create({ data: { tache: t, statut: 'OK', debut: new Date(Date.now() - 91 * 86_400_000) } })
    await executerTache(t, 'CRON', async () => NextResponse.json({ ok: true }))
    expect(await prisma.executionTache.count({ where: { tache: t } })).toBe(1)
  })
})
