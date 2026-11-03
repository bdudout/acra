// ─── Risques proposés (registre TIC, résilience) : lecture, validation, écart — accès base ─────────────────────────
// Logique décidable dans lib/propositions-risques-tic (pure, testée). Ici : chargement borné à l'organisation,
// déduplication (écartées : PropositionRisqueEcartee ; validées : RiskItem sourceType proposition-tic), création du
// risque par la même normalisation que la saisie au registre (cleanRiskItem), journal d'audit et webhook.
// Les droits (peutTraiterPropositionsRisquesTic) et l'activation des modules sont vérifiés par la route.
import { prisma } from '@/lib/prisma'
import type { Translations } from '@/lib/i18n'
import type { UserRole } from '@/lib/permissions'
import { auditLog } from '@/lib/logger'
import { emitWebhookEvent } from '@/lib/webhook.server'
import { cleanRiskItem } from '@/lib/risk-item'
import { chargerFonctionsCritiques } from '@/lib/dependances-critiques.server'
import {
  calculerPropositionsRisquesTic, propositionsOuvertes, libellerProposition, SOURCE_PROPOSITION_TIC, type PropositionRisqueTic,
} from '@/lib/propositions-risques-tic'

/** Propositions encore à traiter de l'organisation (ni écartées, ni validées). */
export async function propositionsOuvertesOrg(orgId: string): Promise<PropositionRisqueTic[]> {
  const [{ fonctions }, contrats, ecartees, validees] = await Promise.all([
    chargerFonctionsCritiques(orgId),
    prisma.arrangementTic.findMany({
      where: { organizationId: orgId, criticite: { in: ['CRITIQUE', 'IMPORTANTE'] } },
      orderBy: { reference: 'asc' },
      select: { id: true, reference: true, prestataireNom: true, criticite: true, strategieSortie: true },
    }),
    prisma.propositionRisqueEcartee.findMany({ where: { organizationId: orgId }, select: { cle: true } }),
    prisma.riskItem.findMany({ where: { organizationId: orgId, sourceType: SOURCE_PROPOSITION_TIC, sourceId: { not: null } }, select: { sourceId: true } }),
  ])
  const toutes = calculerPropositionsRisquesTic({ fonctions, contrats, maintenant: new Date() })
  return propositionsOuvertes(toutes, { ecartees: ecartees.map(e => e.cle), validees: validees.map(v => v.sourceId!) })
}

interface Acteur { orgId: string; cle: string; userId: string; role: UserRole; ip?: string }
type Resultat<T> = { ok: true; value: T } | { ok: false; status: 404 | 409 }
const CONFLIT = { ok: false, status: 409 } as const
const estDoublon = (e: unknown) => (e as { code?: unknown } | null)?.code === 'P2002'

/**
 * Valide une proposition ouverte : crée le risque au registre (org de la proposition). 404 si la clé n'est pas ouverte
 * dans l'organisation ; 409 si elle a été écartée ou validée entre-temps (transaction + index unique partiel).
 */
export async function validerPropositionTic(a: Acteur, t: Translations): Promise<Resultat<{ id: string; intitule: string }>> {
  const p = (await propositionsOuvertesOrg(a.orgId)).find(x => x.cle === a.cle)
  if (!p) return { ok: false, status: 404 }
  const { intitule, description } = libellerProposition(p, t)
  const data = cleanRiskItem({
    intitule, description, familleRisqueTic: p.famille, processusId: p.processusId,
    graviteInherente: p.gravite, vraisemblanceInherente: p.vraisemblance, statut: 'IDENTIFIE', provenance: 'MANUEL',
  })
  let risk: { id: string; intitule: string } | null
  try {
    risk = await prisma.$transaction(async tx => {
      const ecartee = await tx.propositionRisqueEcartee.findUnique({ where: { organizationId_cle: { organizationId: a.orgId, cle: p.cle } }, select: { id: true } })
      if (ecartee) return null
      return tx.riskItem.create({ data: { ...data, organizationId: a.orgId, sourceType: SOURCE_PROPOSITION_TIC, sourceId: p.cle } })
    })
  } catch (e) {
    if (estDoublon(e)) return CONFLIT
    throw e
  }
  if (!risk) return CONFLIT
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: a.userId, userRole: a.role, ip: a.ip, details: { scope: 'risk-item', action: 'create', id: risk.id, intitule: risk.intitule, origine: 'proposition-tic', cle: p.cle } })
  await emitWebhookEvent(a.orgId, 'risk.created', { id: risk.id, intitule: risk.intitule })
  return { ok: true, value: { id: risk.id, intitule: risk.intitule } }
}

/**
 * Écarte une proposition ouverte (idempotent sur la clé). 404 si la clé n'est pas ouverte dans l'organisation ; 409 si
 * un risque a été créé entre-temps pour cette clé (une proposition validée ne s'écarte pas).
 */
export async function ecarterPropositionTic(a: Acteur): Promise<Resultat<{ cle: string }>> {
  const p = (await propositionsOuvertesOrg(a.orgId)).find(x => x.cle === a.cle)
  if (!p) return { ok: false, status: 404 }
  const fait = await prisma.$transaction(async tx => {
    const valide = await tx.riskItem.findFirst({ where: { organizationId: a.orgId, sourceType: SOURCE_PROPOSITION_TIC, sourceId: p.cle }, select: { id: true } })
    if (valide) return false
    await tx.propositionRisqueEcartee.upsert({
      where: { organizationId_cle: { organizationId: a.orgId, cle: p.cle } },
      create: { organizationId: a.orgId, cle: p.cle, ecartePar: a.userId },
      update: {},
    })
    return true
  })
  if (!fait) return CONFLIT
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: a.userId, userRole: a.role, ip: a.ip, details: { scope: 'proposition-risque-tic', action: 'dismiss', cle: p.cle } })
  return { ok: true, value: { cle: p.cle } }
}
