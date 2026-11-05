// ─── Bibliothèque de contrôles : lectures LÉGÈRES partagées (lot V1) ─────────
// Partagées par GET /api/controles et l'outil MCP read_controles. Les agrégats d'exécutions sont calculés PAR LA BASE
// (une ligne par contrôle : dernière réalisation, exécutions évaluées et conformes) au lieu de charger toutes les
// exécutions. Toujours bornées à `orgId` ; la visibilité selon le rôle (acces-resultats) reste à l'appelant.
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { prochaineEcheance, etatEcheance, type Periodicite, type EtatEcheance } from '@/lib/controle'

export interface AgregatExecutions { derniere: Date | null; evaluees: number; conformes: number }

export async function agregatsExecutions(orgId: string): Promise<Map<string, AgregatExecutions>> {
  const rows = await prisma.$queryRaw<{ controleId: string; derniere: Date | null; evaluees: bigint; conformes: bigint }[]>(Prisma.sql`
    SELECT "controleId", max("dateRealisation") AS derniere,
           count(*) FILTER (WHERE resultat IN ('CONFORME', 'ANOMALIE')) AS evaluees,
           count(*) FILTER (WHERE resultat = 'CONFORME') AS conformes
    FROM "ControleExecution" WHERE "organizationId" = ${orgId} GROUP BY "controleId"`)
  return new Map(rows.map(r => [r.controleId, { derniere: r.derniere, evaluees: Number(r.evaluees), conformes: Number(r.conformes) }]))
}

export interface ControleLeger {
  id: string; intitule: string; responsable: string | null; niveau: string; referentielCode: string | null; actif: boolean
  periodicite: string; createdAt: Date; derniere: Date | null; echeance: Date; etatEcheance: EtatEcheance | null; anomalies: number
}

/** Contrôles de l'organisation (actifs d'abord) avec échéance, état et nombre d'anomalies. `visible` : filtre de rôle. */
export async function chargerControlesLegers(
  orgId: string, now: Date, visible: <T extends { responsable: string | null }>(l: T[]) => T[] = l => l,
): Promise<ControleLeger[]> {
  const [bruts, agg] = await Promise.all([
    prisma.controle.findMany({
      where: { organizationId: orgId },
      orderBy: [{ actif: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, intitule: true, responsable: true, niveau: true, referentielCode: true, actif: true, periodicite: true, createdAt: true },
    }),
    agregatsExecutions(orgId),
  ])
  return visible(bruts).map(c => {
    const a = agg.get(c.id)
    const derniere = a?.derniere ?? null
    const echeance = prochaineEcheance(c.periodicite as Periodicite, derniere, c.createdAt)
    return { ...c, derniere, echeance, etatEcheance: c.actif ? etatEcheance(echeance, now) : null, anomalies: a ? a.evaluees - a.conformes : 0 }
  })
}
