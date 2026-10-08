// ─── Import vers le référentiel des entités (consolidation, lot E2) — moteur d'aperçu PUR ──────────────────────────────
// Chaque ligne (fichier CSV / XLSX ou connecteur) reçoit un statut expliqué : nouvelle, renommée (même identifiant externe),
// inchangée (même nom, alias ou code), doublon probable (nom proche : créée seulement sur confirmation) ou rejetée (raison).
// Les entités importées absentes d'une liste complète sont signalées « disparues » : leur clôture est proposée, jamais
// automatique. Spec : docs/specs/entites-consolidation-besoin.md (§ 2.2).
import { correspondances, normaliserNom, NOM_MAX, estActive, type EntiteRef, type TypeEntite } from './entites'

export const MAX_LIGNES_IMPORT_ENTITES = 2000

export interface LigneImportEntite { line: number; nom: string; code?: string; type?: string; parent?: string; alias?: string }
export type StatutImport = 'NOUVELLE' | 'RENOMMEE' | 'INCHANGEE' | 'DOUBLON_PROBABLE' | 'REJETEE'
export type RaisonRejet = 'nom_requis' | 'code_en_double' | 'parent_inconnu' | 'boucle' | 'parent_rejete'

export interface LignePlanifiee {
  line: number; statut: StatutImport; raison?: RaisonRejet
  nom: string; code?: string; type: TypeEntite; alias: string[]
  /** Entité existante concernée (renommée, inchangée, ou candidate d'un doublon probable). */
  entiteId?: string; ancienNom?: string
  /** Doublon probable d'une autre ligne du fichier. */
  doublonDeLigne?: number
  /** Parent : ligne du fichier ou entité existante ; absent = racine. */
  parentLigne?: number; parentExistantId?: string
}
export interface PlanImportEntites {
  lignes: LignePlanifiee[]
  /** Lignes à créer, parents avant enfants. */
  aCreer: LignePlanifiee[]
  aRenommer: { id: string; nom: string; ancienNom: string }[]
  disparues: { id: string; nom: string }[]
  aClore: string[]
  compte: Record<StatutImport, number>
}
export interface OptionsImport {
  typeParDefaut: TypeEntite
  /** Le fichier ou le connecteur contient la liste complète : les entités importées absentes sont « disparues ». */
  listeComplete?: boolean
  /** Lignes de doublon probable dont l'administrateur confirme la création. */
  creerQuandMeme?: number[]
  /** Renommages retenus (ids) ; absent = tous. */
  renommer?: string[]
  /** Entités disparues à clore (ids). */
  clore?: string[]
}

export function mapEntiteColumns(headers: string[]): { nom?: string; code?: string; type?: string; parent?: string; alias?: string } {
  const out: { nom?: string; code?: string; type?: string; parent?: string; alias?: string } = {}
  const used = new Set<string>()
  const take = (field: keyof typeof out, test: (h: string) => boolean) => {
    const found = headers.find(h => !used.has(h) && test(normaliserNom(h)))
    if (found) { out[field] = found; used.add(found) }
  }
  take('parent', h => h.includes('parent') || h.includes('rattach'))
  take('code', h => h === 'code' || h.startsWith('code ') || h.includes('external id') || h.includes('identifiant externe') || h.includes('id externe') || /^(ref|reference|id|matricule|lei)( |$)/.test(h))
  take('nom', h => ['nom', 'name', 'entite', 'entity', 'libelle', 'label', 'intitule'].some(k => h === k || h.startsWith(`${k} `)) || h.endsWith(' name'))
  take('type', h => ['type', 'categorie', 'category', 'nature'].some(k => h === k || h.startsWith(`${k} `)))
  take('alias', h => ['alias', 'aliases', 'synonymes', 'synonyms', 'autres noms', 'other names'].includes(h))
  return out
}

