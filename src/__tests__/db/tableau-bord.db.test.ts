/**
 * Tableau de bord mensuel sur une vraie base : destinataires (RSSI, gestionnaire des risques du
 * groupe ; administrateur à défaut), une section par organisation, contenu du mois écoulé,
 * désactivation par organisation, un seul envoi par mois (y compris via l'alias derogations-digest).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const mail = vi.hoisted(() => ({ send: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/email', () => ({ sendEmail: mail.send }))

import { envoyerTableauBordMensuel, TACHE_TABLEAU_BORD } from '@/lib/tableau-bord-mensuel.server'
import { POST as alias } from '@/app/api/cron/derogations-digest/route'

// Envoi du 1er décembre 2026 : couvre novembre 2026.
const now = new Date('2026-12-01T08:00:00Z')
const nov = (j: number) => new Date(Date.UTC(2026, 10, j, 12))
type Envoye = { to: string; subject: string; text: string }
const envoyes = (u: { email: string }) => (mail.send.mock.calls as unknown as [Envoye][]).map(c => c[0]).filter(m => m.to === u.email)

let rssi: { email: string }, rmGroupe: { email: string }, analyste: { email: string }, adminSeul: { email: string }, rssiOff: { email: string }
let resultat: Awaited<ReturnType<typeof envoyerTableauBordMensuel>>

beforeAll(async () => {
  process.env.CRON_SECRET = 's3cret-s3cret-s3cret'
  await prisma.envoiPeriodique.deleteMany({ where: { tache: TACHE_TABLEAU_BORD, periode: '2026-11' } })
  const groupe = await makeOrg('Groupe TB')
  const f = await makeOrg('Banque TB')
  const banque = await prisma.organization.update({ where: { id: f.id }, data: { path: `/${groupe.id}/${f.id}/`, parentId: groupe.id } })
  const off = await makeOrg('Sans tableau')
  const petite = await makeOrg('Petite structure')
  await prisma.organizationConfig.create({ data: { id: banque.id, registreRisquesActive: true, controlePermanentActive: true, incidentsActive: true, derogationsActive: true } })
  await prisma.organizationConfig.create({ data: { id: off.id, registreRisquesActive: true, relancesConfig: { tableauBordMensuel: false } } })
  await prisma.organizationConfig.create({ data: { id: petite.id, registreRisquesActive: true } })
  rssi = await makeUser('ANALYSTE', [{ id: banque.id, role: 'RSSI' }])
  rmGroupe = await prisma.user.create({ data: { email: `rm-groupe-${Date.now()}@test.acra`, name: 'RM groupe', role: 'ANALYSTE', memberships: { create: { organizationId: groupe.id, role: 'RISK_MANAGER', scope: 'SUBTREE' } } } })
  analyste = await makeUser('ANALYSTE', [{ id: banque.id }])
  adminSeul = await makeUser('ANALYSTE', [{ id: petite.id, role: 'ADMIN' }])
  rssiOff = await makeUser('ANALYSTE', [{ id: off.id, role: 'RSSI' }])

  await prisma.riskItem.create({ data: { organizationId: banque.id, intitule: 'Panne du SI paiements', graviteResiduelle: 4, vraisemblanceResiduelle: 4 } as never })
  await prisma.planAction.create({ data: { organizationId: banque.id, titre: 'MFA partout', statut: 'EN_COURS', echeance: nov(10) } })
  await prisma.incident.create({ data: { organizationId: banque.id, intitule: 'Rançongiciel', declarantId: 'x', createdAt: nov(5) } as never })
  await prisma.incident.create({ data: { organizationId: banque.id, intitule: 'Octobre, hors période', declarantId: 'x', createdAt: new Date(Date.UTC(2026, 9, 20)) } as never })
  const ctrl = await prisma.controle.create({ data: { organizationId: banque.id, intitule: 'Revue des accès' } })
  await prisma.controleExecution.create({ data: { controleId: ctrl.id, organizationId: banque.id, resultat: 'ANOMALIE', constat: 'KO', dateRealisation: nov(15), executantId: 'x' } })
  await prisma.derogation.create({ data: { organizationId: banque.id, portee: 'SOCLE', intitule: 'TLS 1.0', motif: 'm', mesuresCompensatoires: 'c', demandeurId: 'x', statut: 'ACTIVE', dateDebut: nov(1), dateFin: new Date(Date.UTC(2026, 11, 15)) } })
  await prisma.riskItem.create({ data: { organizationId: off.id, intitule: 'Ne doit pas apparaître', graviteResiduelle: 4, vraisemblanceResiduelle: 4 } as never })

  resultat = await envoyerTableauBordMensuel(now)
})
afterAll(async () => { await prisma.$disconnect() })

describe('tableau de bord mensuel (vraie base)', () => {
  it('RSSI de l’organisation et gestionnaire des risques du groupe : un e-mail, le mois écoulé, le plus important', () => {
    expect(resultat).toMatchObject({ dejaEnvoye: false, periode: '2026-11' })
    for (const u of [rssi, rmGroupe]) {
      const m = envoyes(u)
      expect(m).toHaveLength(1)
      expect(m[0].subject).toBe('[ACRA] Tableau de bord — novembre 2026')
      expect(m[0].text).toContain('■ Banque TB')
      expect(m[0].text).toContain('Risques élevés : 1')
      expect(m[0].text).toContain('Incidents du mois : 1')
      expect(m[0].text).toContain('Anomalies de contrôle : 1')
      expect(m[0].text).toContain('Dérogations à expirer : 1')
      expect(m[0].text).toContain('• Risque élevé — Panne du SI paiements (niveau 16)')
      expect(m[0].text).toContain('• Plan d’action en retard — MFA partout (échéance le 2026-11-10)')
      expect(m[0].text).toContain('• Dérogation à expirer — TLS 1.0 (fin le 2026-12-15)')
    }
  })
  it('pas l’analyste ; organisation désactivée ignorée ; administrateur à défaut de RSSI et de gestionnaire', () => {
    expect(envoyes(analyste)).toHaveLength(0)
    expect(envoyes(rssiOff)).toHaveLength(0)
    expect(mail.send.mock.calls.some(c => (c as unknown as [Envoye])[0].text.includes('Ne doit pas apparaître'))).toBe(false)
    expect(envoyes(adminSeul)).toHaveLength(1)
    expect(envoyes(adminSeul)[0].text).toContain('■ Petite structure')
  })
  it('un seul envoi par mois, y compris via l’ancienne tâche derogations-digest', async () => {
    mail.send.mockClear()
    expect(await envoyerTableauBordMensuel(now)).toEqual({ dejaEnvoye: true, periode: '2026-11' })
    expect(mail.send).not.toHaveBeenCalled()
    const bilan = await prisma.envoiPeriodique.findUniqueOrThrow({ where: { tache_periode: { tache: TACHE_TABLEAU_BORD, periode: '2026-11' } } })
    expect(bilan.bilan).toMatchObject({ emailsSent: expect.any(Number) })
    const res = await alias(new Request('http://t/api/cron/derogations-digest', { method: 'POST', headers: { authorization: 'Bearer s3cret-s3cret-s3cret' } }) as never)
    expect(await res.json()).toMatchObject({ ok: true, fusionneDans: 'tableau-bord-mensuel' })
  })
})
