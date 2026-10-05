// ─── Liste des projets 360 : recherche, filtre par statut, tri (PUR) ───────────
// Testé : projets-liste.test.ts. Cf. composant ProjetsManager.

export interface ProjetListe { nom: string; statut: string; risques: number; updatedAt: string }
export type TriProjets = 'nom' | 'statut' | 'risques' | 'updatedAt'
export interface OptionsListe { q?: string; statut?: string; tri?: TriProjets; sens?: 'asc' | 'desc' }

const plain = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()

export function filtrerTrierProjets<T extends ProjetListe>(projets: readonly T[], o: OptionsListe): T[] {
  const q = plain((o.q ?? '').trim())
  const tri = o.tri ?? 'updatedAt'
  const sens = o.sens ?? (tri === 'updatedAt' || tri === 'risques' ? 'desc' : 'asc')
  const cmp = (a: T, b: T) => {
    if (tri === 'risques') return a.risques - b.risques
    if (tri === 'updatedAt') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    return plain(a[tri]).localeCompare(plain(b[tri]))
  }
  return projets
    .filter(p => (!q || plain(p.nom).includes(q)) && (!o.statut || p.statut === o.statut))
    .slice()
    .sort((a, b) => (sens === 'asc' ? cmp(a, b) : cmp(b, a)))
}