const TYPES_LIBELLES: Record<TypeEntite, string[]> = {
  FILIALE: ['filiale', 'subsidiary', 'tochtergesellschaft', 'filial', 'controllata', 'societe', 'company', 'entite juridique', 'legal entity'],
  DIRECTION: ['direction', 'departement', 'department', 'division', 'direktion', 'abteilung', 'direccion', 'direzione', 'pole'],
  SITE: ['site', 'sede', 'standort', 'etablissement', 'establishment', 'location', 'agence', 'branch'],
  SERVICE: ['service', 'servizio', 'servicio', 'dienst', 'team', 'equipe', 'unite', 'unit'],
  AUTRE: ['autre', 'other', 'sonstige', 'otra', 'altro'],
}
export function lireType(libelle: string | undefined, parDefaut: TypeEntite): TypeEntite {
  const n = normaliserNom(libelle ?? '')
  if (!n) return parDefaut
  for (const [type, libelles] of Object.entries(TYPES_LIBELLES) as [TypeEntite, string[]][]) if (n === type.toLowerCase() || libelles.includes(n)) return type
  return parDefaut
}

const lireAlias = (s?: string) => (s ?? '').split(/[;|]/).map(a => a.trim().slice(0, NOM_MAX)).filter(Boolean)

/** Aperçu de l'import, sans écriture. */
export function planifierImportEntites(lignesBrutes: LigneImportEntite[], existantes: EntiteRef[], opts: OptionsImport): PlanImportEntites {
  const parCodeExistant = new Map(existantes.filter(e => e.codeExterne).map(e => [normaliserNom(e.codeExterne!), e]))
  const lignes: LignePlanifiee[] = []
  const codesVus = new Set<string>()
  const confirmees = new Set(opts.creerQuandMeme ?? [])

  // 1. Statut propre à chaque ligne (sans le rattachement).
  for (const b of lignesBrutes) {
    const nom = b.nom.trim().replace(/\s+/g, ' ').slice(0, NOM_MAX)
    const code = b.code?.trim() || undefined
    const l: LignePlanifiee = { line: b.line, statut: 'NOUVELLE', nom, code, type: lireType(b.type, opts.typeParDefaut), alias: lireAlias(b.alias) }
    lignes.push(l)
    if (!nom) { l.statut = 'REJETEE'; l.raison = 'nom_requis'; continue }
    if (code) {
      const k = normaliserNom(code)
      if (codesVus.has(k)) { l.statut = 'REJETEE'; l.raison = 'code_en_double'; continue }
      codesVus.add(k)
      const e = parCodeExistant.get(k)
      if (e) {
        if (normaliserNom(e.nom) === normaliserNom(nom)) { l.statut = 'INCHANGEE'; l.entiteId = e.id }
        else { l.statut = 'RENOMMEE'; l.entiteId = e.id; l.ancienNom = e.nom }
        continue
      }
    }
    const exact = correspondances(nom, existantes, 1)[0]
    if (exact) { l.statut = 'INCHANGEE'; l.entiteId = exact.id; continue }
    const proche = correspondances(nom, existantes)[0]
    if (proche) { l.statut = 'DOUBLON_PROBABLE'; l.entiteId = proche.id; continue }
    // Doublon d'une ligne précédente du fichier (même nom ou nom proche, sans code commun).
    const precedentes = lignes.filter(x => x !== l && x.statut === 'NOUVELLE')
    const refs: EntiteRef[] = precedentes.map(x => ({ id: String(x.line), nom: x.nom, type: x.type, alias: x.alias, codeExterne: null, parentId: null, source: 'IMPORT', valideAu: null }))
    const autre = correspondances(nom, refs)[0]
    if (autre && !(code && precedentes.find(x => String(x.line) === autre.id)?.code)) { l.statut = 'DOUBLON_PROBABLE'; l.doublonDeLigne = Number(autre.id) }
  }

  // 2. Rattachement : ligne du fichier (code puis nom) ou entité existante (code puis nom / alias exact).
  const valides = lignes.filter(l => l.statut !== 'REJETEE' || l.raison !== 'nom_requis')
  const parCodeLigne = new Map(valides.filter(l => l.code && l.raison !== 'code_en_double').map(l => [normaliserNom(l.code!), l]))
  const parNomLigne = new Map<string, LignePlanifiee>()
  for (const l of valides) if (!parNomLigne.has(normaliserNom(l.nom))) parNomLigne.set(normaliserNom(l.nom), l)
  const parentDe = new Map<number, LignePlanifiee | null>()
  for (const l of lignes) {
    const b = lignesBrutes.find(x => x.line === l.line)!
    const p = b.parent?.trim()
    if (!p || l.raison === 'nom_requis' || l.raison === 'code_en_double') continue
    const k = normaliserNom(p)
    const pl = parCodeLigne.get(k) ?? parNomLigne.get(k)
    if (pl && pl !== l) { parentDe.set(l.line, pl); continue }
    const pe = parCodeExistant.get(k) ?? existantes.find(e => correspondances(p, [e], 1).length)
    if (pe) { l.parentExistantId = pe.id; continue }
    l.statut = 'REJETEE'; l.raison = 'parent_inconnu'
  }
  // Boucles dans le fichier.
  for (const l of lignes) {
    const vus = new Set<number>([l.line])
    for (let p = parentDe.get(l.line); p; p = parentDe.get(p.line)) {
      if (vus.has(p.line)) { if (l.statut !== 'REJETEE') { l.statut = 'REJETEE'; l.raison = 'boucle' } break }
      vus.add(p.line)
    }
  }
  // Parent rejeté (propagé), parent déjà existant (inchangé, renommé, ou candidat d'un doublon non confirmé).
  const resoudre = (l: LignePlanifiee, profondeur = 0): void => {
    const p = parentDe.get(l.line)
    if (!p || l.statut === 'REJETEE' || profondeur > lignes.length) return
    resoudre(p, profondeur + 1)
    if (p.statut === 'REJETEE') { l.statut = 'REJETEE'; l.raison = 'parent_rejete'; return }
    const pCree = p.statut === 'NOUVELLE' || (p.statut === 'DOUBLON_PROBABLE' && confirmees.has(p.line))
    if (pCree) l.parentLigne = p.line
    else if (p.entiteId) l.parentExistantId = p.entiteId
    else if (p.doublonDeLigne) l.parentLigne = p.doublonDeLigne
  }
  lignes.forEach(l => resoudre(l))

  // 3. Créations ordonnées (parents avant enfants), renommages, disparues.
  const creee = (l: LignePlanifiee) => l.statut === 'NOUVELLE' || (l.statut === 'DOUBLON_PROBABLE' && confirmees.has(l.line))
  const aCreer: LignePlanifiee[] = []
  const placees = new Set<number>()
  const parLigne = new Map(lignes.map(l => [l.line, l]))
  const placer = (l: LignePlanifiee) => {
    if (placees.has(l.line) || !creee(l)) return
    placees.add(l.line)
    if (l.parentLigne !== undefined) placer(parLigne.get(l.parentLigne)!)
    aCreer.push(l)
  }
  lignes.forEach(placer)

  const retenus = opts.renommer ? new Set(opts.renommer) : null
  const aRenommer = lignes.filter(l => l.statut === 'RENOMMEE' && (!retenus || retenus.has(l.entiteId!))).map(l => ({ id: l.entiteId!, nom: l.nom, ancienNom: l.ancienNom! }))

  const vues = new Set(lignes.map(l => l.entiteId).filter(Boolean))
  const disparues = opts.listeComplete
    ? existantes.filter(e => e.source !== 'MANUEL' && estActive(e) && !vues.has(e.id)).map(e => ({ id: e.id, nom: e.nom }))
    : []
  const aClore = disparues.map(d => d.id).filter(id => (opts.clore ?? []).includes(id))

  const compte = { NOUVELLE: 0, RENOMMEE: 0, INCHANGEE: 0, DOUBLON_PROBABLE: 0, REJETEE: 0 } as Record<StatutImport, number>
  for (const l of lignes) compte[l.statut]++
  return { lignes, aCreer, aRenommer, disparues, aClore, compte }
}
