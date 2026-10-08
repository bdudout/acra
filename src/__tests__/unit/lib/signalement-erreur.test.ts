import { describe, it, expect } from 'vitest'
import { anonymiserChemin, resumerNavigateur, construireSignalement, urlNouvelleIssue, depotIssues, DEPOT_ISSUES_DEFAUT } from '@/lib/signalement-erreur'

describe('anonymiserChemin', () => {
  it('remplace les identifiants (cuid, uuid, nombres, e-mails, jetons) et retire paramètres et ancre', () => {
    expect(anonymiserChemin('/analyses/cmuz72j4n0004c5te5ep9644d/atelier/3?x=secret#h')).toBe('/analyses/:id/atelier/3')
    expect(anonymiserChemin('/plans/550e8400-e29b-41d4-a716-446655440000')).toBe('/plans/:id')
    expect(anonymiserChemin('/incidents/123456')).toBe('/incidents/:id')
    expect(anonymiserChemin('/users/jean.dupont@banque.fr/edit')).toBe('/users/:id/edit')
    expect(anonymiserChemin('/reset/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')).toBe('/reset/:id')
    expect(anonymiserChemin('/configuration/entites')).toBe('/configuration/entites')
  })
  it('un segment illisible ou une URL absolue d’un autre site est neutralisé', () => {
    expect(anonymiserChemin('https://evil.example/x')).toBe('/x')
    expect(anonymiserChemin('')).toBe('/')
  })
})

describe('resumerNavigateur', () => {
  it('famille et version majeure seulement, système en grande famille', () => {
    expect(resumerNavigateur('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.92 Safari/537.36'))
      .toEqual({ navigateur: 'Chrome 130', systeme: 'macOS' })
    expect(resumerNavigateur('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0')).toEqual({ navigateur: 'Firefox 131', systeme: 'Windows' })
    expect(resumerNavigateur('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0.2849')).toEqual({ navigateur: 'Edge 130', systeme: 'Windows' })
    expect(resumerNavigateur('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toEqual({ navigateur: 'Safari 18', systeme: 'iOS' })
    expect(resumerNavigateur('')).toEqual({ navigateur: 'inconnu', systeme: 'inconnu' })
  })
})

describe('construireSignalement', () => {
  const base = { version: 'v1.0.5', revision: 'abc1234', statut: 500, chemin: '/analyses/cmuz72j4n0004c5te5ep9644d', digest: '3301562041', date: new Date('2026-10-09T14:37:52.123Z'), userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0', langue: 'fr' }
  it('titre et corps : version, révision, statut, page anonymisée, référence, minute UTC, navigateur ; rien d’autre', () => {
    const s = construireSignalement(base)
    expect(s.titre).toBe('[Erreur 500] /analyses/:id')
    expect(s.corps).toContain('| Version | v1.0.5 |')
    expect(s.corps).toContain('| Révision | abc1234 |')
    expect(s.corps).toContain('| Page | `/analyses/:id` |')
    expect(s.corps).toContain('| Référence | 3301562041 |')
    expect(s.corps).toContain('| Date (UTC) | 2026-10-09 14:37 |')
    expect(s.corps).toContain('| Navigateur | Firefox 131 (Linux) |')
    expect(s.corps).not.toContain('cmuz72j4n0004c5te5ep9644d')
  })
  it('erreur d’un appel d’API : requête (méthode + chemin anonymisé) dans le titre et le corps, page d’origine conservée', () => {
    const s = construireSignalement({ ...base, statut: 502, requete: { methode: 'post', chemin: '/api/plans/cmuz72j4n0004c5te5ep9644d/lignes?annee=2027' } })
    expect(s.titre).toBe('[Erreur 502] POST /api/plans/:id/lignes')
    expect(s.corps).toContain('| Requête | `POST /api/plans/:id/lignes` |')
    expect(s.corps).toContain('| Page | `/analyses/:id` |')
    expect(s.corps).not.toContain('2027')
  })
  it('une référence non conforme (texte libre) n’est pas reprise', () => {
    expect(construireSignalement({ ...base, digest: 'Error: user jean@x.fr not found' }).corps).toContain('| Référence | — |')
  })
})

describe('urlNouvelleIssue / depotIssues', () => {
  it('lien GitHub pré-rempli (titre, corps, étiquette bug), corps borné', () => {
    const u = new URL(urlNouvelleIssue('bdudout/acra', 'T', 'x'.repeat(20_000)))
    expect(u.origin + u.pathname).toBe('https://github.com/bdudout/acra/issues/new')
    expect(u.searchParams.get('title')).toBe('T')
    expect(u.searchParams.get('labels')).toBe('bug')
    expect(u.searchParams.get('body')!.length).toBeLessThanOrEqual(6000)
  })
  it('dépôt configuré seulement s’il est de la forme propriétaire/dépôt ; sinon le dépôt par défaut', () => {
    expect(depotIssues('mon-org/acra-fork')).toBe('mon-org/acra-fork')
    expect(depotIssues('https://evil.example')).toBe(DEPOT_ISSUES_DEFAUT)
    expect(depotIssues(undefined)).toBe('bdudout/acra')
  })
})
