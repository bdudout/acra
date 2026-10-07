/**
 * Instantanés d'appétence sur une vraie base : un par organisation et par mois (contrainte d'unicité), le cron n'écrase
 * jamais, la capture manuelle rafraîchit, les organisations sans source active sont ignorées, rien d'une autre organisation ne fuit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg } from './helpers'
import { capturerInstantane } from '@/lib/appetit-historique.server'
import { periodeCourante, type ResumeAppetence } from '@/lib/appetit-historique'

let orgA = '', orgB = '', orgVide = ''
const now = new Date('2026-10-15T10:00:00Z')

beforeAll(async () => {
  orgA = (await makeOrg('Org A appétence')).id; orgB = (await makeOrg('Org B appétence')).id; orgVide = (await makeOrg('Sans source')).id
  await prisma.organizationConfig.create({ data: { id: orgA, registreRisquesActive: true, appetenceActive: true } })
  await prisma.organizationConfig.create({ data: { id: orgB, registreRisquesActive: true, appetenceActive: true } })
  await prisma.organizationConfig.create({ data: { id: orgVide, registreRisquesActive: false, appetenceActive: true } })
  await prisma.riskItem.create({ data: { organizationId: orgA, intitule: 'Risque secret de A', graviteResiduelle: 3, vraisemblanceResiduelle: 3 } })
})
afterAll(async () => { await prisma.$disconnect() })

describe('instantanés d’appétence (vraie base)', () => {
  it('première capture : créée ; deuxième sans écraser : ignorée ; avec écraser : rafraîchie ; une seule ligne par mois', async () => {
    expect(await capturerInstantane(orgA, { now, userId: null, ecraser: false })).toEqual({ periode: '2026-10', cree: true })
    expect(await capturerInstantane(orgA, { now, userId: null, ecraser: false })).toEqual({ periode: '2026-10', cree: false })
    await prisma.riskItem.create({ data: { organizationId: orgA, intitule: 'Autre', graviteResiduelle: 4, vraisemblanceResiduelle: 4 } })
    expect(await capturerInstantane(orgA, { now, userId: 'u-manuel', ecraser: true })).toEqual({ periode: '2026-10', cree: true })
    const rows = await prisma.appetenceSnapshot.findMany({ where: { organizationId: orgA } })
    expect(rows).toHaveLength(1); expect(rows[0].createdById).toBe('u-manuel')
    const r = rows[0].resume as unknown as ResumeAppetence
    expect(r.appetit).toBeDefined(); expect(r.global).toBeDefined()
  })
  it('le résumé ne contient que des agrégats (aucun intitulé de risque) et ne mélange pas les organisations', async () => {
    const [a] = await prisma.appetenceSnapshot.findMany({ where: { organizationId: orgA } })
    expect(JSON.stringify(a.resume)).not.toMatch(/secret de A|Autre/)
    await capturerInstantane(orgB, { now, userId: null, ecraser: false })
    const b = await prisma.appetenceSnapshot.findFirst({ where: { organizationId: orgB } })
    expect((b!.resume as unknown as ResumeAppetence).appetit?.horsAppetit).toBe(0)
  })
  it('sans source active : aucun instantané ; mois suivant : nouvelle ligne ; l’unicité est garantie par la base', async () => {
    expect(await capturerInstantane(orgVide, { now, userId: null, ecraser: false })).toBeNull()
    expect(await prisma.appetenceSnapshot.count({ where: { organizationId: orgVide } })).toBe(0)
    await capturerInstantane(orgA, { now: new Date('2026-11-02T00:00:00Z'), userId: null, ecraser: false })
    expect((await prisma.appetenceSnapshot.findMany({ where: { organizationId: orgA }, orderBy: { periode: 'asc' } })).map(r => r.periode)).toEqual(['2026-10', '2026-11'])
    await expect(prisma.appetenceSnapshot.create({ data: { organizationId: orgA, periode: periodeCourante(now), resume: {} } })).rejects.toThrow()
  })
})
