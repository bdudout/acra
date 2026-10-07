// ─── Vue globale des plans d'audit et de contrôle — logique PURE (lot P5) ─────
// Indicateurs de la vue commune à tous les plans (docs/specs/programme-audit-controle.md §5) :
//  • sollicitations multiples : entité, filiale ou tiers visé par au moins deux lignes de l'année (tous plans confondus),
//    « simultanée » si deux périodes se chevauchent ; lignes annulées ou reportées écartées ;
//  • angles morts : risques critiques ou majeurs (palier « élevé » ou « critique », cotation inhérente à défaut résiduelle)
//    et processus critiques ou importants (criticité 3-4 ou DORA critique / important) non audités ni contrôlés depuis le
//    seuil (défaut 3 ans) ou jamais ; ceux qui figurent dans un plan à venir sont signalés « prévus ».
// Testé : planification-vue.test.ts.
import { getRiskTier } from './risk-scale'
import { niveauRisque } from './risk-item'

export interface Periode { debut: string | null; fin: string | null }

/** Deux périodes (AAAA-MM-JJ, bornes incluses) se chevauchent-elles ? Sans date de début : non ; sans fin : un jour. */
export function periodesSeChevauchent(a: Periode, b: Periode): boolean {
  if (!a.debut || !b.debut) return false
  const finA = a.fin ?? a.debut, finB = b.fin ?? b.debut
  return a.debut <= finB && b.debut <= finA
}

export interface LigneVue {
  ligneId: string; planId: string; planNom: string; type: 'AUDIT' | 'CONTROLE'; intitule: string
  debut: string | null; fin: string | null; statutManuel: string | null; priorite?: number | null
  cibles: { organisations?: string[]; tiers?: string[]; risques?: string[]; processus?: string[] }
}
export interface Sollicitation {
  id: string; nom: string; nombre: number; plans: number; simultanee: boolean
  lignes: { ligneId: string; planNom: string; intitule: string; debut: string | null; fin: string | null }[]
}

const actives = (lignes: LigneVue[]) => lignes.filter(l => l.statutManuel !== 'ANNULEE' && l.statutManuel !== 'REPORTEE')

function regrouper(lignes: LigneVue[], cle: 'organisations' | 'tiers', noms: Record<string, string>): Sollicitation[] {
  const parCible = new Map<string, LigneVue[]>()
  for (const l of actives(lignes)) for (const id of new Set(l.cibles[cle] ?? [])) parCible.set(id, [...(parCible.get(id) ?? []), l])
  return [...parCible.entries()]
    .filter(([, ls]) => ls.length >= 2)
    .map(([id, ls]) => ({
      id, nom: noms[id] ?? id, nombre: ls.length, plans: new Set(ls.map(l => l.planId)).size,
      simultanee: ls.some((a, i) => ls.slice(i + 1).some(b => periodesSeChevauchent(a, b))),
      lignes: ls.map(l => ({ ligneId: l.ligneId, planNom: l.planNom, intitule: l.intitule, debut: l.debut, fin: l.fin })),
    }))
    .sort((a, b) => Number(b.simultanee) - Number(a.simultanee) || b.nombre - a.nombre || a.nom.localeCompare(b.nom))
}

/** Entités, filiales et tiers sollicités plusieurs fois dans l'année (simultanément en tête). */
export function sollicitationsMultiples(lignes: LigneVue[], noms: Record<string, string>) {
  return { organisations: regrouper(lignes, 'organisations', noms), tiers: regrouper(lignes, 'tiers', noms) }
}

export interface RisqueSource { id: string; intitule?: string; graviteInherente?: number | null; vraisemblanceInherente?: number | null; graviteResiduelle?: number | null; vraisemblanceResiduelle?: number | null }
export interface ProcessusSource { id: string; nom?: string; criticite: number | null; criticiteDora: string | null }

const niveauDe = (r: Omit<RisqueSource, 'id'>): number | null => niveauRisque(r.graviteInherente, r.vraisemblanceInherente) ?? niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle)

/** Risque critique ou majeur : palier « élevé » ou « critique » (cotation inhérente, à défaut résiduelle). */
export function risqueCritiqueOuMajeur(r: Omit<RisqueSource, 'id'>): boolean {
  const n = niveauDe(r)
  if (n == null) return false
  const palier = getRiskTier(n)
  return palier === 'critique' || palier === 'eleve'
}

/** Processus critique ou important : criticité 3-4 ou fonction critique / importante au sens de DORA. */
export function processusCritiqueOuImportant(p: Omit<ProcessusSource, 'id'>): boolean {
  return (p.criticite ?? 0) >= 3 || p.criticiteDora === 'CRITIQUE' || p.criticiteDora === 'IMPORTANTE'
}

export interface AngleMortRisque { id: string; nom: string; niveau: number; derniere: string | null; prevu: boolean }
export interface AngleMortProcessus { id: string; nom: string; criticite: number | null; criticiteDora: string | null; derniere: string | null; prevu: boolean }

/** Éléments sensibles non couverts depuis `seuilAns` (ou jamais), jamais couverts puis les plus anciens d'abord. */
export function anglesMorts(input: {
  maintenant: Date; seuilAns: number; risques: RisqueSource[]; processus: ProcessusSource[]
  dernieresCouvertures: { risques: Record<string, string>; processus: Record<string, string> }
  prevus: { risques: string[]; processus: string[] }
}): { risques: AngleMortRisque[]; processus: AngleMortProcessus[] } {
  const limite = new Date(input.maintenant)
  limite.setUTCFullYear(limite.getUTCFullYear() - input.seuilAns)
  const borne = limite.toISOString().slice(0, 10)
  const nonCouvert = (d: string | undefined) => !d || d < borne
  const tri = <T extends { derniere: string | null; nom: string }>(a: T, b: T) =>
    (a.derniere ?? '') < (b.derniere ?? '') ? -1 : (a.derniere ?? '') > (b.derniere ?? '') ? 1 : a.nom.localeCompare(b.nom)
  const prevusR = new Set(input.prevus.risques), prevusP = new Set(input.prevus.processus)
  return {
    risques: input.risques
      .filter(r => risqueCritiqueOuMajeur(r) && nonCouvert(input.dernieresCouvertures.risques[r.id]))
      .map(r => ({ id: r.id, nom: r.intitule ?? r.id, niveau: niveauDe(r) as number, derniere: input.dernieresCouvertures.risques[r.id] ?? null, prevu: prevusR.has(r.id) }))
      .sort(tri),
    processus: input.processus
      .filter(p => processusCritiqueOuImportant(p) && nonCouvert(input.dernieresCouvertures.processus[p.id]))
      .map(p => ({ id: p.id, nom: p.nom ?? p.id, criticite: p.criticite, criticiteDora: p.criticiteDora, derniere: input.dernieresCouvertures.processus[p.id] ?? null, prevu: prevusP.has(p.id) }))
      .sort(tri),
  }
}
