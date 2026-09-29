/**
 * audit-l4.ts — Audit interne, lot L4. Module PUR.
 *
 *  - notation de mission (échelle 1-4, libellés traduits / personnalisables) — B-AUD-5 ;
 *  - jalons du cycle de mission (lettre, ouverture, rapport provisoire, réponse de l'audité,
 *    clôture, rapport final) — B-AUD-2 ;
 *  - déclaration d'indépendance / conflit d'intérêts, tracée — B-AUD-7 ;
 *  - suivi des recommandations : déclaration « réalisée » par l'audité, VÉRIFICATION par l'audit
 *    (jamais la même personne), report d'échéance demandé puis approuvé/refusé — B-AUD-4 ;
 *  - univers d'audit coté par risque et plan pluriannuel (couverture, retards, plan par année)
 *    — B-AUD-1.
 * Les libellés sont traduits côté i18n ; les codes sont stables.
 */

// ─── Notation ────────────────────────────────────────────────────────────────

export const NOTATION_MIN = 1
export const NOTATION_MAX = 4

/** Note de mission : entier 1-4 ; hors échelle ou vide → null (non notée). */
export function cleanNotation(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) && n >= NOTATION_MIN && n <= NOTATION_MAX ? n : null
}

// ─── Jalons ──────────────────────────────────────────────────────────────────

export const JALONS = ['lettreMission', 'reunionOuverture', 'rapportProvisoire', 'reponseAudite', 'reunionCloture', 'rapportFinal'] as const
export type Jalon = (typeof JALONS)[number]
export type Jalons = Partial<Record<Jalon, string>>

/** Jalons nettoyés : seuls les six jalons connus, à date valide (ISO). */
export function cleanJalons(input: unknown): Jalons {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const o = input as Record<string, unknown>
  const out: Jalons = {}
  for (const j of JALONS) {
    const v = o[j]
    if (typeof v !== 'string' || !v) continue
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) out[j] = d.toISOString()
  }
  return out
}

/** Phase courante = dernier jalon atteint dans l'ordre du cycle. */
export function phaseCourante(j: Jalons): Jalon | null {
  for (let i = JALONS.length - 1; i >= 0; i--) if (j[JALONS[i]]) return JALONS[i]
  return null
}

// ─── Indépendance ────────────────────────────────────────────────────────────

export interface Independance { conflit: boolean; commentaire?: string; declarePar: string; declareLe: string }

/** Déclaration d'indépendance : un conflit d'intérêts exige un commentaire ; auteur et date posés par le serveur. */
export function cleanIndependance(input: unknown, ctx: { auteur: string; now: Date }): Independance | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  if (typeof o.conflit !== 'boolean') return null
  const commentaire = typeof o.commentaire === 'string' ? o.commentaire.trim().slice(0, 2000) : ''
  if (o.conflit && !commentaire) return null
  return { conflit: o.conflit, ...(commentaire ? { commentaire } : {}), declarePar: ctx.auteur, declareLe: ctx.now.toISOString() }
}

// ─── Suivi des recommandations ───────────────────────────────────────────────

export interface ReportEcheance {
  ancienne: string | null; nouvelle: string; motif: string; demandePar: string; demandeLe: string
  statut: 'DEMANDE' | 'APPROUVE' | 'REFUSE'; decidePar?: string; decideLe?: string
}
export interface SuiviCourant { statut: string; echeance: Date | null; echeanceInitiale: Date | null; reports: unknown; realiseePar: string | null }
export type SuiviCommande =
  | { action: 'DECLARER_REALISE' }
  | { action: 'VERIFIER'; commentaire?: string }
  | { action: 'REOUVRIR'; commentaire?: string }
  | { action: 'DEMANDER_REPORT'; nouvelleEcheance: string; motif: string }
  | { action: 'DECIDER_REPORT'; index: number; decision: 'APPROUVE' | 'REFUSE' }
export type SuiviErreur = 'transition_interdite' | 'role_audit_requis' | 'verification_meme_personne' | 'commentaire_requis' | 'echeance_invalide' | 'report_en_attente' | 'report_introuvable'
export type SuiviResultat = { ok: true; patch: Record<string, unknown> } | { ok: false; error: SuiviErreur }

