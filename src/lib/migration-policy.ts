// ─── Politique de migrations (PUR) — docs/specs/sauvegarde-rollback-spec.md, lot 5 ───
// Classe une migration Prisma : `additive` (rien n'est perdu, l'ancien code continue de fonctionner), `data` (modifie des
// lignes) ou `destructive` (perte ou incompatibilité : un retour arrière du code ne suffit plus, seule la restauration
// du point protège). Une migration NOUVELLE destructive exige l'en-tête `-- acra:destructive <raison>`.

export type MigrationClass = 'additive' | 'data' | 'destructive'
export interface MigrationClassification { class: MigrationClass; reasons: string[]; header?: string }

const HEADER = /^--\s*acra:destructive(?:[ \t]+(.*))?$/m

/** SQL sans commentaires ni contenu des chaînes (les mots-clés qu'ils contiennent ne comptent pas). */
function strip(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

const DESTRUCTIVE: Array<[RegExp, string]> = [
  [/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
  [/\bDROP\s+COLUMN\b/i, 'DROP COLUMN'],
  [/\bDROP\s+TYPE\b/i, 'DROP TYPE'],
  [/\bDROP\s+SCHEMA\b/i, 'DROP SCHEMA'],
  [/\bTRUNCATE\b/i, 'TRUNCATE'],
  [/\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i, 'changement de type de colonne'],
  [/\bRENAME\s+(COLUMN|TO)\b/i, 'renommage (incompatible avec l’ancien code)'],
  [/\bRENAME\s+VALUE\b/i, 'renommage d’une valeur d’enum (incompatible avec l’ancien code)'],
  [/\bALTER\s+COLUMN\b[^;]*\bSET\s+NOT\s+NULL\b/i, 'SET NOT NULL (échoue sur des lignes NULL)'],
]
const DATA: Array<[RegExp, string]> = [
  [/(^|;)\s*UPDATE\b/i, 'UPDATE'],
  [/(^|;)\s*INSERT\s+INTO\b/i, 'INSERT'],
  [/(^|;)\s*DELETE\s+FROM\b/i, 'DELETE'],
]

/** Retire les `DROP TABLE` des tables TEMPORAIRES créées dans la même migration (rien de persistant n'est perdu). */
function sansDropTemporaires(body: string): string {
  const nom = (n: string) => n.replace(/"/g, '').toLowerCase()
  const temporaires = new Set([...body.matchAll(/\bCREATE\s+TEMP(?:ORARY)?\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|\w+)/gi)].map(m => nom(m[1])))
  if (!temporaires.size) return body
  return body.replace(/\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?("[^"]+"|\w+)\s*(?=;|$)/gi, (stmt, n: string) => (temporaires.has(nom(n)) ? ' ' : stmt))
}

export function classifyMigration(sql: string): MigrationClassification {
  const header = HEADER.exec(sql)
  const body = sansDropTemporaires(strip(sql))
  const reasons: string[] = []
  for (const [re, label] of DESTRUCTIVE) if (re.test(body)) reasons.push(label)
  // ADD COLUMN … NOT NULL sans DEFAULT : échoue sur une table non vide.
  for (const stmt of body.split(';')) {
    if (/\bADD\s+COLUMN\b/i.test(stmt) && /\bNOT\s+NULL\b/i.test(stmt) && !/\bDEFAULT\b/i.test(stmt)) { reasons.push('ADD COLUMN NOT NULL sans DEFAULT'); break }
  }
  const out = (c: MigrationClass, r: string[]): MigrationClassification => ({ class: c, reasons: r, ...(header ? { header: (header[1] ?? '').trim() } : {}) })
  if (reasons.length) return out('destructive', reasons)
  const data = DATA.filter(([re]) => re.test(body)).map(([, label]) => label)
  if (data.length) return out('data', data)
  return out('additive', [])
}

/** Règle d'une migration NOUVELLE : destructive ⇒ en-tête `-- acra:destructive <raison>` obligatoire. */
export function validateNewMigration(sql: string): { ok: boolean; class: MigrationClass; reason?: string } {
  const c = classifyMigration(sql)
  if (c.class !== 'destructive') return { ok: true, class: c.class }
  if (!c.header) return { ok: false, class: c.class, reason: `migration destructive (${c.reasons.join(', ')}) sans en-tête « -- acra:destructive <raison> »` }
  return { ok: true, class: c.class }
}

// ─── Règle expand/contract — lot H1.4 de docs/specs/scalabilite-haute-disponibilite.md ───────────────────────────
// Déploiement sans interruption (scripts/update-ha.sh) : les migrations de N+1 sont appliquées pendant que des réplicas de
// N servent encore. Une migration ne doit donc rien supprimer, renommer, retyper ni durcir que N lit ou écrit encore :
//   expand  (N+1) : ajouter (table, colonne nullable ou avec DEFAULT, index), copier les données ; N continue de fonctionner ;
//   contract (N+2 ou plus tard) : supprimer ce que plus aucune version en service ne lit — marque `-- contract: <justification>`.
// Toute migration horodatée à partir de EXPAND_CONTRACT_DEPUIS est soumise à la règle (CI + cliquet sur le dépôt).

/** Horodatage Prisma (AAAAMMJJhhmmss) à partir duquel la règle s'applique (décision du 16/10/2026). */
export const EXPAND_CONTRACT_DEPUIS = '20261016000000'
const CONTRACT = /^--[ \t]*contract:[ \t]*(.*)$/m
const CONTRACT_MIN = 10

export function soumiseExpandContract(name: string): boolean {
  return /^\d{14}_/.test(name) && name.slice(0, 14) >= EXPAND_CONTRACT_DEPUIS
}

/** Une migration « contract » (destructive au sens de classifyMigration) exige `-- contract: <justification>` (≥ 10 caractères). */
export function validateExpandContract(sql: string): { ok: boolean; class: MigrationClass; reasons: string[]; reason?: string } {
  const c = classifyMigration(sql)
  if (c.class !== 'destructive') return { ok: true, class: c.class, reasons: c.reasons }
  // La marque doit être un commentaire de ligne hors commentaire de bloc.
  const m = CONTRACT.exec(sql.replace(/\/\*[\s\S]*?\*\//g, ' '))
  if (m && m[1].trim().length >= CONTRACT_MIN) return { ok: true, class: c.class, reasons: c.reasons }
  return {
    ok: false, class: c.class, reasons: c.reasons,
    reason: `phase « contract » (${c.reasons.join(', ')}) sans marque « -- contract: <justification> » : la version précédente, encore en service pendant le déploiement progressif, lit peut-être encore cet élément (docs/deploiement-haute-disponibilite.md, règle expand/contract)`,
  }
}
