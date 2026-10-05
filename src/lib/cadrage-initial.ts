// ─── Cadrage créé avec une analyse (PUR) ───────────────────────────────────────
// Projet 360 : la description devient le périmètre et les objectifs saisis dès la page de création sont repris (la
// phase « contexte » n'est plus laissée vide). Analyse issue d'un socle : héritage du cadrage (hors événements redoutés
// et socle de sécurité, propres à chaque analyse). Testé : cadrage-initial.test.ts.

type SocleCadrage = { perimetre?: unknown; objectifsEtude?: unknown; missions?: unknown; valeursMetier?: unknown; biensSupports?: unknown } | null | undefined

export function cadrageInitial(
  data: { methode: string; description?: string | null; objectifsEtude?: string | null },
  socle?: SocleCadrage,
): Record<string, unknown> {
  const objectifs = data.objectifsEtude?.trim() || null
  if (socle) {
    return {
      perimetre: socle.perimetre, objectifsEtude: objectifs ?? socle.objectifsEtude, missions: socle.missions,
      valeursMetier: socle.valeursMetier, biensSupports: socle.biensSupports,
    }
  }
  if (data.methode === 'PROJET_360') return { perimetre: data.description ?? null, objectifsEtude: objectifs }
  return objectifs ? { objectifsEtude: objectifs } : {}
}
