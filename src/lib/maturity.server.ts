// ─── Maturité (profils cibles CMMI) — accès serveur ───────────────────────────
// Point unique pour les routes /api/maturite et la page /maturite : contexte
// (session → org active → rôle effectif → module ACTIF, sinon 404) et chargement
// d'un profil. Le profil N'EST PAS un objet à part : c'est la couche `maturites`
// du suivi `Conformite` org-wide (entite = "") du référentiel. La logique
// décidable (échelle, fusion, écarts, synthèse) est dans la lib pure `maturity.ts`.

import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { getAnalyseScope } from './org-context.server'
import { getOrgConfig } from './org-config.server'
import { peutEvaluerMaturite, type UserRole } from './permissions'
import { listReferentiels, getExigencesFor } from './referentiel.server'
import { getFrameworkCategories } from './frameworks-data'
import { sanitizeConformite, type ConformiteStatut } from './conformite'
import type { Locale, Translations } from './i18n'
import {
  MATURITY_LEVELS, resolveMaturityScale, sanitizeMaturites, maturityStats, summarizeRefActions, isMaturityLevel,
  type Maturites, type MaturityScaleLevel, type MaturityStats, type RefActionSummary,
} from './maturity'

export interface MaturityContext { userId: string; role: UserRole; orgId: string; canManage: boolean }

/** Contexte d'accès : 401 sans session ; 404 sans org active ou module inactif (valeur effective). */
export async function maturityContext(): Promise<{ ok: true; ctx: MaturityContext } | { ok: false; status: 401 | 404 }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, status: 401 }
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId) return { ok: false, status: 404 }
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.profilsOperationnelsActive) return { ok: false, status: 404 }
  return { ok: true, ctx: { userId, role: scope.role, orgId: scope.activeOrgId, canManage: peutEvaluerMaturite(scope.role) } }
}

/** Échelle CMMI par défaut, libellés de la langue courante. */
export function defaultMaturityScale(t: Translations): MaturityScaleLevel[] {
  const levels = t.maturite.levels as Record<string, { libelle: string; definition: string }>
  return MATURITY_LEVELS.map(n => ({ niveau: n, libelle: levels[n]?.libelle ?? String(n), definition: levels[n]?.definition ?? '' }))
}

/** Échelle effective de l'organisation (personnalisation héritée sur le défaut i18n). */
export async function orgMaturityScale(orgId: string, t: Translations): Promise<MaturityScaleLevel[]> {
  const cfg = await getOrgConfig(orgId)
  return resolveMaturityScale(cfg.echelleMaturite, defaultMaturityScale(t))
}

/** Référentiels évaluables en maturité : ceux, actifs, de la conformité de l'org. */
export async function maturityReferentiels(orgId: string, locale: Locale) {
  const all = await listReferentiels(orgId, locale)
  return all
    .filter(r => r.actif && r.code !== 'CUSTOM')
    .map(r => ({ code: r.code, nom: r.version ? `${r.nom} (${r.version})` : r.nom }))
}

export interface MaturityItem { ref: string; nom: string; description: string; categorie: string }

export interface LoadedMaturityProfile {
  referentiel: string
  conformiteId: string | null
  items: MaturityItem[]
  categories: Record<string, string>
  maturites: Maturites
  maturiteCible: number | null
  /** Statut de conformité du même point, affiché à côté (couche indépendante). */
  conformite: Record<string, ConformiteStatut>
  stats: MaturityStats
  actions: Record<string, RefActionSummary>
  updatedAt: string | null
}

/** Profil de maturité d'un référentiel pour l'organisation (vierge si jamais évalué). */
export async function loadMaturityProfile(orgId: string, referentiel: string, locale: Locale, now = new Date()): Promise<LoadedMaturityProfile> {
  const exigences = await getExigencesFor(referentiel, orgId, locale)
  const items: MaturityItem[] = exigences.map(e => ({ ref: e.ref, nom: e.nom, description: e.description ?? '', categorie: e.categorie || '—' }))
  const refs = new Set(items.map(i => i.ref))
  const cats = getFrameworkCategories(referentiel, locale)
  const categories: Record<string, string> = {}
  for (const i of items) categories[i.categorie] ??= cats[i.categorie]?.label ?? i.categorie

  const row = await prisma.conformite.findUnique({
    where: { organizationId_referentiel_entite: { organizationId: orgId, referentiel, entite: '' } },
    select: { id: true, entries: true, maturites: true, maturiteCible: true, updatedAt: true },
  })
  const maturites = sanitizeMaturites(row?.maturites, refs)
  const maturiteCible = isMaturityLevel(row?.maturiteCible) ? row!.maturiteCible : null
  const conformite: Record<string, ConformiteStatut> = {}
  for (const e of sanitizeConformite(row?.entries, refs)) conformite[e.ref] = e.statut

  const actionRows = await prisma.planAction.findMany({
    where: { organizationId: orgId, liens: { some: { type: 'CONFORMITE', targetId: referentiel } } },
    select: { statut: true, echeance: true, liens: { where: { type: 'CONFORMITE', targetId: referentiel }, select: { ref: true } } },
  })

  return {
    referentiel, conformiteId: row?.id ?? null, items, categories, maturites, maturiteCible, conformite,
    stats: maturityStats(items, maturites, maturiteCible),
    actions: summarizeRefActions(actionRows, now),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  }
}
