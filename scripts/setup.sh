#!/usr/bin/env bash
# =============================================================================
# ACRA — Script de configuration initiale (.env)
# =============================================================================
# Génère le fichier .env avec des secrets sécurisés AVANT le premier
# `docker compose up`. Idempotent : ne génère que les valeurs manquantes,
# préserve celles déjà définies par l'administrateur.
#
# Usage :
#   ./scripts/setup.sh              Mode interactif (recommandé en local)
#   ./scripts/setup.sh --auto       Mode non-interactif : remplit tout secret
#                                    manquant avec une valeur aléatoire, sans
#                                    poser de question (idéal CI / prod scriptée)
#   ./scripts/setup.sh --force      Régénère TOUS les secrets (sauvegarde l'ancien)
#
# Aucune dépendance requise hormis bash + (openssl OU /dev/urandom).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# ── Options ────────────────────────────────────────────────────────────────
AUTO=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --auto|-y|--non-interactive) AUTO=1 ;;
    --force) FORCE=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -22
      exit 0 ;;
  esac
done

# ── Couleurs (désactivées si pas de TTY) ─────────────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; RESET=''
fi
info()    { echo -e "${BLUE}ℹ${RESET}  $*"; }
success() { echo -e "${GREEN}✓${RESET}  $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✗${RESET}  $*"; }
header()  { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }

# ── Génération de secrets (openssl, sinon /dev/urandom) ──────────────────────
# $1 = nombre d'octets d'entropie. Sortie : base64 nettoyé (alphanumérique).
gen_secret() {
  local bytes="$1" out
  if command -v openssl >/dev/null 2>&1; then
    out="$(openssl rand -base64 "$bytes")"
  elif [ -r /dev/urandom ]; then
    out="$(head -c "$bytes" /dev/urandom | base64)"
  else
    error "Ni openssl ni /dev/urandom disponibles — impossible de générer un secret."
    exit 1
  fi
  # Retire les caractères problématiques en .env / URL (/, +, =) et les sauts de ligne
  printf '%s' "$out" | tr -d '/+=\n'
}

# ── Lecture d'une valeur existante dans .env ─────────────────────────────────
read_env() {
  local key="$1"
  [ -f "$ENV_FILE" ] || { echo ""; return; }
  # Dernière occurrence, valeur après le premier '='
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- || echo ""
}

# Une valeur est "non définie" si vide ou si elle contient un placeholder connu.
is_unset() {
  local v="$1"
  [ -z "$v" ] || echo "$v" | grep -qiE 'CHANGEZ|changez_moi|placeholder|à modifier|a modifier'
}

# ── Bannière ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}ACRA — Configuration initiale (.env)${RESET}"
echo -e "${CYAN}Augmented Cyber Risk Analysis · setup sécurisé${RESET}"
[ "$AUTO" -eq 1 ] && info "Mode non-interactif (--auto)"

# ── Gestion d'un .env existant ───────────────────────────────────────────────
if [ -f "$ENV_FILE" ] && [ "$FORCE" -eq 1 ]; then
  cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d%H%M%S)"
  success "Ancien .env sauvegardé (.env.backup.*) — régénération complète demandée"
  rm -f "$ENV_FILE"
fi

EXISTING=0
[ -f "$ENV_FILE" ] && EXISTING=1
if [ "$EXISTING" -eq 1 ]; then
  info "Un .env existe déjà — seules les valeurs manquantes seront générées."
fi

# ── Résolution des variables (préserve l'existant, génère le manquant) ───────
header "Secrets & connexion"

POSTGRES_USER="$(read_env POSTGRES_USER)";       is_unset "$POSTGRES_USER"     && POSTGRES_USER="acra_user"
POSTGRES_DB="$(read_env POSTGRES_DB)";           is_unset "$POSTGRES_DB"       && POSTGRES_DB="acra_rm"

POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
if is_unset "$POSTGRES_PASSWORD"; then
  POSTGRES_PASSWORD="$(gen_secret 24 | head -c 32)"; success "POSTGRES_PASSWORD généré (32 car.)"
else success "POSTGRES_PASSWORD conservé"; fi

