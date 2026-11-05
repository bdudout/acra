// ─── Import des points d'accès et de la qualification des usages TIC (CSV / XLSX) ────────────────────────────────────
// Une ligne = un usage EXISTANT de l'organisation active (tiers + offre + cas d'usage ; le cas d'usage peut être omis si
// l'offre n'a qu'un usage) : qualification (PCI, SI, exposition, interconnexion) et / ou un point d'accès. L'import ne crée
// jamais de tiers, d'offre ni d'usage (déclaration explicite) ; toute valeur non reconnue est une erreur de ligne, jamais une
// interprétation hasardeuse ; une adresse déjà connue est ignorée. Testé : tier-usage-import.test.ts.
import { comparableTierName } from './tier-identity'
import { lireQualificationUsage, type QualificationUsage } from './tier-offers'
import { lirePointAcces, type PointAccesSaisi } from './tier-endpoints'

export const MAX_USAGE_IMPORT_ROWS = 5000
type Champ = 'tiers' | 'offre' | 'usage' | 'adresse' | 'type' | 'environnement' | 'authentification' | 'pci' | 'si' | 'exposition' | 'interconnexion'
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const norm = (s: string) => strip(s).replace(/[^a-z0-9]+/g, ' ').trim()

const REGLES: [Champ, (h: string) => boolean][] = [
  ['tiers', h => /^(tiers|prestataire|fournisseur|editeur|vendor|provider|supplier|third party)$/.test(h)],
  ['offre', h => /^(offre|service|produit|offer|product|service tic|ict service)$/.test(h)],
  ['usage', h => /^(usage|cas d ?usage|cas d usage|use case|application|utilisation)$/.test(h)],
  ['adresse', h => /^(adresse|url|uri|hote|host|hostname|fqdn|endpoint|point d acces|domaine|domain)$/.test(h)],
  ['type', h => /^(type|type de point d acces|type d acces|access type)$/.test(h)],
  ['environnement', h => /^(environnement|env|environment)$/.test(h)],
  ['authentification', h => /^(authentification|auth|authentication)$/.test(h)],
  ['pci', h => /^(pci|perimetre pci|pci dss|pci scope)$/.test(h)],
  ['si', h => /^(si|avec si|raccordement|raccordement au si|raccorde au si|is connection|connected to is)$/.test(h)],
  ['exposition', h => /^(exposition|expose internet|expose a internet|expose sur internet|internet|exposure)$/.test(h)],
  ['interconnexion', h => /^(interconnexion|liaison|lien|interconnection|link)$/.test(h)],
]
export function mapUsageImportColumns(headers: string[]): Partial<Record<Champ, string>> {
  const out: Partial<Record<Champ, string>> = {}
  const pris = new Set<string>()
  for (const [champ, test] of REGLES) {
    const h = headers.find(x => !pris.has(x) && test(norm(x)))
    if (h) { out[champ] = h; pris.add(h) }
  }
  return out
}

export type LigneUsageImport = { line: number } & Record<Champ, string>
export interface UsageCible { id: string; tiers: string; aliases: string[]; offre: string; usage: string; adresses: string[] }
export type LignePlan = { line: number; statut: 'OK'; usageId: string } | { line: number; statut: 'IGNOREE'; usageId: string; raison: 'doublon' } | { line: number; statut: 'ERREUR'; erreur: string }
export interface LigneValide { usageId: string; qualification: QualificationUsage & { exposeInternet?: boolean | null }; point: PointAccesSaisi | null }

// Valeurs : vide = non fourni ; sinon un vocabulaire fermé (FR / EN), tout le reste → erreur.
const OUI = new Set(['oui', 'o', 'yes', 'y', 'true', 'vrai', '1', 'x'])
const NON = new Set(['non', 'n', 'no', 'false', 'faux', '0'])
const booleen = (raw: string, vrai: string[] = [], faux: string[] = []): boolean | undefined => {
  const v = norm(raw)
  if (OUI.has(v) || vrai.includes(v)) return true
  if (NON.has(v) || faux.includes(v)) return false
  return undefined
}
const ENV: Record<string, string> = { prod: 'PRODUCTION', production: 'PRODUCTION', prd: 'PRODUCTION', recette: 'RECETTE', test: 'RECETTE', tests: 'RECETTE', uat: 'RECETTE', qualif: 'RECETTE', qualification: 'RECETTE', preprod: 'RECETTE', 'pre prod': 'RECETTE', staging: 'RECETTE', autre: 'AUTRE', other: 'AUTRE', dev: 'AUTRE' }
const TYPES: Record<string, string> = { web: 'WEB', 'application web': 'WEB', site: 'WEB', api: 'API', sftp: 'SFTP', ftp: 'SFTP', ftps: 'SFTP', 'transfert de fichiers': 'SFTP', 'file transfer': 'SFTP', saas: 'TENANT_SAAS', 'tenant saas': 'TENANT_SAAS', tenant: 'TENANT_SAAS', vpn: 'VPN', autre: 'AUTRE', other: 'AUTRE' }
const AUTH: Record<string, string> = { sso: 'SSO', mfa: 'MFA', '2fa': 'MFA', locale: 'LOCALE', local: 'LOCALE', 'compte local': 'LOCALE', 'local account': 'LOCALE', certificat: 'CERTIFICAT', certificate: 'CERTIFICAT', mtls: 'CERTIFICAT', 'cle api': 'CLE_API', 'api key': 'CLE_API', aucune: 'AUCUNE', none: 'AUCUNE' }
const INTER: Record<string, string> = { ls: 'LIGNE_SPECIALISEE', 'ligne specialisee': 'LIGNE_SPECIALISEE', 'leased line': 'LIGNE_SPECIALISEE', mpls: 'LIGNE_SPECIALISEE', internet: 'INTERNET', 'via internet': 'INTERNET', vpn: 'INTERNET', 'vpn internet': 'INTERNET' }
const vocab = (raw: string, m: Record<string, string>) => (raw.trim() ? m[norm(raw)] ?? (Object.values(m).includes(raw.trim().toUpperCase()) ? raw.trim().toUpperCase() : undefined) : null)

