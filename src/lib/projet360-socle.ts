// ─── Risques présents par défaut dans tout projet 360 (PUR) ───────────────────
// Un projet porte presque toujours les mêmes risques de base (délais, budget, ressources, adhésion, RGPD, prestataire,
// sécurité, mise en service) : ils sont créés avec le projet, supprimables un à un. L'administrateur de l'organisation
// en désactive et en ajoute dans Configuration › Projets (`OrganizationConfig.risquesProjetDefaut`, hérité).
// Marqués par `Risque.qualificationRuleId = "socle:<code>"` (pas de doublon, badge « par défaut »).
// Testé : projet360-socle.test.ts.

import type { Locale } from '@/lib/i18n'
import { isDomaine360, type Domaine360 } from '@/lib/projet360'

type Tr = readonly [fr: string, en: string, de: string, es: string, it: string]
const L = (fr: string, en: string, de: string, es: string, it: string): Tr => [fr, en, de, es, it]
const IDX: Record<Locale, number> = { fr: 0, en: 1, de: 2, es: 3, it: 4 }

export const SOCLE_RULE_PREFIX = 'socle:'
export const SOCLE_MAX_AJOUTES = 30

export interface RisqueSocle { code: string; domaine: Domaine360; gravite: number; vraisemblance: number; intitule: Tr }

export const RISQUES_PROJET_SOCLE: readonly RisqueSocle[] = [
  { code: 'PROJ_DELAIS', domaine: 'PROJECT', gravite: 3, vraisemblance: 3,
    intitule: L('Dérive du planning : le projet ne tient pas ses jalons', 'Schedule slippage: the project misses its milestones', 'Terminverzug: Das Projekt hält seine Meilensteine nicht ein', 'Desviación del calendario: el proyecto no cumple sus hitos', 'Slittamento della pianificazione: il progetto non rispetta le milestone') },
  { code: 'PROJ_BUDGET', domaine: 'PROJECT', gravite: 3, vraisemblance: 2,
    intitule: L('Dépassement du budget du projet', 'Project budget overrun', 'Überschreitung des Projektbudgets', 'Sobrecoste del presupuesto del proyecto', 'Superamento del budget del progetto') },
  { code: 'PROJ_RESSOURCES', domaine: 'PROJECT', gravite: 3, vraisemblance: 2,
    intitule: L('Indisponibilité ou départ de compétences clés du projet', 'Unavailability or departure of key project skills', 'Ausfall oder Weggang von Schlüsselkompetenzen des Projekts', 'Indisponibilidad o salida de competencias clave del proyecto', 'Indisponibilità o uscita di competenze chiave del progetto') },
  { code: 'PROJ_ADHESION', domaine: 'BUSINESS', gravite: 2, vraisemblance: 3,
    intitule: L('Adhésion insuffisante des utilisateurs, conduite du changement mal préparée', 'Insufficient user buy-in, poorly prepared change management', 'Unzureichende Akzeptanz bei den Nutzern, schlecht vorbereitetes Change-Management', 'Adhesión insuficiente de los usuarios, gestión del cambio mal preparada', 'Adesione insufficiente degli utenti, gestione del cambiamento mal preparata') },
  { code: 'PROJ_RGPD', domaine: 'BUSINESS', gravite: 3, vraisemblance: 2,
    intitule: L('Traitement de données personnelles non conforme au RGPD (registre, information des personnes, analyse d’impact)', 'Processing of personal data not compliant with the GDPR (records, information of data subjects, impact assessment)', 'Verarbeitung personenbezogener Daten nicht DSGVO-konform (Verzeichnis, Information der Betroffenen, Folgenabschätzung)', 'Tratamiento de datos personales no conforme con el RGPD (registro, información a los interesados, evaluación de impacto)', 'Trattamento di dati personali non conforme al GDPR (registro, informativa agli interessati, valutazione d’impatto)') },
  { code: 'PROJ_PRESTATAIRE', domaine: 'OUTSOURCING', gravite: 3, vraisemblance: 2,
    intitule: L('Défaillance d’un prestataire ou d’un fournisseur clé du projet', 'Failure of a key project provider or supplier', 'Ausfall eines wichtigen Dienstleisters oder Lieferanten des Projekts', 'Fallo de un proveedor o suministrador clave del proyecto', 'Inadempienza di un fornitore chiave del progetto') },
  { code: 'PROJ_SECURITE', domaine: 'CYBER', gravite: 3, vraisemblance: 2,
    intitule: L('Exigences de sécurité non prises en compte dans le projet (conception, tests, homologation)', 'Security requirements not addressed in the project (design, testing, accreditation)', 'Sicherheitsanforderungen im Projekt nicht berücksichtigt (Konzeption, Tests, Freigabe)', 'Requisitos de seguridad no tenidos en cuenta en el proyecto (diseño, pruebas, homologación)', 'Requisiti di sicurezza non considerati nel progetto (progettazione, test, omologazione)') },
  { code: 'PROJ_MISE_EN_SERVICE', domaine: 'IT', gravite: 3, vraisemblance: 2,
    intitule: L('Mise en service perturbée : reprise de données incomplète ou retour arrière impossible', 'Disrupted go-live: incomplete data migration or no possible rollback', 'Gestörte Inbetriebnahme: unvollständige Datenübernahme oder kein Rückfall möglich', 'Puesta en servicio perturbada: migración de datos incompleta o vuelta atrás imposible', 'Messa in servizio disturbata: migrazione dei dati incompleta o ritorno indietro impossibile') },
]
const CODES = new Set(RISQUES_PROJET_SOCLE.map(r => r.code))

