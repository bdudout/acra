// ─── RAS / RAD — chargement serveur (vue /appetence) ─────────────────────────
// Assemble, pour l'organisation active et ses modules ACTIFS, la déclaration
// d'appétence (seuils d'appétit, niveaux de maturité visés) et son tableau de bord
// (risques du registre hors appétit, écarts de maturité, KRI en alerte). Réutilise
// les moteurs existants : ras-export (appétit), maturity (profils), kri.

import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { niveauRisque } from './risk-item'
import { resolveTaxonomie, taxonomieLabel } from './taxonomie'
import { cleanAppetitConfig } from './appetit'
import { buildRasExport } from './ras-export'
import { evaluerKri, synthetiserKri, type KriSens, type KriStatut } from './kri'
import { sanitizeMaturites, maturityStats, isMaturityLevel } from './maturity'
import { maturityReferentiels } from './maturity.server'
import { getExigencesFor } from './referentiel.server'
import { voyantAppetit, voyantMaturite, voyantKri, voyantGlobal, type Voyant } from './ras-rad'
import type { Locale, Translations } from './i18n'

export async function loadRasRad(orgId: string, locale: Locale, t: Translations) {
  const cfg = await getOrgConfig(orgId)
  const voyants: Voyant[] = []

  // ── Appétit (registre des risques) ──
  let appetit = null as null | (ReturnType<typeof buildRasExport> & { voyant: Voyant })
  if (cfg.registreRisquesActive) {
    const rows = await prisma.riskItem.findMany({
      where: { organizationId: orgId },
      select: { intitule: true, taxonomieCode: true, graviteResiduelle: true, vraisemblanceResiduelle: true },
    })
    const tr = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? ''
    const taxonomie = resolveTaxonomie(cfg.taxonomieRisques)
    const labelOf = (code: string) => { const n = taxonomie.find(x => x.code === code); return (n ? taxonomieLabel(n, tr) : null) ?? code }
    const data = buildRasExport(rows.map(r => ({
      intitule: r.intitule, taxonomieCode: r.taxonomieCode ?? null,
      niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
    })), cleanAppetitConfig(cfg.appetitRisque), labelOf)
    appetit = { ...data, depassements: data.depassements.slice(0, 10), voyant: voyantAppetit(data.synthese) }
    voyants.push(appetit.voyant)
  }

  // ── Maturité (profils cibles) ──
  const maturite: { code: string; nom: string; cible: number | null; averageCurrent: number | null; averageTarget: number | null; belowTarget: number; assessed: number; total: number; voyant: Voyant }[] = []
  if (cfg.profilsOperationnelsActive) {
    const rows = await prisma.conformite.findMany({
      where: { organizationId: orgId, entite: '' },
      select: { referentiel: true, maturites: true, maturiteCible: true },
    })
    const noms = new Map((await maturityReferentiels(orgId, locale)).map(r => [r.code, r.nom]))
    for (const row of rows) {
      const hasProfile = isMaturityLevel(row.maturiteCible) || Object.keys(sanitizeMaturites(row.maturites)).length > 0
      if (!hasProfile || !noms.has(row.referentiel)) continue
      const items = (await getExigencesFor(row.referentiel, orgId, locale)).map(e => ({ ref: e.ref, categorie: e.categorie || '—' }))
      const s = maturityStats(items, sanitizeMaturites(row.maturites, new Set(items.map(i => i.ref))), row.maturiteCible)
      const voyant = voyantMaturite(s)
      maturite.push({ code: row.referentiel, nom: noms.get(row.referentiel)!, cible: row.maturiteCible, averageCurrent: s.averageCurrent, averageTarget: s.averageTarget, belowTarget: s.belowTarget, assessed: s.assessed, total: s.total, voyant })
      voyants.push(voyant)
    }
  }

  // ── KRI ──
  let kri = null as null | { total: number; alerte: number; critique: number; enAlerte: { intitule: string; statut: KriStatut; valeur: number | null; unite: string | null }[]; voyant: Voyant }
  if (cfg.kriActive) {
    const rows = await prisma.kri.findMany({
      where: { organizationId: orgId, actif: true },
      select: { intitule: true, unite: true, sens: true, seuilAlerte: true, seuilCritique: true, mesures: { orderBy: { dateMesure: 'desc' }, take: 1, select: { valeur: true } } },
    })
    const evals = rows.map(k => {
      const valeur = k.mesures[0]?.valeur ?? null
      return { intitule: k.intitule, unite: k.unite, valeur, statut: evaluerKri(valeur, { sens: k.sens as KriSens, seuilAlerte: k.seuilAlerte, seuilCritique: k.seuilCritique }) }
    })
    const s = synthetiserKri(evals)
    kri = {
      total: s.total, alerte: s.alerte, critique: s.critique,
      enAlerte: evals.filter(e => e.statut === 'CRITIQUE' || e.statut === 'ALERTE').sort((a, b) => (a.statut === 'CRITIQUE' ? -1 : 1) - (b.statut === 'CRITIQUE' ? -1 : 1)).slice(0, 10),
      voyant: voyantKri(s),
    }
    voyants.push(kri.voyant)
  }

  return { appetit, maturite, kri, global: voyantGlobal(voyants), modules: { actif: cfg.appetenceActive, registre: cfg.registreRisquesActive, maturite: cfg.profilsOperationnelsActive, kri: cfg.kriActive } }
}
