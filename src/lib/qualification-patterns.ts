// ─── Qualification pré-répondue d'après les patterns (recette n° 17) — PUR ────
// Formulaire « Nouvelle analyse » : les patterns d'architecture cochés répondent d'office à certaines questions de
// qualification (SaaS / cloud → externalisation ; exposition Internet → exposé ; SI de très petite entreprise → pas de
// RSSI dédié). Une réponse donnée ou modifiée par l'utilisateur n'est jamais écrasée ; décocher le pattern retire la
// pré-réponse restée intacte. Testé : qualification-patterns.test.ts.
import type { QualificationAnswers } from '@/lib/qualification'

const PREREPONSES: Record<string, QualificationAnswers> = {
  CLOUD_SAAS: { externalisation: true }, CLOUD_IAAS_PAAS: { externalisation: true },
  EXPOSITION_INTERNET: { expositionInternet: true },
  SI_TPE: { rssiInterne: false },
}

export function qualificationDepuisPatterns(patterns: readonly string[]): QualificationAnswers {
  return Object.assign({}, ...patterns.map(p => PREREPONSES[p] ?? {}))
}

/** `auto` : pré-réponses posées au tour précédent ; une réponse qui en diffère a été saisie par l'utilisateur. */
export function appliquerQualificationPatterns(answers: QualificationAnswers, auto: QualificationAnswers, patterns: readonly string[]): { answers: QualificationAnswers; auto: QualificationAnswers } {
  const cible = qualificationDepuisPatterns(patterns)
  const out: QualificationAnswers = { ...answers }
  const intacte = (k: string) => k in auto && out[k] === auto[k]
  for (const k of Object.keys(auto)) if (intacte(k) && !(k in cible)) delete out[k]
  const nouvelAuto: QualificationAnswers = {}
  for (const [k, v] of Object.entries(cible)) {
    if (k in out && !intacte(k)) continue
    out[k] = v; nouvelAuto[k] = v
  }
  return { answers: out, auto: nouvelAuto }
}

/** L'organisation active a-t-elle des sous-entités parmi les organisations accessibles (chemin matérialisé) ? */
export function aDesSousEntites(options: readonly { id: string; path: string }[], activeOrgId: string | null | undefined): boolean {
  const active = options.find(o => o.id === activeOrgId)
  return !!active && options.some(o => o.id !== active.id && o.path.startsWith(active.path))
}
