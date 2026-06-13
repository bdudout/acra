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