export interface RisqueSocleAjoute { id: string; intitule: string; domaine: Domaine360 | null; gravite: number; vraisemblance: number }
export interface SocleConfig { desactives: string[]; ajoutes: RisqueSocleAjoute[] }

const borne = (v: unknown, max: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(1, n)) : 2
}

/** Configuration assainie : codes connus, risques ajoutés bornés (identifiant généré si absent), 30 au plus. */
export function sanitizeSocleConfig(input: unknown): SocleConfig {
  const o = input && typeof input === 'object' ? input as { desactives?: unknown; ajoutes?: unknown } : {}
  const desactives = [...new Set((Array.isArray(o.desactives) ? o.desactives : []).filter((c): c is string => typeof c === 'string' && CODES.has(c)))]
  const ajoutes: RisqueSocleAjoute[] = []
  const ids = new Set<string>()
  for (const [i, raw] of (Array.isArray(o.ajoutes) ? o.ajoutes : []).entries()) {
    if (!raw || typeof raw !== 'object') continue
    const a = raw as Record<string, unknown>
    const intitule = typeof a.intitule === 'string' ? a.intitule.trim().slice(0, 200) : ''
    if (!intitule) continue
    let id = typeof a.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(a.id) ? a.id : `r${i + 1}`
    while (ids.has(id)) id = `${id}_`
    ids.add(id)
    ajoutes.push({ id, intitule, domaine: isDomaine360(a.domaine) ? a.domaine : null, gravite: borne(a.gravite, 5), vraisemblance: borne(a.vraisemblance, 5) })
    if (ajoutes.length >= SOCLE_MAX_AJOUTES) break
  }
  return { desactives, ajoutes }
}

export interface RisqueSocleResolu { ruleId: string; nom: string; domaine: Domaine360 | null; gravite: number; vraisemblance: number }

/** Risques par défaut effectifs pour une organisation : catalogue − désactivés + ajoutés, cotation bornée à l'échelle. */
export function risquesSocle(cfg: SocleConfig, locale: Locale, nbNiveaux: number): RisqueSocleResolu[] {
  const off = new Set(cfg.desactives)
  const i = IDX[locale] ?? 0
  return [
    ...RISQUES_PROJET_SOCLE.filter(r => !off.has(r.code)).map(r => ({ ruleId: `${SOCLE_RULE_PREFIX}${r.code}`, nom: r.intitule[i], domaine: r.domaine, gravite: Math.min(r.gravite, nbNiveaux), vraisemblance: Math.min(r.vraisemblance, nbNiveaux) })),
    ...cfg.ajoutes.map(a => ({ ruleId: `${SOCLE_RULE_PREFIX}custom:${a.id}`, nom: a.intitule, domaine: a.domaine, gravite: Math.min(a.gravite, nbNiveaux), vraisemblance: Math.min(a.vraisemblance, nbNiveaux) })),
  ]
}

/** Sans doublon : une règle déjà présente dans le projet, ou un intitulé déjà saisi, n'est pas recréé. */
export function planSocle(risques: readonly RisqueSocleResolu[], existingRuleIds: readonly string[], existingTitles: readonly string[]): RisqueSocleResolu[] {
  const rules = new Set(existingRuleIds)
  const titres = new Set(existingTitles.map(t => t.trim().toLocaleLowerCase()))
  return risques.filter(r => !rules.has(r.ruleId) && !titres.has(r.nom.trim().toLocaleLowerCase()))
}

export const estRisqueSocle = (ruleId: string | null | undefined) => typeof ruleId === 'string' && ruleId.startsWith(SOCLE_RULE_PREFIX)
