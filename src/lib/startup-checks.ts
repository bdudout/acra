/**
 * Vérifications de sécurité exécutées au démarrage du serveur Next.js.
 *
 * Comportement :
 *  - Variables MANQUANTES (absentes) → bloque toujours (l'app ne peut pas fonctionner)
 *  - Variables avec VALEUR PAR DÉFAUT → bloque en production, avertit en dev
 *  - Variables correctement configurées → log de confirmation
 *
 * En cas de blocage, le message indique comment corriger via le script de setup.
 */

import { isHaProfile } from '@/lib/update-request'

const IS_PROD = process.env.NODE_ENV === 'production'

// Valeurs par défaut connues qui ne doivent jamais être utilisées en production
const DEFAULT_SECRETS = [
  'changeme',
  'changeme_in_production_use_openssl_rand_base64_32',
  'CHANGEZ_MOI_openssl_rand_base64_48',
  'CHANGEZ_MOI_openssl_rand_base64_32',
]

const DEFAULT_DB_PASSWORDS = [
  'ebios_secret_changeme',
  'CHANGEZ_MOI_openssl_rand_base64_24',
  'CHANGEZ_MOI',
]

function warn(msg: string) {
  console.warn(`\x1b[33m⚠ [ACRA-STARTUP]\x1b[0m ${msg}`)
}

function error(msg: string) {
  console.error(`\x1b[31m✗ [ACRA-STARTUP]\x1b[0m ${msg}`)
}

function ok(msg: string) {
  console.info(`\x1b[32m✓ [ACRA-STARTUP]\x1b[0m ${msg}`)
}

function printSetupHelp() {
  console.error('')
  console.error('\x1b[36m  ┌─────────────────────────────────────────────────────────────────┐\x1b[0m')
  console.error('\x1b[36m  │  ACRA — Configuration requise                                  │\x1b[0m')
  console.error('\x1b[36m  │                                                                 │\x1b[0m')
  console.error('\x1b[36m  │  Générez automatiquement les secrets avec :                    │\x1b[0m')
  console.error('\x1b[36m  │                                                                 │\x1b[0m')
  console.error('\x1b[1m\x1b[36m  │      ./scripts/setup.sh                                        │\x1b[0m')
  console.error('\x1b[1m\x1b[36m  │  ou  make setup                                                │\x1b[0m')
  console.error('\x1b[36m  │                                                                 │\x1b[0m')
  console.error('\x1b[36m  │  Le script crée un .env avec des secrets aléatoires sécurisés. │\x1b[0m')
  console.error('\x1b[36m  └─────────────────────────────────────────────────────────────────┘\x1b[0m')
  console.error('')
}

/**
 * Clé des Server Functions de Next.js : base64 (alphabet standard, avec remplissage) d'une clé AES de 16, 24 ou
 * 32 octets — node_modules/next/dist/docs/01-app/02-guides/self-hosting.md (« Server Functions encryption key »).
 */
export function isValidServerActionsKey(key: string | undefined): boolean {
  const k = (key ?? '').trim()
  if (k.length === 0 || k.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(k)) return false
  const bytes = (k.length / 4) * 3 - (k.endsWith('==') ? 2 : k.endsWith('=') ? 1 : 0)
  return bytes === 16 || bytes === 24 || bytes === 32
}

/**
 * Profil « ha » (ACRA_DEPLOY_PROFILE=ha, posé par docker-compose.ha.yml) : exigences propres au multi-instance.
 * Rend la liste des problèmes (vide = conforme ; jamais de valeur secrète dans les messages). Ne vérifie que la
 * PRÉSENCE du stockage S3 et d'un store Redis : leur configuration détaillée est validée au démarrage par
 * document-storage (S3_*) et shared-store.server (REDIS_*, joignabilité) depuis instrumentation.ts.
 */
export function haProfileProblems(env: Record<string, string | undefined>): string[] {
  if (!isHaProfile(env)) return []
  const set = (k: string) => (env[k] ?? '').trim() !== ''
  const problems: string[] = []
  if (!set('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')) {
    problems.push('Profil « ha » : NEXT_SERVER_ACTIONS_ENCRYPTION_KEY manquant (clé commune à tous les réplicas et stable d\'une version à l\'autre ; ./scripts/setup.sh --profil ha la génère).')
  } else if (!isValidServerActionsKey(env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)) {
    problems.push('Profil « ha » : NEXT_SERVER_ACTIONS_ENCRYPTION_KEY invalide (attendu : base64 d\'une clé AES de 16, 24 ou 32 octets, ex. openssl rand -base64 32).')
  }
  if ((env.DOCUMENT_STORAGE ?? '').trim().toLowerCase() !== 's3') {
    problems.push('Profil « ha » : DOCUMENT_STORAGE=s3 requis (un stockage local par réplica disperserait les documents).')
  }
  if (!set('REDIS_URL') && !set('REDIS_SENTINELS')) {
    problems.push('Profil « ha » : store Redis requis (REDIS_URL ou REDIS_SENTINELS) — sinon limites de débit et verrouillage de compte non partagés entre réplicas.')
  }
  return problems
}

