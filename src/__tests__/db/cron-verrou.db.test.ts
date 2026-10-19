/**
 * Bail des tâches planifiées, sur base réelle : deux exécutions simultanées de la même tâche → une
 * seule s'exécute ; le bail est rendu en fin de tâche (même en cas d'erreur) et expire seul.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { avecVerrouCron } from '@/lib/cron-verrou.server'

afterAll(async () => { await prisma.$disconnect() })
const tache = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('avecVerrouCron', () => {
  it('deux appels simultanés : un seul exécute la tâche, l\'autre est ignoré', async () => {
    const t = tache(); let executions = 0
    const job = async () => { executions++; await pause(300); return 'fait' }
    const [a, b] = await Promise.all([avecVerrouCron(t, job), avecVerrouCron(t, job)])
    expect(executions).toBe(1)
    expect([a, b].filter(r => r.execute).length).toBe(1)
    expect([a, b].find(r => !r.execute)).toEqual({ execute: false, raison: 'deja_en_cours' })
  })
  it('le bail est rendu en fin de tâche, y compris sur erreur', async () => {
    const t = tache()
    await expect(avecVerrouCron(t, async () => { throw new Error('boum') })).rejects.toThrow('boum')
    expect(await avecVerrouCron(t, async () => 1)).toEqual({ execute: true, resultat: 1 })
  })
  it('un bail expiré (instance arrêtée en cours de tâche) est repris', async () => {
    const t = tache()
    await prisma.cronVerrou.create({ data: { tache: t, jusqua: new Date(Date.now() - 1000), jeton: 'ancien' } })
    expect(await avecVerrouCron(t, async () => 'repris')).toEqual({ execute: true, resultat: 'repris' })
  })
  it('ne rend pas le bail d\'une autre exécution (jeton)', async () => {
    const t = tache()
    await avecVerrouCron(t, async () => {
      // Pendant l'exécution, une autre instance reprend un bail qu'elle croit expiré : la fin de la 1ʳᵉ ne doit pas le libérer.
      await prisma.cronVerrou.update({ where: { tache: t }, data: { jeton: 'autre', jusqua: new Date(Date.now() + 60_000) } })
    })
    const v = await prisma.cronVerrou.findUnique({ where: { tache: t } })
    expect(v?.jeton).toBe('autre')
    expect(v!.jusqua.getTime()).toBeGreaterThan(Date.now())
  })
})