const ouvert = (s: string) => s === 'OUVERT' || s === 'EN_COURS'
export function sanitizeReports(v: unknown): ReportEcheance[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((r): ReportEcheance[] => {
    if (!r || typeof r !== 'object') return []
    const o = r as Record<string, unknown>
    if (typeof o.nouvelle !== 'string' || typeof o.motif !== 'string' || typeof o.demandePar !== 'string' || typeof o.demandeLe !== 'string') return []
    const statut = o.statut === 'APPROUVE' || o.statut === 'REFUSE' ? o.statut : 'DEMANDE'
    return [{ ancienne: typeof o.ancienne === 'string' ? o.ancienne : null, nouvelle: o.nouvelle, motif: o.motif, demandePar: o.demandePar, demandeLe: o.demandeLe, statut,
      ...(typeof o.decidePar === 'string' ? { decidePar: o.decidePar } : {}), ...(typeof o.decideLe === 'string' ? { decideLe: o.decideLe } : {}) }]
  })
}

/**
 * Applique une commande de suivi à une recommandation. L'AUDITÉ déclare la réalisation et demande un
 * report ; l'AUDIT vérifie (jamais la personne qui l'a déclarée réalisée), rouvre (motif obligatoire) et
 * décide des reports. Renvoie le patch à persister ou un code d'erreur stable.
 */
export function appliquerSuivi(c: SuiviCourant, cmd: SuiviCommande, ctx: { acteur: string; auditeur: boolean; now: Date }): SuiviResultat {
  const now = ctx.now.toISOString()
  switch (cmd.action) {
    case 'DECLARER_REALISE':
      if (!ouvert(c.statut)) return { ok: false, error: 'transition_interdite' }
      return { ok: true, patch: { statut: 'RESOLU', realiseePar: ctx.acteur, realiseeLe: ctx.now } }
    case 'VERIFIER': {
      if (c.statut !== 'RESOLU') return { ok: false, error: 'transition_interdite' }
      if (!ctx.auditeur) return { ok: false, error: 'role_audit_requis' }
      if (c.realiseePar && c.realiseePar === ctx.acteur) return { ok: false, error: 'verification_meme_personne' }
      const com = (cmd.commentaire ?? '').trim()
      return { ok: true, patch: { statut: 'VERIFIE', verifiePar: ctx.acteur, verifieLe: ctx.now, verificationCommentaire: com || null } }
    }
    case 'REOUVRIR': {
      if (c.statut !== 'RESOLU' && c.statut !== 'VERIFIE') return { ok: false, error: 'transition_interdite' }
      if (!ctx.auditeur) return { ok: false, error: 'role_audit_requis' }
      const com = (cmd.commentaire ?? '').trim()
      if (!com) return { ok: false, error: 'commentaire_requis' }
      return { ok: true, patch: { statut: 'EN_COURS', verifiePar: null, verifieLe: null, verificationCommentaire: com, realiseePar: null, realiseeLe: null } }
    }
    case 'DEMANDER_REPORT': {
      if (!ouvert(c.statut)) return { ok: false, error: 'transition_interdite' }
      const motif = (cmd.motif ?? '').trim()
      if (!motif) return { ok: false, error: 'commentaire_requis' }
      const nouvelle = new Date(cmd.nouvelleEcheance)
      if (Number.isNaN(nouvelle.getTime()) || nouvelle.getTime() <= (c.echeance ?? ctx.now).getTime()) return { ok: false, error: 'echeance_invalide' }
      const reports = sanitizeReports(c.reports)
      if (reports.some(r => r.statut === 'DEMANDE')) return { ok: false, error: 'report_en_attente' }
      reports.push({ ancienne: c.echeance ? c.echeance.toISOString() : null, nouvelle: nouvelle.toISOString(), motif: motif.slice(0, 2000), demandePar: ctx.acteur, demandeLe: now, statut: 'DEMANDE' })
      return { ok: true, patch: { reports } }
    }
    case 'DECIDER_REPORT': {
      if (!ctx.auditeur) return { ok: false, error: 'role_audit_requis' }
      const reports = sanitizeReports(c.reports)
      const r = reports[cmd.index]
      if (!r || r.statut !== 'DEMANDE') return { ok: false, error: 'report_introuvable' }
      reports[cmd.index] = { ...r, statut: cmd.decision, decidePar: ctx.acteur, decideLe: now }
      const patch: Record<string, unknown> = { reports }
      if (cmd.decision === 'APPROUVE') { patch.echeance = new Date(r.nouvelle); patch.echeanceInitiale = c.echeanceInitiale ?? c.echeance }
      return { ok: true, patch }
    }
  }
}