/**
 * Clé de chaînage du journal d'audit (AUDIT_CHAIN_KEY, lib/audit-chaine) : en production, son absence est signalée
 * (avertissement, JAMAIS bloquant). Sans clé, la chaîne reste vérifiable (SHA-256) mais une personne ayant un accès en
 * écriture à la base pourrait la recalculer entièrement. Rend le message, ou null (jamais la valeur de la clé).
 */
export function auditChainKeyWarning(env: Record<string, string | undefined>): string | null {
  if (env.NODE_ENV !== 'production') return null
  if ((env.AUDIT_CHAIN_KEY ?? '').trim() !== '') return null
  return 'AUDIT_CHAIN_KEY non défini — journal d\'audit chaîné sans clé secrète (SHA-256 seul) : une personne ayant un accès en écriture à la base pourrait recalculer la chaîne. ./scripts/setup.sh la génère (à conserver dans un coffre, à ne jamais changer).'
}

/** Vérifie les variables d'environnement critiques au démarrage (secrets absents = bloquant ; valeurs par défaut = bloquant en prod). */
export function runStartupChecks() {
  let hasMissing   = false  // variable absente → bloque toujours
  let hasDefault   = false  // valeur par défaut → bloque en prod seulement

  // ── NEXTAUTH_SECRET ────────────────────────────────────────────────────────
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret || secret.trim() === '') {
    error('NEXTAUTH_SECRET est manquant.')
    hasMissing = true
  } else if (DEFAULT_SECRETS.some(d => secret.startsWith(d))) {
    error('NEXTAUTH_SECRET utilise une valeur par défaut non sécurisée.')
    hasDefault = true
  } else if (secret.length < 32) {
    error(`NEXTAUTH_SECRET trop court (${secret.length} chars, minimum 32).`)
    hasDefault = true
  } else {
    ok(`NEXTAUTH_SECRET configuré (${secret.length} chars)`)
  }

  // ── DATABASE_URL ───────────────────────────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl || dbUrl.trim() === '') {
    error('DATABASE_URL est manquant.')
    hasMissing = true
  } else if (DEFAULT_DB_PASSWORDS.some(p => dbUrl.includes(p))) {
    error('DATABASE_URL contient un mot de passe par défaut non sécurisé.')
    hasDefault = true
  } else {
    ok('DATABASE_URL configuré')
  }

  // ── NEXTAUTH_URL ───────────────────────────────────────────────────────────
  const nextAuthUrl = process.env.NEXTAUTH_URL
  if (!nextAuthUrl) {
    warn('NEXTAUTH_URL non défini — les redirections OAuth pourraient échouer.')
  } else if (IS_PROD && nextAuthUrl.startsWith('http://') && !nextAuthUrl.includes('localhost')) {
    warn('NEXTAUTH_URL utilise HTTP en production. Configurez HTTPS.')
    ok(`NEXTAUTH_URL = ${nextAuthUrl}`)
  } else {
    ok(`NEXTAUTH_URL = ${nextAuthUrl}`)
  }

  // ── SIEM_ALLOWED_HOSTS (défense SSRF, audit 2026-10-01 T17) ────────────────
  // Vide = toute destination SIEM est acceptée : un endpoint mal configuré ou altéré
  // peut viser un service interne. Avertissement (non bloquant : SIEM optionnel).
  if (IS_PROD && !(process.env.SIEM_ALLOWED_HOSTS ?? '').trim()) {
    warn('SIEM_ALLOWED_HOSTS non défini — destinations SIEM non restreintes (voir runbook § SIEM).')
  }

  // ── AUDIT_CHAIN_KEY (journal d'audit infalsifiable) : avertissement en production, non bloquant ──
  const auditKeyWarning = auditChainKeyWarning(process.env)
  if (auditKeyWarning) warn(auditKeyWarning)

  // ── Profil « ha » (multi-instance) : bloquant, en production comme ailleurs ──
  const haProblems = haProfileProblems(process.env)
  for (const p of haProblems) error(p)
  if (haProblems.length > 0) hasMissing = true
  else if (isHaProfile(process.env)) ok('Profil « ha » : clé des Server Functions, stockage S3 et store Redis déclarés')

  // ── Décision finale ────────────────────────────────────────────────────────
  const shouldBlock = hasMissing || (hasDefault && IS_PROD)

  if (shouldBlock) {
    printSetupHelp()
    if (hasMissing) {
      error('Démarrage impossible : des variables obligatoires sont manquantes.')
    } else {
      error('Démarrage bloqué en production : des secrets utilisent des valeurs par défaut.')
      error('Exécutez ./scripts/setup.sh pour générer un .env sécurisé.')
    }
    process.exit(1)
  }

  if (hasDefault && !IS_PROD) {
    warn('Des secrets utilisent des valeurs par défaut — acceptable en développement uniquement.')
    warn('Exécutez ./scripts/setup.sh avant tout déploiement en production.')
  }
}
