#!/usr/bin/env bash
# =============================================================================
# ACRA — Script de configuration initiale
# Génère automatiquement le fichier .env avec des secrets sécurisés.
# À exécuter une fois avant le premier `docker compose up`.
# Usage : ./scripts/setup.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

# ── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}ℹ${RESET}  $*"; }
success() { echo -e "${GREEN}✓${RESET}  $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✗${RESET}  $*"; }
header()  { echo -e "\n${BOLD}${CYAN}$*${RESET}"; echo -e "${CYAN}$(printf '%.0s─' {1..60})${RESET}"; }

# ── Vérifier openssl ─────────────────────────────────────────────────────────
if ! command -v openssl &> /dev/null; then
  error "openssl est requis pour générer les secrets. Installez-le d'abord."
  exit 1
fi

# ── Bannière ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${BLUE}║          ACRA — Configuration initiale                    ║${RESET}"
echo -e "${BOLD}${BLUE}║    Augmented Cyber Risk Analysis · Setup sécurisé         ║${RESET}"
echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── Vérifier si .env existe déjà ─────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  warn "Un fichier .env existe déjà : $ENV_FILE"
  echo -e "    ${YELLOW}Options :${RESET}"
  echo "    [r] Régénérer (l'ancien sera sauvegardé en .env.backup)"
  echo "    [k] Conserver le fichier actuel et quitter"
  echo ""
  read -rp "    Votre choix [r/k] : " choice
  case "$choice" in
    r|R)
      cp "$ENV_FILE" "$ENV_FILE.backup"
      success "Ancien .env sauvegardé en .env.backup"
      ;;
    *)
      info "Conservation du .env existant. Aucune modification."
      echo ""
      info "Lancez l'application avec : docker compose up -d"
      exit 0
      ;;
  esac
fi

# ── Générer les secrets ───────────────────────────────────────────────────────
header "Génération des secrets sécurisés"

NEXTAUTH_SECRET=$(openssl rand -base64 48)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
POSTGRES_USER="acra_user"
POSTGRES_DB="acra_rm"

success "NEXTAUTH_SECRET   : généré (64 chars, base64 aléatoire)"
success "POSTGRES_PASSWORD : généré (32 chars, alphanumérique)"
success "POSTGRES_USER     : $POSTGRES_USER"
success "POSTGRES_DB       : $POSTGRES_DB"

# ── Demander l'URL de l'application ──────────────────────────────────────────
header "Configuration de l'URL de l'application"
echo -e "  L'URL sur laquelle ACRA sera accessible."
echo -e "  ${YELLOW}Exemples :${RESET}"
echo -e "    http://localhost:3000      (développement local)"
echo -e "    https://acra.mondomaine.fr (production avec HTTPS)"
echo ""
read -rp "  URL de l'application [http://localhost:3000] : " NEXTAUTH_URL
NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}"

if [[ "$NEXTAUTH_URL" == http://* ]] && [[ "$NEXTAUTH_URL" != *"localhost"* ]]; then
  warn "Vous avez saisi une URL HTTP sans localhost."
  warn "En production, utilisez HTTPS pour sécuriser les sessions."
fi
success "NEXTAUTH_URL : $NEXTAUTH_URL"

# ── Clé API Anthropic (optionnelle) ──────────────────────────────────────────
header "Clé API Anthropic (fonctionnalité IA — optionnelle)"
echo -e "  La clé API Anthropic active les suggestions de scénarios IA dans les ateliers."
echo -e "  ${YELLOW}Pour obtenir une clé :${RESET} https://console.anthropic.com"
echo -e "  ${YELLOW}Format :${RESET} sk-ant-api03-..."
echo -e "  Laissez vide pour désactiver la fonctionnalité IA."
echo ""
read -rp "  Clé API Anthropic [laisser vide pour ignorer] : " ANTHROPIC_API_KEY
if [ -n "$ANTHROPIC_API_KEY" ]; then
  success "ANTHROPIC_API_KEY : configurée"
else
  warn "ANTHROPIC_API_KEY : non configurée — les suggestions IA seront désactivées"
fi

# ── Écrire le fichier .env ────────────────────────────────────────────────────
header "Écriture du fichier .env"

DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"

cat > "$ENV_FILE" << EOF
# =============================================================================
# ACRA — Configuration de l'application
# Généré automatiquement par scripts/setup.sh le $(date '+%Y-%m-%d %H:%M:%S')
# NE COMMITEZ PAS CE FICHIER (il est dans .gitignore)
# =============================================================================

# ── Base de données PostgreSQL ────────────────────────────────────────────────
# Identifiants du serveur PostgreSQL. Ces valeurs sont utilisées à la fois
# par le service "db" Docker et par la connexion Prisma dans "app".
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}

# URL de connexion Prisma — générée automatiquement depuis les variables ci-dessus.
# Format : postgresql://USER:PASSWORD@HOST:PORT/DATABASE
# En Docker Compose, le host est "db" (nom du service). En local, utilisez "localhost".
DATABASE_URL=${DATABASE_URL}

# ── Authentification NextAuth.js ──────────────────────────────────────────────
# Secret utilisé pour signer et vérifier les tokens JWT de session.
# CRITIQUE : cette valeur doit être unique, aléatoire, et gardée secrète.
# Pour régénérer : openssl rand -base64 48
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# URL publique de l'application — utilisée par NextAuth pour les redirections.
# En production : https://votre-domaine.com  (HTTPS obligatoire)
# En développement : http://localhost:3000
NEXTAUTH_URL=${NEXTAUTH_URL}

# ── Fonctionnalité IA (optionnel) ─────────────────────────────────────────────
# Clé API Anthropic pour les suggestions de scénarios EBIOS RM par IA.
# Obtenez une clé sur : https://console.anthropic.com
# Laissez vide pour désactiver : ANTHROPIC_API_KEY=
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
EOF

success ".env créé : $ENV_FILE"

# ── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║  Configuration terminée avec succès !                     ║${RESET}"
echo -e "${BOLD}${GREEN}╚════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Prochaines étapes :${RESET}"
echo ""
echo -e "    ${CYAN}1.${RESET} Démarrer l'application :"
echo -e "       ${BOLD}docker compose up -d${RESET}"
echo ""
echo -e "    ${CYAN}2.${RESET} Créer le premier compte administrateur :"
echo -e "       Ouvrez ${BOLD}${NEXTAUTH_URL}/auth/register${RESET}"
echo -e "       puis passez votre compte en ADMIN via la base de données."
echo ""
echo -e "    ${CYAN}3.${RESET} Consulter les logs :"
echo -e "       ${BOLD}docker compose logs -f app${RESET}"
echo ""
echo -e "  ${YELLOW}Important :${RESET} .env est dans .gitignore — ne le commitez jamais."
echo ""