export interface RecoLite { statut: string; criticite: number | null; echeance: Date | null; createdAt: Date; reports: unknown; source: string }
export interface RecosSynthese {
  total: number; ouvertes: number; realisees: number; verifiees: number; acceptees: number; enRetard: number
  reportees: number; reportsEnAttente: number
  ancienneteMoyenneJours: number; plusAncienneJours: number
  tauxMiseEnOeuvre: number | null; tauxVerification: number | null
  parCriticite: Record<number, number>; parSource: Record<string, number>
}

/** Synthèse du suivi des recommandations : mise en œuvre, vérification, retards, reports, ancienneté. */
export function synthetiserRecommandations(recos: RecoLite[], now: Date): RecosSynthese {
  const s: RecosSynthese = { total: recos.length, ouvertes: 0, realisees: 0, verifiees: 0, acceptees: 0, enRetard: 0, reportees: 0, reportsEnAttente: 0,
    ancienneteMoyenneJours: 0, plusAncienneJours: 0, tauxMiseEnOeuvre: null, tauxVerification: null, parCriticite: {}, parSource: {} }
  const ages: number[] = []
  for (const r of recos) {
    if (ouvert(r.statut)) {
      s.ouvertes++
      ages.push(Math.max(0, Math.floor((now.getTime() - r.createdAt.getTime()) / 86_400_000)))
      if (r.echeance && r.echeance.getTime() < now.getTime()) s.enRetard++
    } else if (r.statut === 'RESOLU') s.realisees++
    else if (r.statut === 'VERIFIE') s.verifiees++
    else if (r.statut === 'ACCEPTE') s.acceptees++
    // Comptage tolérant : seul le statut du report compte pour la synthèse.
    const reports = (Array.isArray(r.reports) ? r.reports : []).filter((x): x is { statut?: string } => !!x && typeof x === 'object')
    if (reports.some(x => x.statut === 'APPROUVE')) s.reportees++
    s.reportsEnAttente += reports.filter(x => x.statut === 'DEMANDE').length
    if (r.criticite) s.parCriticite[r.criticite] = (s.parCriticite[r.criticite] ?? 0) + 1
    s.parSource[r.source] = (s.parSource[r.source] ?? 0) + 1
  }
  if (ages.length) { s.ancienneteMoyenneJours = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length); s.plusAncienneJours = Math.max(...ages) }
  const cible = s.total - s.acceptees
  s.tauxMiseEnOeuvre = cible > 0 ? Math.round(((s.realisees + s.verifiees) / cible) * 100) : null
  s.tauxVerification = s.realisees + s.verifiees > 0 ? Math.round((s.verifiees / (s.realisees + s.verifiees)) * 100) : null
  return s
}

// ─── Univers d'audit et plan pluriannuel ─────────────────────────────────────

export const UNIVERS_TYPES = ['PROCESSUS', 'ENTITE', 'REFERENTIEL', 'AUTRE'] as const
export type UniversType = (typeof UNIVERS_TYPES)[number]
export interface UniversInput { intitule: string; type: UniversType; risque: number; cycleAns: number | null; processusId: string | null; commentaire: string | null; actif: boolean }

/** Entrée d'univers normalisée : type connu, risque 1-4 (défaut 2), cycle 1-10 ans ou null (défaut selon le risque). */
export function cleanUniversInput(body: Record<string, unknown>): UniversInput {
  const risque = Number(body.risque)
  const cycle = Number(body.cycleAns)
  const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    intitule: String(body.intitule ?? '').trim(),
    type: (UNIVERS_TYPES as readonly string[]).includes(body.type as string) ? (body.type as UniversType) : 'AUTRE',
    risque: Number.isInteger(risque) && risque >= 1 && risque <= 4 ? risque : 2,
    cycleAns: Number.isInteger(cycle) && cycle >= 1 && cycle <= 10 ? cycle : null,
    processusId: txt(body.processusId),
    commentaire: txt(body.commentaire),
    actif: body.actif !== false,
  }
}

/** Cycle de couverture par défaut (années) selon la cotation de risque : 4 → 1, 3 → 2, 2 → 3, 1 → 5. */
export function cycleAnsDefaut(risque: number, surcharge?: Record<number, number>): number {
  return surcharge?.[risque] ?? ({ 4: 1, 3: 2, 2: 3, 1: 5 } as Record<number, number>)[risque] ?? 3
}

