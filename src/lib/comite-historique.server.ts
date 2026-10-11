// ─── Photo mensuelle des indicateurs du dossier de comité (tendance ↑↓) ──────
// Le 1er du mois (cron `comite-snapshots`) : indicateurs des trois dossiers (risques, conformité, incidents) de chaque
// organisation dont le registre des risques est actif, figés tels quels (état de fin du mois précédent). Jamais écrasée.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { gatherGrcConsolide } from './grc-consolide.server'
import { buildComitePack, COMITE_TYPES, valeursPack } from './comite-pack'

const periodeDe = (d: Date) => d.toISOString().slice(0, 7)

/** Prend la photo du mois si elle n'existe pas ; null si le module est inactif ou la photo déjà prise. */
export async function capturerPhotoComite(orgId: string, now: Date = new Date()): Promise<{ cree: true } | null> {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.registreRisquesActive) return null
  const { consolide, modules } = await gatherGrcConsolide(orgId, cfg, now)
  const valeurs = valeursPack(COMITE_TYPES.map(t => buildComitePack(t, consolide, modules)))
  try {
    await prisma.comiteSnapshot.create({ data: { organizationId: orgId, periode: periodeDe(now), valeurs } })
    return { cree: true }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null // déjà prise ce mois-ci
    throw e
  }
}

/** Photo du mois en cours (prise le 1er : état de fin du mois précédent), référence de la tendance du dossier. */
export async function photoDuMois(orgId: string, now: Date = new Date()): Promise<Record<string, number> | null> {
  const p = await prisma.comiteSnapshot.findUnique({ where: { organizationId_periode: { organizationId: orgId, periode: periodeDe(now) } }, select: { valeurs: true } })
  if (!p || !p.valeurs || typeof p.valeurs !== 'object' || Array.isArray(p.valeurs)) return null
  return Object.fromEntries(Object.entries(p.valeurs as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === 'number'))
}
