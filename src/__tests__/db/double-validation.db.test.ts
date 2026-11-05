/**
 * Double validation (quatre yeux) activable par organisation, sur base réelle :
 *  - acceptation des risques résiduels d'une analyse HORS APPÉTIT → demande ; le demandeur ne peut pas l'approuver ;
 *    une seconde Direction métier approuve → acceptation enregistrée ;
 *  - registre : statut ACCEPTE d'un risque hors appétit → demande (statut inchangé) ; approuvé par un RISK_MANAGER ;
 *  - suppression d'un contrat TIC CRITIQUE → demande ; rejet sans motif refusé ; approbation → supprimé ;
 *  - hors périmètre (contrat non critique, option désactivée) : action directe.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser, jsonRequest } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { POST as accepter } from '@/app/api/analyses/[id]/accept-residual-risks/route'
import { PATCH as patchRisque } from '@/app/api/risk-items/[id]/route'
import { POST as creerRisque } from '@/app/api/risk-items/route'
import { DELETE as supprimerContrat } from '@/app/api/reglementaire/registre-tic/[id]/route'
import { POST as trancher } from '@/app/api/validations/[id]/route'
import { GET as lister } from '@/app/api/validations/route'

afterAll(async () => { await prisma.$disconnect() })

type U = { id: string; role: string }
let org: { id: string }, auteur: U, dirA: U, dirB: U, rssi: U, rm: U, analyseId: string, risqueId: string
const en = (u: U) => { session.user = { id: u.id, role: u.role }; session.activeOrg = org.id }
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as never
const req = (method: string, body?: unknown) => new Request('http://test.local/api', { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` }, ...(body ? { body: JSON.stringify(body) } : {}) }) as never
const decider = (id: string, decision: string, motif?: string) => trancher(jsonRequest({ decision, ...(motif ? { motif } : {}) }), ctx({ id }))

beforeAll(async () => {
  org = await makeOrg('Banque 4 yeux')
  await prisma.organizationConfig.upsert({
    where: { id: org.id },
    create: { id: org.id, doubleValidationActive: true, acceptationRisquesActive: true, reglementaireActive: true, registreRisquesActive: true, appetitRisque: { seuilGlobal: 6, parCategorie: {} } },
    update: { doubleValidationActive: true, acceptationRisquesActive: true, reglementaireActive: true, registreRisquesActive: true, appetitRisque: { seuilGlobal: 6, parCategorie: {} } },
  })
  const mk = async (r: string) => { const u = await makeUser('ANALYSTE', [{ id: org.id, role: r as never }]); return { id: u.id, role: 'ANALYSTE' } }
  auteur = await mk('ANALYSTE'); dirA = await mk('DIRECTION_METIER'); dirB = await mk('DIRECTION_METIER'); rssi = await mk('RSSI'); rm = await mk('RISK_MANAGER')
  analyseId = (await prisma.analyse.create({ data: { userId: auteur.id, nom: 'Paiements instantanés', organizationId: org.id, statut: 'SOUMIS' } })).id
  await prisma.risque.createMany({ data: [
    { analyseId, nom: 'Fraude', gravite: 3, vraisemblance: 3, niveauRisque: 9, graviteResiduelle: 3, vraisemblanceResiduelle: 3, niveauResiduel: 9 },
    { analyseId, nom: 'Indisponibilité', gravite: 2, vraisemblance: 2, niveauRisque: 4, graviteResiduelle: 2, vraisemblanceResiduelle: 1, niveauResiduel: 2 },
  ] })
  risqueId = (await prisma.riskItem.create({ data: { organizationId: org.id, intitule: 'Fraude au virement', graviteResiduelle: 3, vraisemblanceResiduelle: 3, statut: 'TRAITE' } })).id
})

describe('double validation (base réelle)', () => {
  it('analyse : acceptation hors appétit → demande ; auto-validation refusée ; approuvée par une 2ᵉ Direction métier', async () => {
    en(dirA)
    const r = await accepter(req('POST', { action: 'ACCEPTER', commentaire: 'Risque assumé jusqu’au T2' }), ctx({ id: analyseId }))
    const j = await r.json()
    expect(r.status, JSON.stringify(j)).toBe(202)
    expect(j).toMatchObject({ doubleValidation: true, horsAppetit: 1, existante: false })
    expect((await prisma.analyse.findUnique({ where: { id: analyseId } }))!.risquesResiduelsStatut).not.toBe('ACCEPTES')
    // Une seconde demande identique ne crée pas de doublon.
    expect((await (await accepter(req('POST', { action: 'ACCEPTER' }), ctx({ id: analyseId }))).json()).existante).toBe(true)

    expect((await decider(j.demandeId, 'APPROUVER')).status).toBe(403) // le demandeur
    en(rssi); expect((await decider(j.demandeId, 'APPROUVER')).status).toBe(403) // pas habilité à accepter
    en(dirB)
    const liste = await (await lister(new NextRequest('http://test.local/api/validations') as never, ctx({}))).json()
    expect(liste.demandes.find((d: { id: string }) => d.id === j.demandeId)).toMatchObject({ peutDecider: true, type: 'ACCEPTATION_RISQUES_ANALYSE' })
    expect((await decider(j.demandeId, 'APPROUVER')).status).toBe(200)
    const a = await prisma.analyse.findUnique({ where: { id: analyseId } })
    expect(a).toMatchObject({ risquesResiduelsStatut: 'ACCEPTES', risquesResiduelsPar: dirA.id, risquesResiduelsCommentaire: 'Risque assumé jusqu’au T2' })
    expect((await decider(j.demandeId, 'APPROUVER')).status).toBe(409) // déjà tranchée
  })

  it('registre : ACCEPTE hors appétit → demande, statut inchangé ; approuvé par le gestionnaire des risques', async () => {
    en(rssi)
    const corps = { intitule: 'Fraude au virement', graviteResiduelle: 3, vraisemblanceResiduelle: 3, statut: 'ACCEPTE', description: 'Mise à jour' }
    const r = await patchRisque(req('PATCH', corps), ctx({ id: risqueId }))
    const j = await r.json()
    expect(r.status, JSON.stringify(j)).toBe(202)
    expect(await prisma.riskItem.findUnique({ where: { id: risqueId }, select: { statut: true, description: true } })).toEqual({ statut: 'TRAITE', description: 'Mise à jour' })
    en(rm)
    expect((await decider(j.demandeId, 'APPROUVER')).status).toBe(200)
    expect((await prisma.riskItem.findUnique({ where: { id: risqueId } }))!.statut).toBe('ACCEPTE')
  })

  it('registre : création directe au statut ACCEPTE hors appétit → enregistré EVALUE + demande (pas de contournement)', async () => {
    en(rssi)
    const r = await creerRisque(req('POST', { intitule: 'Rançongiciel', graviteResiduelle: 4, vraisemblanceResiduelle: 2, statut: 'ACCEPTE' }), ctx({}))
    const j = await r.json()
    expect(r.status, JSON.stringify(j)).toBe(201)
    expect(j).toMatchObject({ statut: 'EVALUE', doubleValidation: true })
    expect(await prisma.demandeValidation.count({ where: { cibleId: j.id, type: 'ACCEPTATION_RISQUE_REGISTRE', statut: 'EN_ATTENTE' } })).toBe(1)
  })

  it('contrat TIC critique : demande ; rejet motivé ; nouvelle demande approuvée → supprimé ; non critique : direct', async () => {
    const critique = await prisma.arrangementTic.create({ data: { organizationId: org.id, reference: 'C-CRIT', prestataireNom: 'Hébergeur cœur bancaire', criticite: 'CRITIQUE' } })
    const banal = await prisma.arrangementTic.create({ data: { organizationId: org.id, reference: 'C-STD', prestataireNom: 'Papeterie', criticite: 'NON_CRITIQUE' } })
    en(rssi)
    const r = await supprimerContrat(req('DELETE'), ctx({ id: critique.id }))
    const { demandeId } = await r.json()
    expect(r.status).toBe(202)
    en(rm)
    expect((await decider(demandeId, 'REJETER')).status).toBe(400) // motif requis
    expect((await decider(demandeId, 'REJETER', 'Contrat encore utilisé par la paie')).status).toBe(200)
    expect(await prisma.arrangementTic.count({ where: { id: critique.id } })).toBe(1)

    en(rssi)
    const r2 = await (await supprimerContrat(req('DELETE'), ctx({ id: critique.id }))).json()
    expect(r2.existante).toBe(false)
    en(rm)
    expect((await decider(r2.demandeId, 'APPROUVER')).status).toBe(200)
    expect(await prisma.arrangementTic.count({ where: { id: critique.id } })).toBe(0)

    en(rssi)
    expect((await supprimerContrat(req('DELETE'), ctx({ id: banal.id }))).status).toBe(200)
    expect(await prisma.arrangementTic.count({ where: { id: banal.id } })).toBe(0)
  })

  it('option désactivée : action directe', async () => {
    await prisma.organizationConfig.update({ where: { id: org.id }, data: { doubleValidationActive: false } })
    const c = await prisma.arrangementTic.create({ data: { organizationId: org.id, reference: 'C-CRIT2', prestataireNom: 'Cloud', criticite: 'CRITIQUE' } })
    en(rssi)
    expect((await supprimerContrat(req('DELETE'), ctx({ id: c.id }))).status).toBe(200)
    expect(await prisma.arrangementTic.count({ where: { id: c.id } })).toBe(0)
  })
})
