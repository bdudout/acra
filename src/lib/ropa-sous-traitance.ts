// ─── Registre du sous-traitant (RGPD art. 30 §2) — PUR ────────────────────────
// Quand l'organisation traite des données pour le compte de clients (responsables du traitement), elle tient un
// registre de toutes les catégories d'activités de traitement effectuées pour leur compte : a) nom et coordonnées de
// chaque responsable du traitement (et de son DPO) ; b) catégories de traitements effectués pour son compte ;
// c) transferts vers un pays tiers et garanties ; d) description des mesures de sécurité (art. 32). Module activable
// (`ropaSousTraitantActive`, 3 niveaux). Testé : ropa-sous-traitance.test.ts.

const MAX = 200
const txt = (v: unknown, max = MAX) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')
const liste = (v: unknown) => (Array.isArray(v) ? v.map(x => txt(x)).filter(Boolean).slice(0, 50) : [])

export interface SousTraitance {
  clientNom: string; clientContact: string; clientDpo: string
  categoriesTraitements: string[]
  transfertHorsUE: boolean; paysTransfert: string; garantiesTransfert: string
  mesuresSecurite: string[]
}

export function sanitizeSousTraitance(v: unknown): SousTraitance {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    clientNom: txt(o.clientNom), clientContact: txt(o.clientContact), clientDpo: txt(o.clientDpo),
    categoriesTraitements: liste(o.categoriesTraitements),
    transfertHorsUE: o.transfertHorsUE === true || o.transfertHorsUE === 'true',
    paysTransfert: txt(o.paysTransfert), garantiesTransfert: txt(o.garantiesTransfert, 2000),
    mesuresSecurite: liste(o.mesuresSecurite),
  }
}

/** Mentions obligatoires manquantes au sens de l'art. 30 §2. */
export function champsManquantsArt30_2(s: SousTraitance): string[] {
  const m: string[] = []
  if (!s.clientNom) m.push('clientNom')
  if (!s.clientContact) m.push('clientContact')
  if (!s.categoriesTraitements.length) m.push('categoriesTraitements')
  if (!s.mesuresSecurite.length) m.push('mesuresSecurite')
  if (s.transfertHorsUE && !s.garantiesTransfert) m.push('garantiesTransfert')
  return m
}
