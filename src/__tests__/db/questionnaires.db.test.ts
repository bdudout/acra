/**
 * Questionnaires de contrôle, de bout en bout sur une vraie base : modèle « exigences à justifier »,
 * envoi au métier, réponse avec preuve, revue par le contrôleur, préconisation, plan d'action par le
 * métier, acceptation du risque, et effet sur la conformité constatée.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeOrg, makeUser } from './helpers'

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string; name?: string }, activeOrg: undefined as string | undefined }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.user ? { user: session.user } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'acra_org' && session.activeOrg ? { value: session.activeOrg } : undefined) }), headers: async () => new Headers() }))

import { POST as postModele } from '@/app/api/questionnaires/modeles/route'
import { POST as postEnvoi } from '@/app/api/questionnaires/envois/route'
import { GET as getMes } from '@/app/api/questionnaires/mes-reponses/route'
import { GET as getReponse, PUT as putReponse } from '@/app/api/questionnaires/reponses/[id]/route'
import { POST as soumettre } from '@/app/api/questionnaires/reponses/[id]/soumettre/route'
import { POST as reviser } from '@/app/api/questionnaires/reponses/[id]/revue/route'
import { POST as postPreco } from '@/app/api/preconisations/route'
import { POST as suivi } from '@/app/api/preconisations/[id]/suivi/route'
import { POST as planAction } from '@/app/api/preconisations/[id]/plan-action/route'
import { GET as couverture } from '@/app/api/referentiels/couverture/route'
import { GET as rapportControle } from '@/app/api/controles/campagnes/[id]/rapport-controle/route'
import JSZip from 'jszip'

const req = (body?: unknown, url = 'http://test.local/api') => new Request(url, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never
const p = (id: string) => ({ params: Promise.resolve({ id }) })
const pdf = { nom: 'preuve.pdf', mime: 'application/pdf', taille: 4, dataUrl: 'data:application/pdf;base64,AAAA' }
let org: { id: string }, controleur: { id: string }, metier: { id: string }, autre: { id: string }
const as = (u: { id: string }, role = 'ANALYSTE') => { session.user = { id: u.id, role, name: u.id === metier.id ? 'Métier' : 'Contrôleur' } }

beforeAll(async () => {
  org = await makeOrg('Questionnaires')
  await prisma.organizationConfig.create({ data: { id: org.id, controlePermanentActive: true, secondeLigneActive: true, conformiteActive: true } })
  controleur = await makeUser('ANALYSTE', [{ id: org.id, role: 'RISK_MANAGER' }])
  metier = await makeUser('ANALYSTE', [{ id: org.id, role: 'ANALYSTE' }])
  autre = await makeUser('ANALYSTE', [{ id: org.id, role: 'ANALYSTE' }])
  session.activeOrg = org.id
})
afterAll(async () => { await prisma.$disconnect() })

describe('questionnaires de contrôle (vraie base)', () => {
  let reponseId = '', precoId = ''

  it('le contrôleur crée un modèle depuis des exigences ISO 27001 et l’envoie au métier ; un métier ne peut pas créer de modèle', async () => {
    as(metier)
    expect((await postModele(req({ titre: 'x', mode: 'EXIGENCES', referentielCode: 'ISO27001', exigenceRefs: ['5.15'] }))).status).toBe(403)
    as(controleur)
    const m = await postModele(req({ titre: 'Accès', mode: 'EXIGENCES', referentielCode: 'ISO27001', exigenceRefs: ['5.15', '8.2', 'inconnue'] }))
    expect(m.status).toBe(201)
    const { modele } = await m.json()
    expect(modele.questions).toHaveLength(2)
    expect((await postEnvoi(req({ modeleId: modele.id, repondantIds: ['compte-etranger'] }))).status).toBe(400)
    expect((await postEnvoi(req({ modeleId: modele.id, repondantIds: [metier.id] }))).status).toBe(201)
  })

  it('le métier voit son questionnaire, enregistre un brouillon, et ne peut soumettre qu’avec les preuves requises', async () => {
    as(metier)
    const { reponses } = await (await getMes()).json()
    expect(reponses).toHaveLength(1)
    reponseId = reponses[0].id
    const { envoi } = await (await getReponse(req(), p(reponseId))).json()
    const [q1, q2] = envoi.questions
    await putReponse(req({ reponses: [{ questionId: q1.id, valeur: true }, { questionId: q2.id, valeur: false }] }), p(reponseId))
    const refus = await soumettre(req({}), p(reponseId))
    expect(refus.status).toBe(400)
    expect((await refus.json()).questions).toEqual([q1.id, q2.id])
    await putReponse(req({ reponses: [{ questionId: q1.id, valeur: true, preuves: [pdf] }, { questionId: q2.id, valeur: false, commentaire: 'Revue non faite', preuves: [pdf] }] }), p(reponseId))
    expect((await soumettre(req({}), p(reponseId))).status).toBe(200)
    expect((await putReponse(req({ reponses: [] }), p(reponseId))).status).toBe(409) // figée après soumission
  })

  it('un autre métier ne voit pas la réponse ; le répondant ne peut pas se réviser lui-même', async () => {
    as(autre)
    expect((await getReponse(req(), p(reponseId))).status).toBe(404)
    as(metier)
    expect((await reviser(req({ revues: [] }), p(reponseId))).status).toBe(403)
  })

  it('le contrôleur revoit : 8.2 non conforme ⇒ la conformité ISO 27001 constate une anomalie', async () => {
    as(controleur)
    const { envoi } = await (await getReponse(req(), p(reponseId))).json()
    const [q1, q2] = envoi.questions
    const r = await reviser(req({ revues: [{ questionId: q1.id, statut: 'ACCEPTEE' }, { questionId: q2.id, statut: 'NON_CONFORME', commentaire: 'Aucune revue des privilèges' }] }), p(reponseId))
    expect((await r.json()).statut).toBe('REVUE')
    const cov = await (await couverture(req(undefined, 'http://test.local/api/referentiels/couverture?code=ISO27001'))).json()
    expect(cov.parExigence.find((e: { ref: string }) => e.ref === '8.2')).toMatchObject({ statut: 'ANOMALIE', nbAnomaliesControle: 1 })
    expect(cov.parExigence.find((e: { ref: string }) => e.ref === '5.15').statut).toBe('NON_COUVERT')
  })

  it('préconisation depuis la réponse : reprend l’exigence et le métier comme responsable, sans double comptage', async () => {
    as(controleur)
    const { envoi } = await (await getReponse(req(), p(reponseId))).json()
    const res = await postPreco(req({ intitule: 'Mettre en place la revue des privilèges', criticite: 3, reponseId, questionId: envoi.questions[1].id }))
    expect(res.status).toBe(201)
    const { preconisation } = await res.json()
    precoId = preconisation.id
    expect(preconisation).toMatchObject({ referentielCode: 'ISO27001', exigenceRef: '8.2', responsableId: metier.id, statut: 'OUVERT' })
    const cov = await (await couverture(req(undefined, 'http://test.local/api/referentiels/couverture?code=ISO27001'))).json()
    expect(cov.parExigence.find((e: { ref: string }) => e.ref === '8.2').nbAnomaliesControle).toBe(1)
  })

  it('le métier répond par un plan d’action lié à la préconisation et, s’il le souhaite, à la conformité', async () => {
    as(autre)
    expect((await planAction(req({}), p(precoId))).status).toBe(404)
    as(metier)
    const res = await planAction(req({ lierConformite: true }), p(precoId))
    expect(res.status).toBe(201)
    const { planAction: pa } = await res.json()
    const liens = await prisma.planActionLien.findMany({ where: { planActionId: pa.id }, orderBy: { type: 'asc' } })
    expect(liens.map(l => [l.type, l.targetId, l.ref])).toEqual([['CONFORMITE', 'ISO27001', '8.2'], ['PRECONISATION', precoId, null]])
    expect((await prisma.preconisation.findUniqueOrThrow({ where: { id: precoId } })).statut).toBe('EN_COURS')
  })

  it('acceptation du risque par le métier, suivie dans la conformité ; l’exigence n’est plus en anomalie', async () => {
    as(metier)
    expect((await suivi(req({ action: 'ACCEPTER_RISQUE' }), p(precoId))).status).toBe(400)
    const res = await suivi(req({ action: 'ACCEPTER_RISQUE', justification: 'Compensé par la revue trimestrielle du SOC', lierConformite: true }), p(precoId))
    const body = await res.json()
    expect(body.statut).toBe('ACCEPTE')
    const t = await prisma.conformiteTraitement.findUniqueOrThrow({ where: { id: body.traitementId } })
    expect(t).toMatchObject({ type: 'ACCEPTATION_RISQUE', referentiel: 'ISO27001', statut: 'ACTIVE' })
    expect(t.refs).toEqual(['8.2'])
    as(controleur)
    const cov = await (await couverture(req(undefined, 'http://test.local/api/referentiels/couverture?code=ISO27001'))).json()
    expect(cov.parExigence.find((e: { ref: string }) => e.ref === '8.2').statut).toBe('NON_COUVERT')
  })
  it('rapport de contrôle de la mission : 2ᵉ ligne seulement, compile questionnaires, non-conformités et préconisations', async () => {
    const mission = await prisma.campagneControle.create({ data: { organizationId: org.id, intitule: 'Mission accès', niveau: 'N2', statut: 'EN_COURS' } })
    await prisma.questionnaireEnvoi.updateMany({ where: { organizationId: org.id }, data: { campagneId: mission.id } })
    await prisma.preconisation.update({ where: { id: precoId }, data: { campagneId: mission.id } })
    as(metier)
    expect((await rapportControle(req(), p(mission.id))).status).toBe(403)
    as(controleur)
    expect((await rapportControle(req(), p('inconnue'))).status).toBe(404)
    const res = await rapportControle(req(), p(mission.id))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('rapport-controle-mission-acces.docx')
    const xml = await (await JSZip.loadAsync(await res.arrayBuffer())).file('word/document.xml')!.async('string')
    expect(xml).toContain('Mission accès')
    expect(xml).toContain('ISO27001 8.2')
    expect(xml).toContain('Compensé par la revue trimestrielle du SOC')
  })
})
