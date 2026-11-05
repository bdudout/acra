// ─── Scénarios « sévères mais plausibles » d'une fonction critique ou importante (validation pure) ──────────────────
// Durée d'interruption estimée (minutes) comparée à la tolérance d'impact du processus (lib/dependances-critiques).
// Testé : scenarios-severes.test.ts.
export interface ScenarioSaisi { intitule: string; description: string | null; dureeInterruptionMinutes: number; mesures: string | null; dateEvaluation: Date | null }
type Erreur = 'intitule_requis' | 'duree_invalide' | 'date_invalide'
const texte = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export function lireScenario(body: Record<string, unknown>): { ok: true; data: ScenarioSaisi } | { ok: false; error: Erreur } {
  const intitule = texte(body.intitule, 300)
  if (!intitule) return { ok: false, error: 'intitule_requis' }
  const d = Number(body.dureeInterruptionMinutes)
  if (body.dureeInterruptionMinutes === '' || body.dureeInterruptionMinutes == null || !Number.isInteger(d) || d < 0 || d > 525_600) return { ok: false, error: 'duree_invalide' }
  let dateEvaluation: Date | null = null
  if (typeof body.dateEvaluation === 'string' && body.dateEvaluation) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateEvaluation)) return { ok: false, error: 'date_invalide' }
    dateEvaluation = new Date(`${body.dateEvaluation}T00:00:00.000Z`)
    if (Number.isNaN(dateEvaluation.getTime())) return { ok: false, error: 'date_invalide' }
  }
  return { ok: true, data: { intitule, description: texte(body.description, 4000), dureeInterruptionMinutes: d, mesures: texte(body.mesures, 4000), dateEvaluation } }
}