NEXTAUTH_SECRET="$(read_env NEXTAUTH_SECRET)"
if is_unset "$NEXTAUTH_SECRET"; then
  NEXTAUTH_SECRET="$(gen_secret 48)"; success "NEXTAUTH_SECRET généré (aléatoire)"
else success "NEXTAUTH_SECRET conservé"; fi

SECRETS_ENCRYPTION_KEY="$(read_env SECRETS_ENCRYPTION_KEY)"
if is_unset "$SECRETS_ENCRYPTION_KEY"; then
  SECRETS_ENCRYPTION_KEY="$(gen_secret 48)"; success "SECRETS_ENCRYPTION_KEY généré (chiffrement des secrets au repos)"
else success "SECRETS_ENCRYPTION_KEY conservé"; fi

# DATABASE_URL : conservée si déjà définie et valide (peut pointer une DB distante),
# sinon dérivée des variables POSTGRES_* (host "db" du service Docker Compose).
DATABASE_URL="$(read_env DATABASE_URL)"
if is_unset "$DATABASE_URL"; then
  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"
  success "DATABASE_URL dérivée des variables PostgreSQL"
else success "DATABASE_URL conservée"; fi

# NEXTAUTH_URL
NEXTAUTH_URL="$(read_env NEXTAUTH_URL)"
if is_unset "$NEXTAUTH_URL"; then
  if [ "$AUTO" -eq 1 ]; then
    NEXTAUTH_URL="http://localhost:3000"
  else
    header "URL publique de l'application"
    echo "  Ex : http://localhost:3000 (local) · https://acra.mondomaine.fr (prod HTTPS)"
    read -rp "  URL [http://localhost:3000] : " NEXTAUTH_URL
    NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}"
  fi
fi
case "$NEXTAUTH_URL" in
  http://*) [[ "$NEXTAUTH_URL" == *localhost* ]] || warn "URL en HTTP hors localhost — utilisez HTTPS en production." ;;
esac
success "NEXTAUTH_URL : $NEXTAUTH_URL"

# ── Écriture du .env ─────────────────────────────────────────────────────────
[ "$EXISTING" -eq 1 ] && cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d%H%M%S)"

cat > "$ENV_FILE" << EOF
# =============================================================================
# ACRA — Configuration de l'application
# Généré/mis à jour par scripts/setup.sh le $(date '+%Y-%m-%d %H:%M:%S')
# NE COMMITEZ PAS CE FICHIER (il est dans .gitignore)
# =============================================================================

# ── Base de données PostgreSQL ────────────────────────────────────────────────
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}

# URL de connexion Prisma (host "db" = service Docker Compose ; "localhost" en local)
DATABASE_URL=${DATABASE_URL}

# ── Authentification NextAuth.js ──────────────────────────────────────────────
# Secret de signature des sessions JWT. Régénérer : openssl rand -base64 48
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
# URL publique (HTTPS obligatoire en production)
NEXTAUTH_URL=${NEXTAUTH_URL}

# ── Chiffrement des secrets au repos (AES-256-GCM) ────────────────────────────
# Chiffre en base les secrets configurés via l'admin (OIDC client secret, SMS, SMTP).
# ⚠️ Si cette clé change, les secrets déjà chiffrés deviennent indéchiffrables.
SECRETS_ENCRYPTION_KEY=${SECRETS_ENCRYPTION_KEY}
EOF

chmod 600 "$ENV_FILE" 2>/dev/null || true
success ".env écrit : $ENV_FILE (permissions 600)"

# ── Étapes suivantes ─────────────────────────────────────────────────────────
header "Prochaines étapes"
echo -e "  ${CYAN}1.${RESET} Démarrer ACRA :        ${BOLD}docker compose up -d${RESET}"
echo -e "  ${CYAN}2.${RESET} Ouvrir :               ${BOLD}${NEXTAUTH_URL}/auth/register${RESET}"
echo -e "     → le ${BOLD}premier compte créé devient automatiquement ADMINISTRATEUR${RESET}."
echo -e "  ${CYAN}3.${RESET} Logs :                 ${BOLD}docker compose logs -f app${RESET}"
echo ""
warn ".env contient des secrets — il est ignoré par git (.gitignore). Ne le partagez pas."
echo ""
