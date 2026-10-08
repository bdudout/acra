// ─── Registre des traitements : identité du responsable (RGPD art. 30 §1 a) — PUR ─
// Nom et coordonnées du responsable du traitement, de son représentant (art. 27) et du délégué à la protection des
// données. Le DPO est repris AUTOMATIQUEMENT s'il est désigné dans ACRA (membre au rôle DPO de l'organisation, ou d'une
// organisation parente avec une portée « sous-arbre ») ; sinon, champ libre. Testé : ropa-identite.test.ts.

const MAX = 200
const txt = (v: unknown, max = MAX) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')

export interface IdentiteSaisie {
  responsableNom: string; responsableAdresse: string; responsableContact: string
  representantNom: string; representantContact: string
  dpoNom: string; dpoContact: string
}

export function sanitizeIdentite(v: unknown): IdentiteSaisie {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    responsableNom: txt(o.responsableNom), responsableAdresse: txt(o.responsableAdresse, 400), responsableContact: txt(o.responsableContact),
    representantNom: txt(o.representantNom), representantContact: txt(o.representantContact),
    dpoNom: txt(o.dpoNom), dpoContact: txt(o.dpoContact),
  }
}

export interface Personne { nom: string; contact: string }
interface Rattachement { organizationId: string; role: string; scope: string; user: { name: string | null; email: string; isActive?: boolean } }

/** DPO désignés pour une organisation : rôle DPO dans l'organisation, ou dans un ancêtre avec une portée SUBTREE. */
export function dposDesignes(org: { id: string; path: string }, rattachements: Rattachement[]): Personne[] {
  const ancetres = new Set(org.path.split('/').filter(Boolean).filter(id => id !== org.id))
  return rattachements
    .filter(r => r.role === 'DPO' && r.user.isActive !== false && (r.organizationId === org.id || (ancetres.has(r.organizationId) && r.scope === 'SUBTREE')))
    .map(r => ({ nom: r.user.name?.trim() || r.user.email, contact: r.user.email }))
}

export interface IdentiteEffective {
  responsable: { nom: string; adresse: string; contact: string }
  representant: Personne
  dpo: Personne & { source: 'DESIGNE' | 'SAISI' | 'AUCUN' }
  /** Mentions obligatoires manquantes (art. 30 §1 a) : nom et coordonnées du responsable. */
  manquants: ('responsableNom' | 'responsableContact')[]
}

export function identiteEffective(s: IdentiteSaisie, designes: Personne[]): IdentiteEffective {
  const dpo = designes.length
    ? { source: 'DESIGNE' as const, nom: designes.map(d => d.nom).join(', '), contact: designes.map(d => d.contact).join(', ') }
    : s.dpoNom || s.dpoContact ? { source: 'SAISI' as const, nom: s.dpoNom, contact: s.dpoContact } : { source: 'AUCUN' as const, nom: '', contact: '' }
  const manquants: IdentiteEffective['manquants'] = []
  if (!s.responsableNom) manquants.push('responsableNom')
  if (!s.responsableContact) manquants.push('responsableContact')
  return {
    responsable: { nom: s.responsableNom, adresse: s.responsableAdresse, contact: s.responsableContact },
    representant: { nom: s.representantNom, contact: s.representantContact },
    dpo, manquants,
  }
}