export interface UniversLite { id: string; intitule: string; type: string; risque: number; cycleAns: number | null; actif: boolean; processusId: string | null }
export interface MissionPlan { id: string; statut: string; dateDebut: Date | null; dateFin: Date | null; processusIds: string[]; universIds: string[] }
export type StatutCouverture = 'A_JOUR' | 'A_PLANIFIER' | 'PLANIFIE' | 'EN_RETARD' | 'JAMAIS_AUDITE'
export interface EntreePlan { universId: string; derniere: string | null; cycleAns: number; prochaine: string | null; statut: StatutCouverture; planifiee: string | null }
export interface PlanPluriannuel {
  entrees: EntreePlan[]
  synthese: { total: number; aJour: number; aPlanifier: number; planifie: number; enRetard: number; jamais: number; couverturePct: number | null }
  parAnnee: { annee: number; universIds: string[] }[]
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
function ajouterAns(d: Date, n: number): Date {
  const r = new Date(d.getTime()); r.setUTCFullYear(r.getUTCFullYear() + n); return r
}

/**
 * Plan pluriannuel : pour chaque entrée active de l'univers, dernière couverture (mission clôturée ou
 * en cours), prochaine échéance selon le cycle, statut (jamais audité / en retard / planifié / à planifier
 * dans les 12 mois / à jour), et charge du plan par année (les retards sont dus dès l'année en cours).
 */
export function planPluriannuel(univers: UniversLite[], missions: MissionPlan[], now: Date, opts: { horizonAns?: number; cycles?: Record<number, number> } = {}): PlanPluriannuel {
  const horizon = opts.horizonAns ?? 3
  const dans12Mois = ajouterAns(now, 1).getTime()
  const entrees: EntreePlan[] = []
  for (const u of univers) {
    if (!u.actif) continue
    const couvre = (m: MissionPlan) => m.universIds.includes(u.id) || (u.processusId !== null && m.processusIds.includes(u.processusId))
    const mm = missions.filter(couvre)
    const passees = mm.flatMap(m => (m.statut === 'CLOTUREE' ? [m.dateFin ?? m.dateDebut] : m.statut === 'EN_COURS' ? [m.dateDebut] : [])).filter((d): d is Date => !!d)
    const futures = mm.filter(m => m.statut === 'PLANIFIEE' && m.dateDebut && m.dateDebut.getTime() > now.getTime()).map(m => m.dateDebut as Date)
    const derniere = passees.length ? new Date(Math.max(...passees.map(d => d.getTime()))) : null
    const planifiee = futures.length ? new Date(Math.min(...futures.map(d => d.getTime()))) : null
    const cycleAns = u.cycleAns ?? cycleAnsDefaut(u.risque, opts.cycles)
    const prochaine = derniere ? ajouterAns(derniere, cycleAns) : null
    let statut: StatutCouverture
    if (!derniere || !prochaine) statut = 'JAMAIS_AUDITE'
    else if (prochaine.getTime() < now.getTime()) statut = 'EN_RETARD'
    else if (planifiee && planifiee.getTime() <= prochaine.getTime()) statut = 'PLANIFIE'
    else if (prochaine.getTime() <= dans12Mois) statut = 'A_PLANIFIER'
    else statut = 'A_JOUR'
    entrees.push({ universId: u.id, derniere: derniere ? iso(derniere) : null, cycleAns, prochaine: prochaine ? iso(prochaine) : null, statut, planifiee: planifiee ? iso(planifiee) : null })
  }
  const n = (s: StatutCouverture) => entrees.filter(e => e.statut === s).length
  const total = entrees.length
  const anneeCourante = now.getUTCFullYear()
  const parAnnee = Array.from({ length: horizon }, (_, k) => ({ annee: anneeCourante + k, universIds: [] as string[] }))
  for (const e of entrees) {
    const annee = e.statut === 'EN_RETARD' || e.statut === 'JAMAIS_AUDITE' ? anneeCourante : Number((e.prochaine ?? '').slice(0, 4))
    const cible = parAnnee.find(a => a.annee === annee)
    if (cible) cible.universIds.push(e.universId)
  }
  return {
    entrees, parAnnee,
    synthese: { total, aJour: n('A_JOUR'), aPlanifier: n('A_PLANIFIER'), planifie: n('PLANIFIE'), enRetard: n('EN_RETARD'), jamais: n('JAMAIS_AUDITE'),
      couverturePct: total ? Math.round(((total - n('EN_RETARD') - n('JAMAIS_AUDITE')) / total) * 100) : null },
  }
}
