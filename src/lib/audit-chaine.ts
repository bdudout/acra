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

export function empreinte(e: EntreeAudit, precedent: string, cle?: string | null): string {
  const data = canonique(e, precedent)
  return cle ? createHmac('sha256', cle).update(data).digest('hex') : createHash('sha256').update(data).digest('hex')
}

export type RaisonRupture = 'maillon_manquant' | 'contenu_modifie'
export type ResultatSegment = { ok: true; verifiees: number; dernierHash: string } | { ok: false; verifiees: number; rupture: { seq: string; raison: RaisonRupture } }

/** Vérifie des entrées scellées consécutives (ordre `seq`) à partir de l'empreinte `precedent` ; s'arrête à la 1ʳᵉ rupture. */
export function verifierSegment(entrees: EntreeScellee[], precedent: string, cle?: string | null): ResultatSegment {
  let prev = precedent
  let n = 0
  for (const e of entrees) {
    if (e.hashPrecedent !== prev) return { ok: false, verifiees: n, rupture: { seq: e.seq.toString(), raison: 'maillon_manquant' } }
    if (e.hash !== empreinte(e, prev, cle)) return { ok: false, verifiees: n, rupture: { seq: e.seq.toString(), raison: 'contenu_modifie' } }
    prev = e.hash; n++
  }
  return { ok: true, verifiees: n, dernierHash: prev }
}
