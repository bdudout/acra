// ─── Signalement d'une erreur sur GitHub — logique PURE ───────────────────────
// Prépare une issue GitHub PRÉ-REMPLIE (rien n'est envoyé par ACRA : la personne relit puis envoie elle-même, avec son
// compte GitHub). Contenu limité au diagnostic : version et révision installées, statut, page dont les identifiants
// sont masqués (sans paramètres ni ancre), référence technique (digest Next.js), minute UTC, navigateur et système en
// grandes familles, langue. Jamais : données saisies, noms, e-mails, organisation, message d'erreur (peut contenir des
// données). Testé : signalement-erreur.test.ts.

export const DEPOT_ISSUES_DEFAUT = 'bdudout/acra'
const CORPS_MAX = 6000

/** Dépôt cible (`ACRA_ISSUES_REPO`, ex. un fork) s'il est de la forme propriétaire/dépôt ; sinon le dépôt d'ACRA. */
export function depotIssues(configure: string | null | undefined): string {
  return configure && /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(configure) ? configure : DEPOT_ISSUES_DEFAUT
}

// Segment identifiant : cuid, uuid, nombre, e-mail, jeton hexadécimal / base64 long.
const IDENTIFIANT = [
  /^c[a-z0-9]{20,}$/i, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, /^\d{3,}$/, /@/, /^[A-Za-z0-9_-]{24,}$/, /%/,
]

/** Chemin de la page sans paramètres ni ancre, identifiants remplacés par `:id`. */
export function anonymiserChemin(chemin: string): string {
  let p = chemin || '/'
  try { p = new URL(p, 'http://local').pathname } catch { p = '/' }
  const segments = p.split('/').filter(Boolean).map(s => (IDENTIFIANT.some(re => re.test(s)) ? ':id' : s))
  return `/${segments.join('/')}`
}

/** Navigateur (famille + version majeure) et système (grande famille) ; jamais la chaîne complète. */
export function resumerNavigateur(ua: string): { navigateur: string; systeme: string } {
  const m = (re: RegExp) => ua.match(re)?.[1]
  const navigateur = m(/Edg\/(\d+)/) ? `Edge ${m(/Edg\/(\d+)/)}`
    : m(/Firefox\/(\d+)/) ? `Firefox ${m(/Firefox\/(\d+)/)}`
    : m(/Chrome\/(\d+)/) ? `Chrome ${m(/Chrome\/(\d+)/)}`
    : m(/Version\/(\d+).*Safari/) ? `Safari ${m(/Version\/(\d+).*Safari/)}`
    : 'inconnu'
  const systeme = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux|X11/.test(ua) ? 'Linux' : 'inconnu'
  return { navigateur, systeme }
}

export interface ContexteErreur {
  version: string; revision: string; statut: number; chemin: string; digest?: string | null
  date: Date; userAgent: string; langue: string
  /** Appel d'API en erreur (sinon : erreur d'affichage de la page). */
  requete?: { methode: string; chemin: string }
}

/** Titre et corps (Markdown) de l'issue. */
export function construireSignalement(c: ContexteErreur): { titre: string; corps: string } {
  const page = anonymiserChemin(c.chemin)
  const { navigateur, systeme } = resumerNavigateur(c.userAgent)
  // La référence Next.js est un condensat numérique / alphanumérique court ; tout autre texte est écarté.
  const reference = c.digest && /^[A-Za-z0-9-]{1,64}$/.test(c.digest) ? c.digest : '—'
  const champ = (v: string) => v.replace(/[|\n\r`]/g, ' ').slice(0, 80)
  const methode = c.requete ? (c.requete.methode.toUpperCase().match(/^[A-Z]{3,7}$/)?.[0] ?? 'GET') : null
  const requete = c.requete ? `${methode} ${anonymiserChemin(c.requete.chemin)}` : null
  const corps = [
    '## Contexte (rempli automatiquement)',
    '',
    '| Élément | Valeur |',
    '|---|---|',
    `| Version | ${champ(c.version)} |`,
    `| Révision | ${champ(c.revision)} |`,
    `| Statut | ${c.statut} |`,
    ...(requete ? [`| Requête | \`${requete}\` |`] : []),
    `| Page | \`${page}\` |`,
    `| Référence | ${reference} |`,
    `| Date (UTC) | ${c.date.toISOString().slice(0, 16).replace('T', ' ')} |`,
    `| Navigateur | ${navigateur} (${systeme}) |`,
    `| Langue | ${champ(c.langue)} |`,
    '',
    '## Ce qui s’est passé',
    '',
    '<!-- Décrivez l’action en cours (sans données confidentielles : pas de noms, montants, identifiants). -->',
    '',
    '---',
    '_Aucune donnée saisie, aucun nom ni identifiant n’est inclus automatiquement. Relisez avant d’envoyer._',
  ].join('\n')
  return { titre: `[Erreur ${c.statut}] ${requete ?? page}`, corps }
}

/** Lien « nouvelle issue » pré-rempli (corps borné pour rester sous la limite d'URL de GitHub). */
export function urlNouvelleIssue(depot: string, titre: string, corps: string): string {
  const u = new URL(`https://github.com/${depotIssues(depot)}/issues/new`)
  u.searchParams.set('title', titre.slice(0, 200))
  u.searchParams.set('body', corps.slice(0, CORPS_MAX))
  u.searchParams.set('labels', 'bug')
  return u.toString()
}
