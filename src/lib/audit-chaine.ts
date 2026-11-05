// ─── Journal d'audit infalsifiable : chaînage par empreintes ─────────────────────────────────────────────────────────
// Chaque entrée scellée porte `hashPrecedent` (empreinte de l'entrée précédente dans l'ordre `seq`) et `hash` =
// HMAC-SHA256(clé, contenu canonique + hashPrecedent) — ou SHA-256 sans clé (AUDIT_CHAIN_KEY absente : la chaîne détecte
// une altération isolée mais un attaquant ayant l'accès en écriture à la base pourrait la recalculer entièrement).
// Toute modification, suppression ou insertion au milieu est détectée et localisée. Logique pure, testée
// (audit-chaine.test.ts) ; scellement et vérification sur la base : audit-chaine.server.ts.
import { createHash, createHmac } from 'node:crypto'

export const GENESE = 'GENESE'
export interface EntreeAudit {
  seq: bigint; createdAt: Date; action: string; userId: string | null; userEmail: string | null; userRole: string | null
  targetId: string | null; targetType: string | null; ip: string | null; details: string | null; organizationId: string | null
}
export type EntreeScellee = EntreeAudit & { hashPrecedent: string | null; hash: string | null }

/** Contenu canonique (ordre et forme figés : toute évolution exigerait une nouvelle version de chaîne). */
function canonique(e: EntreeAudit, precedent: string): string {
  return JSON.stringify(['v1', e.seq.toString(), e.createdAt.toISOString(), e.action, e.userId, e.userEmail, e.userRole, e.targetId, e.targetType, e.ip, e.details, e.organizationId, precedent])
}

/**
 * Empreinte d'une entrée. Le MODE est mémorisé dans la valeur : « k1:<hex> » = HMAC-SHA256 avec la clé ; hexadécimal nu =
 * SHA-256 sans clé. Une installation peut ainsi ajouter AUDIT_CHAIN_KEY en cours de vie : les entrées déjà scellées sans
 * clé restent vérifiables, les suivantes sont scellées avec la clé.
 */
export function empreinte(e: EntreeAudit, precedent: string, cle?: string | null): string {
  const data = canonique(e, precedent)
  return cle ? `k1:${createHmac('sha256', cle).update(data).digest('hex')}` : createHash('sha256').update(data).digest('hex')
}

export type RaisonRupture = 'maillon_manquant' | 'contenu_modifie' | 'mode_degrade' | 'cle_absente'
export type ResultatSegment = { ok: true; verifiees: number; dernierHash: string; sansCle: number } | { ok: false; verifiees: number; rupture: { seq: string; raison: RaisonRupture } }

const avecCle = (h: string | null | undefined) => !!h && h.startsWith('k1:')

/**
 * Vérifie des entrées scellées consécutives (ordre `seq`) à partir de l'empreinte `precedent` ; s'arrête à la 1ʳᵉ rupture.
 * Chaque entrée est vérifiée dans SON mode (avec ou sans clé). Une fois une entrée scellée avec la clé, une entrée
 * suivante sans clé est une rétrogradation (falsification possible par recalcul sans la clé) : `mode_degrade`.
 */
export function verifierSegment(entrees: EntreeScellee[], precedent: string, cle?: string | null): ResultatSegment {
  let prev = precedent
  let n = 0
  let cleVue = avecCle(precedent)
  let sansCle = 0
  for (const e of entrees) {
    const seq = e.seq.toString()
    if (e.hashPrecedent !== prev) return { ok: false, verifiees: n, rupture: { seq, raison: 'maillon_manquant' } }
    const k = avecCle(e.hash)
    if (cleVue && !k) return { ok: false, verifiees: n, rupture: { seq, raison: 'mode_degrade' } }
    if (k && !cle) return { ok: false, verifiees: n, rupture: { seq, raison: 'cle_absente' } }
    if (e.hash !== empreinte(e, prev, k ? cle : null)) return { ok: false, verifiees: n, rupture: { seq, raison: 'contenu_modifie' } }
    if (k) cleVue = true; else sansCle++
    prev = e.hash!; n++
  }
  return { ok: true, verifiees: n, dernierHash: prev, sansCle }
}
