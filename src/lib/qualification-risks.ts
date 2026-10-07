// ─── Risques proposés par la qualification (PUR) ─────────────────────────────
// Décisions de la fonctionnalité « risques proposés/imposés selon la
// qualification » (cf. docs/specs/qualification-risques-defaut.md), sans DB :
//  - localisation du catalogue par défaut (titres traduits, jamais codés en dur) ;
//  - plan de création : sélection ∪ risques IMPOSÉS, idempotent PAR RÈGLE ;
//  - canal : EBIOS RM → proposé en atelier 5 ; méthodes directes → registre.

import type { QualificationRiskProposalItem } from '@/lib/qualification'
import { SOCLE_EQUIVALENTS, SOCLE_RULE_PREFIX } from '@/lib/projet360-socle'

/** Textes traduits du catalogue : t.qualification.riskCatalog. */
export type QualificationRiskCatalogTexts = Record<string, { title: string; description?: string }>

/** Risque proposé prêt à afficher/créer : intitulé et description résolus dans la langue. */
export type LocalizedQualificationRisk = Omit<QualificationRiskProposalItem, 'titleKey'> & { description?: string }

/**
 * Résout l'intitulé/la description : règle du catalogue (titleKey) → texte traduit ;
 * règle personnalisée → texte saisi par l'admin. Un texte admin non vide prime.
 */
export function localizeQualificationRisks(items: QualificationRiskProposalItem[], catalog: QualificationRiskCatalogTexts): LocalizedQualificationRisk[] {
  return items.map(({ titleKey, ...item }) => {
    const text = titleKey ? catalog[titleKey] : undefined
    return {
      ...item,
      title: item.title.trim() || text?.title || titleKey || item.id,
      description: item.description?.trim() || text?.description || undefined,
    }
  })
}

/** Motif d'exclusion d'une proposition lors de la création. */
export type QualificationRiskSkip = { id: string; reason: 'NOT_SELECTED' | 'ALREADY_CREATED' }

/**
 * Plan de création : les propositions SÉLECTIONNÉES + toutes les propositions
 * IMPOSÉES (non décochables), moins celles déjà créées pour la même règle
 * (idempotence analyse × règle). Les identifiants inconnus sont ignorés.
 */
export function planQualificationRiskCreation<T extends { id: string; mandatory: boolean }>(args: {
  proposals: T[]; selectedIds: readonly string[]; existingRuleIds: readonly string[]
}): { toCreate: T[]; skipped: QualificationRiskSkip[] } {
  const selected = new Set(args.selectedIds)
  const existing = new Set(args.existingRuleIds)
  const toCreate: T[] = []
  const skipped: QualificationRiskSkip[] = []
  for (const p of args.proposals) {
    if (existing.has(p.id)) skipped.push({ id: p.id, reason: 'ALREADY_CREATED' })
    else if (p.mandatory || selected.has(p.id)) toCreate.push(p)
    else skipped.push({ id: p.id, reason: 'NOT_SELECTED' })
  }
  return { toCreate, skipped }
}

/** Intitulé comparable : minuscules, sans accents, apostrophes unifiées, espaces réduits. */
const normaliserIntitule = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Propositions déjà présentes dans l'analyse, à ne pas reproposer : même règle, même intitulé (risque saisi ou importé
 * d'une analyse cyber), ou risque par défaut équivalent encore présent (SOCLE_EQUIVALENTS).
 */
export function propositionsDejaPresentes(
  proposals: readonly { id: string; title: string }[],
  risques: readonly { nom: string; qualificationRuleId: string | null }[],
): Set<string> {
  const regles = new Set(risques.flatMap(r => (r.qualificationRuleId ? [r.qualificationRuleId] : [])))
  const titres = new Set(risques.map(r => normaliserIntitule(r.nom)))
  for (const [code, equivalents] of Object.entries(SOCLE_EQUIVALENTS)) {
    if (regles.has(`${SOCLE_RULE_PREFIX}${code}`)) for (const id of equivalents) regles.add(id)
  }
  return new Set(proposals.filter(p => regles.has(p.id) || titres.has(normaliserIntitule(p.title))).map(p => p.id))
}

/** Propositions encore en attente (règle pas encore créée dans l'analyse). */
export function pendingQualificationRisks<T extends { id: string }>(proposals: T[], existingRuleIds: readonly string[]): T[] {
  const existing = new Set(existingRuleIds)
  return proposals.filter(p => !existing.has(p.id))
}

/**
 * Où proposer les risques : EBIOS RM (méthode par défaut) → atelier 5, où les
 * risques naissent des scénarios ; méthodes à saisie directe → registre de risques.
 */
export function qualificationRiskChannel(methode: string | null | undefined): 'ATELIER5' | 'DIRECT' {
  return !methode || methode === 'EBIOS_RM' ? 'ATELIER5' : 'DIRECT'
}

/**
 * EBIOS RM — convertit une proposition en ligne de risque de l'atelier 5 (état
 * local, persisté par l'auto-save de l'atelier). Sans scénario rattaché : l'analyste
 * le relie ensuite à un scénario opérationnel / événement redouté. Résiduel = brut
 * tant que le traitement n'est pas défini.
 */
export function qualificationRiskToAtelier5Risk(
  p: { id: string; title: string; description?: string; gravity: number; likelihood: number; strategy: string },
  rowId: string,
) {
  const g = Math.max(1, Math.min(4, Math.round(p.gravity) || 2))
  const v = Math.max(1, Math.min(4, Math.round(p.likelihood) || 2))
  return {
    id: rowId, nom: p.title, description: p.description ?? '', qualificationRuleId: p.id,
    scenarioOpId: '', scenarioOpNom: '', evenementRedouteRef: '',
    gravite: g, vraisemblance: v, niveauRisque: g * v, strategie: p.strategy,
    vulnerabilitesResiduelles: [], facteursAggravants: [],
    graviteResiduelle: g, vraisemblanceResiduelle: v, niveauResiduel: g * v, justificationResiduelle: '',
  }
}

/**
 * Normalise `qualificationRuleId` d'un lot de risques avant écriture : la
 * contrainte unique analyse × règle ferait échouer TOUTE la sauvegarde en cas de
 * doublon (payload client). On garde la règle sur la 1ʳᵉ occurrence, null ensuite.
 */
export function dedupeQualificationRuleIds<T extends { qualificationRuleId?: unknown }>(rows: T[]): (T & { qualificationRuleId: string | null })[] {
  const seen = new Set<string>()
  return rows.map(r => {
    const raw = typeof r.qualificationRuleId === 'string' ? r.qualificationRuleId.trim().slice(0, 80) : ''
    const keep = raw && !seen.has(raw) ? raw : null
    if (keep) seen.add(keep)
    return { ...r, qualificationRuleId: keep }
  })
}