function lireLigne(l: LigneUsageImport): { ok: true; qualification: LigneValide['qualification']; point: PointAccesSaisi | null } | { ok: false; erreur: string } {
  const corps: Record<string, unknown> = {}
  if (l.pci.trim()) { const v = booleen(l.pci, ['pci'], ['non pci', 'hors pci']); if (v === undefined) return { ok: false, erreur: 'pci_invalide' }; corps.perimetrePci = v }
  if (l.si.trim()) { const v = booleen(l.si, ['avec si', 'avec'], ['sans si', 'sans']); if (v === undefined) return { ok: false, erreur: 'si_invalide' }; corps.avecSi = v }
  if (l.interconnexion.trim()) { const v = vocab(l.interconnexion, INTER); if (!v) return { ok: false, erreur: 'interconnexion_invalide' }; corps.interconnexion = v }
  const q = lireQualificationUsage(corps); if (!q.ok) return { ok: false, erreur: q.error }
  const qualification: LigneValide['qualification'] = { ...q.data }
  if (l.exposition.trim()) { const v = booleen(l.exposition, ['internet', 'expose', 'exposed'], ['intranet', 'interne', 'non expose', 'internal']); if (v === undefined) return { ok: false, erreur: 'exposition_invalide' }; qualification.exposeInternet = v }
  if (!l.adresse.trim()) return { ok: true, qualification, point: null }
  const type = l.type.trim() ? vocab(l.type, TYPES) : (/^https?:\/\//i.test(l.adresse.trim()) ? 'WEB' : 'AUTRE')
  if (!type) return { ok: false, erreur: 'type_invalide' }
  const environnement = vocab(l.environnement, ENV); if (environnement === undefined) return { ok: false, erreur: 'environnement_invalide' }
  const authentification = vocab(l.authentification, AUTH); if (authentification === undefined) return { ok: false, erreur: 'authentification_invalide' }
  const p = lirePointAcces({ adresse: l.adresse, type, environnement, authentification })
  if (!p.ok) return { ok: false, erreur: p.error }
  return { ok: true, qualification, point: p.data }
}

/** Plan d'import : statut par ligne et écritures à faire (aucune écriture ici). */
export function planUsageImport(lignes: LigneUsageImport[], usages: UsageCible[]) {
  const nomsTiers = (u: UsageCible) => [u.tiers, ...u.aliases].map(comparableTierName)
  const connues = new Map(usages.map(u => [u.id, new Set(u.adresses.map(a => a.toLowerCase()))]))
  const lines: LignePlan[] = []
  const lignesValides: LigneValide[] = []
  for (const l of lignes) {
    const tiers = comparableTierName(l.tiers); const offre = norm(l.offre); const usage = norm(l.usage)
    const candidats = usages.filter(u => tiers && nomsTiers(u).includes(tiers) && norm(u.offre) === offre && (!usage || norm(u.usage) === usage))
    if (candidats.length === 0) { lines.push({ line: l.line, statut: 'ERREUR', erreur: 'usage_introuvable' }); continue }
    if (candidats.length > 1) { lines.push({ line: l.line, statut: 'ERREUR', erreur: 'usage_ambigu' }); continue }
    const cible = candidats[0]
    const lu = lireLigne(l)
    if (!lu.ok) { lines.push({ line: l.line, statut: 'ERREUR', erreur: lu.erreur }); continue }
    const dejaConnue = lu.point ? connues.get(cible.id)!.has(lu.point.adresse.toLowerCase()) : false
    const qualifiee = Object.keys(lu.qualification).length > 0
    if (dejaConnue && !qualifiee) { lines.push({ line: l.line, statut: 'IGNOREE', usageId: cible.id, raison: 'doublon' }); continue }
    if (lu.point && !dejaConnue) connues.get(cible.id)!.add(lu.point.adresse.toLowerCase())
    lines.push({ line: l.line, statut: 'OK', usageId: cible.id })
    lignesValides.push({ usageId: cible.id, qualification: lu.qualification, point: dejaConnue ? null : lu.point })
  }
  return {
    lines, lignesValides,
    counts: {
      ok: lines.filter(l => l.statut === 'OK').length, ignorees: lines.filter(l => l.statut === 'IGNOREE').length, erreurs: lines.filter(l => l.statut === 'ERREUR').length,
      points: lignesValides.filter(l => l.point).length, qualifications: lignesValides.filter(l => Object.keys(l.qualification).length > 0).length,
    },
  }
}
