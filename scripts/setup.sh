#!/usr/bin/env bash
# =============================================================================
# ACRA — Script de configuration initiale (.env)
# =============================================================================
# Génère le fichier .env avec des secrets sécurisés AVANT le premier
# `docker compose up`. Idempotent : ne génère que les valeurs manquantes,
# préserve celles déjà définies par l'administrateur (et les variables qu'il ne
# gère pas : SMTP, démo…). Un secret déjà présent n'est JAMAIS régénéré, sauf
# --force (et jamais NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ni AUDIT_CHAIN_KEY).
#
# Aucune dépendance requise hormis bash + (openssl OU /dev/urandom).
# Usage : ./scripts/setup.sh --help
# =============================================================================

set -euo pipefail
umask 077   # .env, fichier temporaire et sauvegardes : lisibles par le seul propriétaire

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
HA_COMPOSE="-f docker-compose.yml -f docker-compose.production.yml -f docker-compose.ha.yml"

usage() {
  cat <<'EOF'
ACRA — configuration initiale (.env)

  ./scripts/setup.sh                    Mono-instance, interactif (demande l'URL publique)
  ./scripts/setup.sh --auto             Mono-instance, sans question (secrets aléatoires,
                                        URL http://localhost:3000) — CI / prod scriptée
  ./scripts/setup.sh --force            Régénère les secrets (ancien .env sauvegardé) ;
                                        la clé des Server Functions et la clé de chaînage
                                        du journal d'audit sont TOUJOURS conservées

  ./scripts/setup.sh --profil ha        Multi-instance (docker-compose.ha.yml) : génère clé des
                                        Server Functions et mot de passe Redis, demande base,
                                        S3, Redis ; valide AVANT d'écrire ; puis docker compose config
  ./scripts/setup.sh --profil ha --auto Idem sans question : paramètres lus dans l'environnement
                                        (DOMAIN, ACME_EMAIL, DATABASE_URL, S3_*, REDIS_*…)

Options : --profil mono|ha (défaut : celui du .env existant, sinon mono)
          --sans-verification   ne lance pas `docker compose … config -q` (profil ha)
          -h, --help

Guide multi-instance : docs/deploiement-haute-disponibilite.md (§ 6).
Codes de sortie : 0 succès · 1 configuration invalide (rien écrit) · 2 usage · 3 docker compose config en échec.
EOF
}

# ── Options ────────────────────────────────────────────────────────────────
AUTO=0
FORCE=0
CHECK=1
PROFIL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --auto|-y|--non-interactive) AUTO=1 ;;
    --force) FORCE=1 ;;
    --profil|--profile) shift; PROFIL="${1:-}" ;;
    --profil=*|--profile=*) PROFIL="${1#*=}" ;;
    --ha) PROFIL=ha ;;
    --sans-verification|--no-check) CHECK=0 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done
case "$PROFIL" in
  ""|mono|ha) ;;
  *) echo "Profil inconnu : « $PROFIL » (attendu : mono ou ha)" >&2; exit 2 ;;
esac

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
error()   { echo -e "${RED}✗${RESET}  $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }

# ── Environnement d'appel (profil ha, mode non interactif) ───────────────────
# Copié AVANT toute affectation : le script réutilise ensuite les mêmes noms.
HA_KEYS=(DOMAIN ACME_EMAIL NEXTAUTH_URL ACRA_REPLICAS DATABASE_URL MIGRATION_DATABASE_URL
  S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_FORCE_PATH_STYLE S3_SSE S3_PREFIX
  REDIS_URL REDIS_PASSWORD REDIS_USERNAME REDIS_SENTINELS REDIS_SENTINEL_MASTER REDIS_SENTINEL_PASSWORD REDIS_TLS
  NEXTAUTH_SECRET SECRETS_ENCRYPTION_KEY CRON_SECRET NEXT_SERVER_ACTIONS_ENCRYPTION_KEY AUDIT_CHAIN_KEY)
for _k in "${HA_KEYS[@]}"; do printf -v "IN_$_k" '%s' "${!_k:-}"; done
for _k in "${HA_KEYS[@]}"; do unset "$_k"; done

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
# Clé AES de 32 octets en base64 STANDARD (avec + / =) : format exigé par Next.js pour
# NEXT_SERVER_ACTIONS_ENCRYPTION_KEY (node_modules/next/dist/docs/01-app/02-guides/self-hosting.md).
gen_aes_key() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -base64 32 | tr -d '\n'
  else head -c 32 /dev/urandom | base64 | tr -d '\n'; fi
}
# Clé de chaînage du journal d'audit : 32 octets aléatoires en base64 (openssl rand -base64 32).
gen_audit_key() { gen_aes_key; }
# Hexadécimal (32 octets → 64 car.) : inséré tel quel dans une URL redis:// (guide § 5).
gen_hex() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32
  else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

# Base64 d'une clé AES de 16, 24 ou 32 octets (même règle que lib/startup-checks.ts).
valid_aes_key() {
  local k="$1" n pad=0 bytes
  [[ "$k" =~ ^[A-Za-z0-9+/]+={0,2}$ ]] || return 1
  n=${#k}
  [ $((n % 4)) -eq 0 ] || return 1
  if [[ "$k" == *== ]]; then pad=2; elif [[ "$k" == *= ]]; then pad=1; fi
  bytes=$(( n / 4 * 3 - pad ))
  [ "$bytes" -eq 16 ] || [ "$bytes" -eq 24 ] || [ "$bytes" -eq 32 ]
}

# ── Lecture du .env existant ─────────────────────────────────────────────────
SRC_ENV=""          # fichier lu : .env existant (ou sa sauvegarde en cas de --force)
[ -f "$ENV_FILE" ] && SRC_ENV="$ENV_FILE"
read_file_env() {
  local key="$1"
  [ -n "$SRC_ENV" ] && [ -f "$SRC_ENV" ] || { echo ""; return; }
  # Dernière occurrence, valeur après le premier '='
  { grep -E "^${key}=" "$SRC_ENV" 2>/dev/null || true; } | tail -n1 | cut -d= -f2-
}
file_has_key() { [ -n "$SRC_ENV" ] && [ -f "$SRC_ENV" ] && grep -qE "^${1}=" "$SRC_ENV"; }
# --force : les valeurs existantes sont ignorées (régénération), sauf lecture explicite par read_file_env.
read_env() { if [ "$FORCE" -eq 1 ]; then echo ""; else read_file_env "$1"; fi; }

# Une valeur est "non définie" si vide ou si elle contient un placeholder connu.
is_unset() {
  local v="$1"
  [ -z "$v" ] || echo "$v" | grep -qiE 'CHANGEZ|changez_moi|placeholder|à modifier|a modifier'
}

# ── Profil ───────────────────────────────────────────────────────────────────
FILE_PROFIL="$(read_file_env ACRA_DEPLOY_PROFILE)"
if [ -z "$PROFIL" ]; then
  if [ "$FILE_PROFIL" = "ha" ]; then PROFIL=ha; else PROFIL=mono; fi
fi
if [ "$PROFIL" = "ha" ] && [ "$FORCE" -eq 1 ]; then
  error "--force est refusé en profil « ha » : tous les réplicas partagent ces secrets (sessions, clé des Server Functions)."
  error "Pour remplacer UN secret, modifiez-le dans .env en connaissance de cause (cf. docs/deploiement-haute-disponibilite.md)."
  exit 2
fi
FIRST_HA=0
[ "$PROFIL" = "ha" ] && [ "$FILE_PROFIL" != "ha" ] && FIRST_HA=1

# ── Bannière ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}ACRA — Configuration initiale (.env)${RESET}"
echo -e "${CYAN}Augmented Cyber (& Business) Risk Analysis · setup sécurisé${RESET}"
[ "$AUTO" -eq 1 ] && info "Mode non-interactif (--auto)"
if [ "$PROFIL" = "ha" ]; then
  info "Profil « ha » (multi-instance) — docs/deploiement-haute-disponibilite.md"
elif [ "$FILE_PROFIL" = "ha" ]; then
  warn "Le .env existant est en profil « ha » : --profil mono demandé, il repasse en mono-instance."
fi

ERRORS=()           # erreurs de validation : rien n'est écrit tant qu'il en reste
MISSING=()          # variables obligatoires absentes (profil ha)
SECRET_VALUES=()    # valeurs à masquer dans toute sortie (journal de docker compose compris)
add_secret() { [ -n "${1:-}" ] && SECRET_VALUES+=("$1"); return 0; }
fail() { ERRORS+=("$*"); }

# Valeur saisie ou lue dans l'environnement : doit pouvoir s'écrire telle quelle dans .env
# (Compose interpole « $ », interprète guillemets initiaux et commentaires « # »).
check_env_safe() {
  local var="$1" val="$2"
  [ -z "$val" ] && return 0
  if [[ "$val" == *$'\n'* || "$val" == *'$'* || "$val" == *[[:space:]]* || "$val" == \"* || "$val" == \'* || "$val" == *'#'* ]]; then
    fail "$var : caractère non accepté dans .env (\$, #, espace, guillemet initial ou saut de ligne) — dans une URL, encoder en %XX."
  fi
}

# Masque le mot de passe d'une URL (schéma://utilisateur:***@hôte…).
mask_url() { printf '%s' "$1" | sed -E 's#(://[^:/@]*:)[^@]*@#\1***@#'; }

# Secret généré : .env > environnement (profil ha) > génération. Un secret présent n'est JAMAIS remplacé :
# une valeur différente fournie par l'environnement est une erreur (sinon un réplica divergerait).
# $1 variable · $2 générateur · $3 libellé · $4 =keep : conservé même avec --force
resolve_secret() {
  local var="$1" gen="$2" label="$3" keep="${4:-}" cur in_var in val
  if [ "$keep" = "keep" ]; then cur="$(read_file_env "$var")"; else cur="$(read_env "$var")"; fi
  in_var="IN_$var"; in=""
  [ "$PROFIL" = "ha" ] && in="${!in_var}"
  if ! is_unset "$cur"; then
    if [ -n "$in" ] && [ "$in" != "$cur" ]; then
      fail "$var : la valeur fournie par l'environnement diffère de celle du .env ; un secret existant n'est jamais remplacé (retirer la variable de l'environnement, ou modifier .env à la main en connaissance de cause)."
    fi
    val="$cur"; success "$var — valeur conservée ($label)"
  elif [ -n "$in" ]; then
    check_env_safe "$var" "$in"
    val="$in"; success "$var — valeur reprise de l'environnement ($label)"
  else
    val="$($gen)"; success "$var — valeur générée ($label)"
  fi
  printf -v "$var" '%s' "$val"
  add_secret "$val"
}

# Saisie interactive. $1 variable · $2 libellé · $3 secret (1 = non réaffiché) · $4 défaut
ask() {
  local var="$1" label="$2" sec="$3" def="${4:-}" ans=""
  local prompt="  $label"
  [ -n "$def" ] && prompt="$prompt [$def]"
  if [ "$sec" -eq 1 ]; then
    read -rsp "$prompt (saisie masquée) : " ans || true; echo "" >&2
  else
    read -rp "$prompt : " ans || true
  fi
  [ -z "$ans" ] && ans="$def"
  printf -v "$var" '%s' "$ans"
}

# Paramètre externe (profil ha) : environnement > .env > question (interactif) > défaut.
# $1 variable · $2 libellé · $3 obligatoire (1/0) · $4 secret (1/0) · $5 défaut · $6 =first : question au 1er passage seulement
resolve_param() {
  local var="$1" label="$2" req="$3" sec="$4" def="${5:-}" when="${6:-}" in_var in cur val=""
  in_var="IN_$var"; in="${!in_var}"
  cur="$(read_env "$var")"
  if [ -n "$in" ]; then
    check_env_safe "$var" "$in"; val="$in"
  elif ! is_unset "$cur"; then
    val="$cur"
  elif [ "$AUTO" -eq 0 ] && { [ "$req" -eq 1 ] || { [ "$when" = "first" ] && [ "$FIRST_HA" -eq 1 ]; }; }; then
    ask val "$label" "$sec" "$def"
    check_env_safe "$var" "$val"
  else
    val="$def"
  fi
  if [ "$req" -eq 1 ] && [ -z "$val" ]; then MISSING+=("$var"); fi
  printf -v "$var" '%s' "$val"
  [ "$sec" -eq 1 ] && add_secret "$val"
  return 0
}

# Affichage sans secret d'un paramètre résolu.
show_param() {
  local var="$1" kind="${2:-}" v="${!1}"
  [ -z "$v" ] && return 0
  case "$kind" in
    secret) success "$var renseigné (masqué)" ;;
    url) success "$var : $(mask_url "$v")" ;;
    *) success "$var : $v" ;;
  esac
}

# URL PostgreSQL avec identifiants : postgres(ql)://utilisateur:motdepasse@hôte[:port]/base[?options]
pg_url_host() { local r="${1#*://}"; r="${r##*@}"; r="${r%%/*}"; printf '%s' "${r%%:*}"; }
validate_pg_url() {
  local var="$1" v="$2" host
  [ -z "$v" ] && return 0
  if ! [[ "$v" =~ ^postgres(ql)?://[^@/?#]+@[^/?#:@]+(:[0-9]{1,5})?/[A-Za-z0-9_.-]+(\?.*)?$ ]]; then
    fail "$var invalide : attendu postgresql://utilisateur:motdepasse@hôte[:port]/base[?sslmode=require]"; return 0
  fi
  host="$(pg_url_host "$v")"
  case "$host" in
    localhost|127.0.0.1) fail "$var : « $host » désigne le conteneur lui-même ; indiquer le point d'entrée de la base externe (§ 3 du guide)." ;;
    db) fail "$var : le service local « db » est désactivé en profil « ha » ; indiquer la base managée ou le port d'écriture HAProxy/Patroni (§ 3)." ;;
  esac
}
add_url_password() { local v="$1" r; r="${v#*://}"; [[ "$r" == *@* ]] || return 0; r="${r%%@*}"; [[ "$r" == *:* ]] && add_secret "${r#*:}"; return 0; }

# ── Gestion d'un .env existant ───────────────────────────────────────────────
EXISTING=0
[ -f "$ENV_FILE" ] && EXISTING=1
if [ "$EXISTING" -eq 1 ] && [ "$FORCE" -eq 1 ]; then
  info "Régénération des secrets demandée (--force) : l'ancien .env sera sauvegardé ; la clé des Server Functions et les variables non gérées par ce script sont conservées."
elif [ "$EXISTING" -eq 1 ]; then
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
add_secret "$POSTGRES_PASSWORD"

gen_48() { gen_secret 48; }
gen_32() { gen_secret 32; }
resolve_secret NEXTAUTH_SECRET gen_48 "signature des sessions"
resolve_secret SECRETS_ENCRYPTION_KEY gen_48 "chiffrement des secrets au repos"
# CRON_SECRET : protège les endpoints /api/cron/* déclenchés par le service "scheduler".
resolve_secret CRON_SECRET gen_32 "planification des tâches périodiques"
# Clé des Server Functions de Next.js : générée une fois, stable d'une construction à l'autre, JAMAIS régénérée
# (la changer casserait la coexistence de deux versions pendant une mise à jour progressive).
resolve_secret NEXT_SERVER_ACTIONS_ENCRYPTION_KEY gen_aes_key "clé des Server Functions, stable" keep
# Clé de chaînage du journal d'audit (HMAC-SHA256, lib/audit-chaine) : générée une fois pour TOUTE installation,
# JAMAIS régénérée (même avec --force) : la changer rendrait invérifiables les entrées déjà scellées.
AUDIT_KEY_PRESENT=0; is_unset "$(read_file_env AUDIT_CHAIN_KEY)" || AUDIT_KEY_PRESENT=1
resolve_secret AUDIT_CHAIN_KEY gen_audit_key "chaînage du journal d'audit, stable" keep
if [ "$AUDIT_KEY_PRESENT" -eq 0 ] && [ "$EXISTING" -eq 1 ]; then
  warn "AUDIT_CHAIN_KEY ajoutée à une installation existante : les entrées du journal déjà scellées SANS clé restent vérifiables ;"
  warn "les suivantes seront scellées avec la clé. Notez le nombre d'entrées « sans clé » affiché par la vérification d'intégrité (docs/runbook-exploitation.md)."
fi
warn "Conservez AUDIT_CHAIN_KEY dans un coffre avec les autres secrets du .env et ne la changez jamais."
if ! valid_aes_key "$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"; then
  fail "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY présente mais invalide (attendu : base64 d'une clé AES de 16, 24 ou 32 octets). Elle n'est jamais remplacée automatiquement : la corriger, ou retirer la ligne de .env si aucune image n'a été construite avec."
fi

if [ "$PROFIL" = "mono" ]; then
  # DATABASE_URL : conservée si déjà définie et valide (peut pointer une DB distante),
  # sinon dérivée des variables POSTGRES_* (host "db" du service Docker Compose).
  DATABASE_URL="$(read_env DATABASE_URL)"
  if is_unset "$DATABASE_URL"; then
    DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"
    success "DATABASE_URL dérivée des variables PostgreSQL"
  else success "DATABASE_URL conservée"; fi

  NEXTAUTH_URL="$(read_env NEXTAUTH_URL)"
  if is_unset "$NEXTAUTH_URL"; then
    if [ "$AUTO" -eq 1 ]; then
      NEXTAUTH_URL="http://localhost:3000"
    else
      header "URL publique de l'application"
      echo "  Ex : http://localhost:3000 (local) · https://acra.mondomaine.fr (prod HTTPS)"
      read -rp "  URL [http://localhost:3000] : " NEXTAUTH_URL || true
      NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}"
    fi
  fi
  case "$NEXTAUTH_URL" in
    http://*) [[ "$NEXTAUTH_URL" == *localhost* ]] || warn "URL en HTTP hors localhost — utilisez HTTPS en production." ;;
  esac
  success "NEXTAUTH_URL : $NEXTAUTH_URL"
else
  # ══ Profil « ha » : paramètres externes ════════════════════════════════════
  # Valeurs héritées d'une installation mono-instance, inutilisables en multi-instance : redemandées.
  _db="$(read_env DATABASE_URL)"
  if [ -z "$IN_DATABASE_URL" ] && ! is_unset "$_db"; then
    case "$(pg_url_host "$_db")" in db|localhost|127.0.0.1)
      info "DATABASE_URL du .env désigne la base locale : non reprise (base externe obligatoire en profil « ha »)."
      SKIP_FILE_DATABASE_URL=1 ;;
    esac
  fi
  _nu="$(read_env NEXTAUTH_URL)"
  [[ -z "$IN_NEXTAUTH_URL" && "$_nu" == http://localhost* ]] && SKIP_FILE_NEXTAUTH_URL=1

  header "Domaine public (Caddy, TLS automatique)"
  resolve_param DOMAIN "Nom de domaine public (ex. acra.mondomaine.fr)" 1 0
  resolve_param ACME_EMAIL "E-mail de contact Let's Encrypt" 1 0
  if [ "${SKIP_FILE_NEXTAUTH_URL:-0}" -eq 1 ]; then
    NEXTAUTH_URL="${DOMAIN:+https://$DOMAIN}"
    [ "$AUTO" -eq 0 ] && ask NEXTAUTH_URL "URL publique" 0 "$NEXTAUTH_URL"
  else
    resolve_param NEXTAUTH_URL "URL publique" 1 0 "${DOMAIN:+https://$DOMAIN}" first
  fi
  [ -z "$NEXTAUTH_URL" ] && [ -n "$DOMAIN" ] && NEXTAUTH_URL="https://$DOMAIN"
  resolve_param ACRA_REPLICAS "Nombre de réplicas de l'application" 0 0 3 first

  header "Base de données externe (base managée ou Patroni — guide § 3)"
  if [ "${SKIP_FILE_DATABASE_URL:-0}" -eq 1 ]; then
    DATABASE_URL=""
    if [ "$AUTO" -eq 0 ]; then ask DATABASE_URL "DATABASE_URL (postgresql://utilisateur:motdepasse@hôte:5432/base)" 1; check_env_safe DATABASE_URL "$DATABASE_URL"; fi
    [ -z "$DATABASE_URL" ] && MISSING+=(DATABASE_URL)
  else
    resolve_param DATABASE_URL "DATABASE_URL (postgresql://utilisateur:motdepasse@hôte:5432/base)" 1 1
  fi
  resolve_param MIGRATION_DATABASE_URL "MIGRATION_DATABASE_URL — connexion DIRECTE au primaire pour les migrations (vide = DATABASE_URL)" 0 1 "" first
  add_url_password "$DATABASE_URL"; add_url_password "$MIGRATION_DATABASE_URL"

  header "Stockage des documents S3 compatible (bucket versionné et chiffré — guide § 4)"
  resolve_param S3_ENDPOINT "S3_ENDPOINT (https://hôte[:port], sans chemin)" 1 0
  resolve_param S3_REGION "S3_REGION" 1 0
  resolve_param S3_BUCKET "S3_BUCKET" 1 0
  resolve_param S3_ACCESS_KEY_ID "S3_ACCESS_KEY_ID" 1 0
  resolve_param S3_SECRET_ACCESS_KEY "S3_SECRET_ACCESS_KEY" 1 1
  resolve_param S3_FORCE_PATH_STYLE "S3_FORCE_PATH_STYLE" 0 0 true
  resolve_param S3_SSE "S3_SSE — chiffrement côté serveur (AES256, ou vide si le bucket chiffre par défaut)" 0 0 "" first
  resolve_param S3_PREFIX "S3_PREFIX — préfixe facultatif (bucket mutualisé)" 0 0 "" first

  header "Redis partagé (limites de débit, verrouillage de compte — guide § 5)"
  # Mode : REDIS_SENTINELS → Sentinel ; REDIS_URL vers un autre hôte que le conteneur « redis » → managé ;
  # sinon conteneur local fourni par docker-compose.ha.yml (essai, un seul hôte).
  REDIS_URL="$IN_REDIS_URL"; [ -z "$REDIS_URL" ] && REDIS_URL="$(read_env REDIS_URL)"
  is_unset "$REDIS_URL" && REDIS_URL=""
  REDIS_SENTINELS="$IN_REDIS_SENTINELS"; [ -z "$REDIS_SENTINELS" ] && REDIS_SENTINELS="$(read_env REDIS_SENTINELS)"
  if [ -n "$REDIS_URL" ] && [ -n "$REDIS_SENTINELS" ]; then
    fail "REDIS_URL et REDIS_SENTINELS sont exclusifs : Redis managé (REDIS_URL) OU Redis Sentinel (REDIS_SENTINELS + REDIS_SENTINEL_MASTER), pas les deux."
    REDIS_MODE=invalide
  elif [ -n "$REDIS_SENTINELS" ]; then REDIS_MODE=sentinel
  elif [ -n "$REDIS_URL" ]; then
    _rh="${REDIS_URL#*://}"; _rh="${_rh##*@}"; _rh="${_rh%%[:/]*}"
    if [ "$_rh" = "redis" ]; then REDIS_MODE=local; REDIS_URL=""; else REDIS_MODE=url; fi
  elif [ "$AUTO" -eq 0 ] && [ "$FIRST_HA" -eq 1 ]; then
    echo "  1) conteneur Redis fourni (un seul hôte : essai, point de défaillance unique)"
    echo "  2) Redis managé (REDIS_URL, bascule gérée par l'hébergeur — recommandé)"
    echo "  3) Redis Sentinel auto-hébergé (3 sentinelles)"
    _choix=""; read -rp "  Choix [1] : " _choix || true
    case "${_choix:-1}" in
      2) REDIS_MODE=url; ask REDIS_URL "REDIS_URL (rediss://[utilisateur[:motdepasse]@]hôte:port[/base])" 1; check_env_safe REDIS_URL "$REDIS_URL" ;;
      3) REDIS_MODE=sentinel; ask REDIS_SENTINELS "REDIS_SENTINELS (hote1:26379,hote2:26379,hote3:26379)" 0; check_env_safe REDIS_SENTINELS "$REDIS_SENTINELS" ;;
      *) REDIS_MODE=local ;;
    esac
  else REDIS_MODE=local; fi
  [ -n "$IN_REDIS_SENTINELS" ] && check_env_safe REDIS_SENTINELS "$IN_REDIS_SENTINELS"
  [ -n "$IN_REDIS_URL" ] && check_env_safe REDIS_URL "$IN_REDIS_URL"
  REDIS_USERNAME=""; REDIS_SENTINEL_MASTER=""; REDIS_SENTINEL_PASSWORD=""; REDIS_TLS=""

  case "$REDIS_MODE" in
    local)
      resolve_secret REDIS_PASSWORD gen_hex "mot de passe du conteneur Redis"
      [[ "$REDIS_PASSWORD" =~ ^[A-Za-z0-9._~-]+$ ]] || fail "REDIS_PASSWORD : inséré dans l'URL redis:// du conteneur local, il ne doit contenir que [A-Za-z0-9._~-] (openssl rand -hex 32)."
      warn "Redis : conteneur unique sur cet hôte — point de défaillance unique de la connexion. Production : Redis managé ou Sentinel (guide § 5)."
      ;;
    url)
      if ! [[ "$REDIS_URL" =~ ^rediss?://[^/?#[:space:]]+(/[0-9]+)?/?$ ]]; then
        fail "REDIS_URL invalide : attendu redis:// ou rediss://[utilisateur[:motdepasse]@]hôte[:port][/base]"
      fi
      [[ "$REDIS_URL" == redis://* ]] && warn "REDIS_URL sans TLS (redis://) : utiliser rediss:// hors réseau privé dédié."
      _rp=""; _r="${REDIS_URL#*://}"
      if [[ "$_r" == *@* ]]; then _r="${_r%%@*}"; [[ "$_r" == *:* ]] && _rp="${_r#*:}"; fi
      # L'application décode le mot de passe de l'URL (%XX) avant de le comparer à REDIS_PASSWORD.
      if [[ "$_rp" == *%* ]]; then _rp="$(printf '%b' "${_rp//%/\\x}")"; check_env_safe "REDIS_PASSWORD (décodé de REDIS_URL)" "$_rp"; fi
      _cur="$IN_REDIS_PASSWORD"; [ -z "$_cur" ] && _cur="$(read_env REDIS_PASSWORD)"
      if [ -n "$_rp" ]; then
        if [ -n "$_cur" ] && [ "$_cur" != "$_rp" ]; then
          fail "REDIS_PASSWORD diffère du mot de passe contenu dans REDIS_URL (l'application refuserait de démarrer) : n'en garder qu'un, identique."
        fi
        REDIS_PASSWORD="$_rp"
      elif [ -n "$_cur" ]; then
        REDIS_PASSWORD="$_cur"; check_env_safe REDIS_PASSWORD "$_cur"
      else
        REDIS_PASSWORD=""
        [ "$AUTO" -eq 0 ] && ask REDIS_PASSWORD "Mot de passe du Redis managé" 1
        check_env_safe REDIS_PASSWORD "$REDIS_PASSWORD"
      fi
      [ -z "$REDIS_PASSWORD" ] && fail "REDIS_PASSWORD : Redis externe sans mot de passe refusé (le mettre dans REDIS_URL ou REDIS_PASSWORD)."
      add_secret "$REDIS_PASSWORD"; add_url_password "$REDIS_URL"
      resolve_param REDIS_USERNAME "REDIS_USERNAME — utilisateur ACL (facultatif)" 0 0 "" first
      success "Redis managé : $(mask_url "$REDIS_URL")"
      ;;
    sentinel)
      _ent='(\[[0-9A-Fa-f:]+\]|[A-Za-z0-9._-]+)(:[0-9]{1,5})?'
      [[ "$REDIS_SENTINELS" =~ ^${_ent}(,${_ent})*$ ]] || fail "REDIS_SENTINELS invalide : liste hôte[:port] séparée par des virgules (ex. redis1:26379,redis2:26379,redis3:26379)."
      resolve_param REDIS_SENTINEL_MASTER "REDIS_SENTINEL_MASTER — nom du primaire (sentinel monitor <nom>, ex. acra)" 1 0
      [ -n "$REDIS_SENTINEL_MASTER" ] && ! [[ "$REDIS_SENTINEL_MASTER" =~ ^[A-Za-z0-9._-]+$ ]] && fail "REDIS_SENTINEL_MASTER invalide."
      resolve_param REDIS_PASSWORD "REDIS_PASSWORD — mot de passe du primaire Redis" 1 1
      resolve_param REDIS_SENTINEL_PASSWORD "REDIS_SENTINEL_PASSWORD — mot de passe des sentinelles (facultatif)" 0 1 "" first
      resolve_param REDIS_USERNAME "REDIS_USERNAME — utilisateur ACL (facultatif)" 0 0 "" first
      resolve_param REDIS_TLS "REDIS_TLS (1 = TLS, 0 = non)" 0 0 "" first
      case "$REDIS_TLS" in ""|0|1) ;; *) fail "REDIS_TLS : 0 ou 1." ;; esac
      success "Redis Sentinel : $REDIS_SENTINELS (primaire « ${REDIS_SENTINEL_MASTER:-?} »)"
      ;;
  esac

  # ── Validation (AVANT toute écriture) ──────────────────────────────────────
  if [ -n "$DOMAIN" ] && ! [[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$ ]]; then
    fail "DOMAIN invalide : nom d'hôte public (ex. acra.mondomaine.fr)."
  fi
  if [ -n "$ACME_EMAIL" ] && ! [[ "$ACME_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
    fail "ACME_EMAIL invalide."
  fi
  [[ "$ACME_EMAIL" == *@example.* ]] && warn "ACME_EMAIL est une adresse d'exemple : Let's Encrypt n'enverra aucun avis d'expiration."
  if [ -n "$NEXTAUTH_URL" ]; then
    if ! [[ "$NEXTAUTH_URL" =~ ^https://[^/[:space:]]+/?$ ]]; then
      fail "NEXTAUTH_URL : https://<domaine> attendu en profil « ha » (TLS terminé par Caddy)."
    elif [ -n "$DOMAIN" ] && [[ "$NEXTAUTH_URL" != "https://$DOMAIN" && "$NEXTAUTH_URL" != "https://$DOMAIN/" ]]; then
      warn "NEXTAUTH_URL ($NEXTAUTH_URL) ne correspond pas à DOMAIN ($DOMAIN)."
    fi
  fi
  if ! [[ "$ACRA_REPLICAS" =~ ^[0-9]+$ ]] || [ "$ACRA_REPLICAS" -lt 1 ] || [ "$ACRA_REPLICAS" -gt 50 ]; then
    fail "ACRA_REPLICAS : entier entre 1 et 50."
  elif [ "$ACRA_REPLICAS" -lt 2 ]; then
    warn "ACRA_REPLICAS=1 : aucune redondance de l'application."
  fi
  validate_pg_url DATABASE_URL "$DATABASE_URL"
  validate_pg_url MIGRATION_DATABASE_URL "$MIGRATION_DATABASE_URL"
  if [ -n "$S3_ENDPOINT" ]; then
    if ! [[ "$S3_ENDPOINT" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$ ]]; then
      fail "S3_ENDPOINT invalide : http(s)://hôte[:port], sans chemin (le bucket va dans S3_BUCKET)."
    elif [[ "$S3_ENDPOINT" == http://* ]]; then
      warn "S3_ENDPOINT en HTTP : les documents transiteraient en clair (HTTPS recommandé)."
    fi
  fi
  [ -n "$S3_REGION" ] && ! [[ "$S3_REGION" =~ ^[A-Za-z0-9_-]+$ ]] && fail "S3_REGION invalide."
  [ -n "$S3_BUCKET" ] && ! [[ "$S3_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] && fail "S3_BUCKET invalide : 3 à 63 caractères, minuscules, chiffres, points et tirets."
  case "$S3_FORCE_PATH_STYLE" in true|false) ;; *) fail "S3_FORCE_PATH_STYLE : true ou false." ;; esac
  case "$S3_SSE" in ""|AES256|1) ;; *) fail "S3_SSE : vide, AES256 ou 1 (le KMS n'est pas pris en charge)." ;; esac
  [ -z "$S3_SSE" ] && info "S3_SSE vide : activer le chiffrement par défaut du bucket chez le fournisseur (guide § 4)."

  show_param DOMAIN; show_param ACME_EMAIL; show_param NEXTAUTH_URL; show_param ACRA_REPLICAS
  show_param DATABASE_URL url; show_param MIGRATION_DATABASE_URL url
  show_param S3_ENDPOINT; show_param S3_REGION; show_param S3_BUCKET; show_param S3_ACCESS_KEY_ID; show_param S3_SECRET_ACCESS_KEY secret
  show_param S3_SSE; show_param S3_PREFIX
fi

# ── Arrêt si la configuration est incomplète ou invalide : rien n'est écrit ──
if [ "${#MISSING[@]}" -gt 0 ]; then
  fail "Variables obligatoires manquantes : ${MISSING[*]}$([ "$AUTO" -eq 1 ] && echo " — en mode --auto, les fournir par l'environnement (ex. DATABASE_URL=… ./scripts/setup.sh --profil ha --auto)")."
fi
if [ "${#ERRORS[@]}" -gt 0 ]; then
  header "Configuration refusée — .env non modifié"
  for e in "${ERRORS[@]}"; do error "$e"; done
  exit 1
fi

# ── Écriture du .env (fichier temporaire 600 puis renommage atomique) ────────
if [ "$EXISTING" -eq 1 ]; then
  BACKUP="$ENV_FILE.backup.$(date +%Y%m%d%H%M%S)"
  cp "$ENV_FILE" "$BACKUP"; chmod 600 "$BACKUP" 2>/dev/null || true
  SRC_ENV="$BACKUP"
  success "Ancien .env sauvegardé ($(basename "$BACKUP"))"
fi

MANAGED=" POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL NEXTAUTH_SECRET NEXTAUTH_URL SECRETS_ENCRYPTION_KEY CRON_SECRET NEXT_SERVER_ACTIONS_ENCRYPTION_KEY AUDIT_CHAIN_KEY ACRA_DEPLOY_PROFILE "
[ "$PROFIL" = "ha" ] && MANAGED="$MANAGED ${HA_KEYS[*]} "

emit_env() {
  cat << EOF
# =============================================================================
# ACRA — Configuration de l'application
# Généré/mis à jour par scripts/setup.sh le $(date '+%Y-%m-%d %H:%M:%S')
# NE COMMITEZ PAS CE FICHIER (il est dans .gitignore)
# =============================================================================
EOF
  if [ "$PROFIL" = "ha" ]; then
    cat << EOF

# ── Profil de déploiement ─────────────────────────────────────────────────────
# Multi-instance : docker compose ${HA_COMPOSE} …
# (repère pour scripts/setup.sh ; docker-compose.ha.yml le transmet lui-même à l'application)
ACRA_DEPLOY_PROFILE=ha
ACRA_REPLICAS=${ACRA_REPLICAS}
DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
EOF
  fi
  cat << EOF

# ── Base de données PostgreSQL ────────────────────────────────────────────────
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}

EOF
  if [ "$PROFIL" = "ha" ]; then
    cat << EOF
# Base EXTERNE (managée ou point d'entrée Patroni) ; POSTGRES_* ne servent qu'à l'essai --profile base-locale.
DATABASE_URL=${DATABASE_URL}
# Migrations : connexion directe au primaire (verrou de session Prisma), vide = DATABASE_URL.
MIGRATION_DATABASE_URL=${MIGRATION_DATABASE_URL}
EOF
  else
    cat << EOF
# URL de connexion Prisma (host "db" = service Docker Compose ; "localhost" en local)
DATABASE_URL=${DATABASE_URL}
EOF
  fi
  cat << EOF

# ── Authentification NextAuth.js ──────────────────────────────────────────────
# Secret de signature des sessions JWT. Régénérer : openssl rand -base64 48
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
# URL publique (HTTPS obligatoire en production)
NEXTAUTH_URL=${NEXTAUTH_URL}

# ── Chiffrement des secrets au repos (AES-256-GCM) ────────────────────────────
# Chiffre en base les secrets configurés via l'admin (OIDC client secret, SMS, SMTP).
# ⚠️ Si cette clé change, les secrets déjà chiffrés deviennent indéchiffrables.
SECRETS_ENCRYPTION_KEY=${SECRETS_ENCRYPTION_KEY}

# ── Clé des Server Functions de Next.js (lue par \`next build\`) ────────────────
# Base64 d'une clé AES de 32 octets, générée UNE fois : stable d'une construction à l'autre et
# commune à tous les réplicas. ⚠️ Ne JAMAIS la changer (deux versions ne pourraient plus coexister
# pendant une mise à jour progressive). Obligatoire en profil « ha ».
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}

# ── Journal d'audit infalsifiable : clé de chaînage (HMAC-SHA256) ───────────────
# Générée UNE fois. ⚠️ Ne JAMAIS la changer : les entrées déjà scellées deviendraient invérifiables.
# À conserver dans un coffre et à sauvegarder avec les autres secrets (perte de l'hôte).
AUDIT_CHAIN_KEY=${AUDIT_CHAIN_KEY}

# ── Tâches planifiées (/api/cron/*) ───────────────────────────────────────────
# Jeton du service "scheduler" (docker-compose) : snapshots de conformité et
# alertes/synthèses de dérogations. Vide ⇒ planification désactivée (endpoints 503).
CRON_SECRET=${CRON_SECRET}
EOF
  if [ "$PROFIL" = "ha" ]; then
    cat << EOF

# ── Documents : stockage objet S3 compatible (bucket versionné, chiffré, privé) ──
S3_ENDPOINT=${S3_ENDPOINT}
S3_REGION=${S3_REGION}
S3_BUCKET=${S3_BUCKET}
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
S3_FORCE_PATH_STYLE=${S3_FORCE_PATH_STYLE}
S3_SSE=${S3_SSE}
S3_PREFIX=${S3_PREFIX}

# ── Redis partagé (limites de débit, verrouillage de compte) ──────────────────
EOF
    case "$REDIS_MODE" in
      local) cat << EOF
# Mode : conteneur « redis » de docker-compose.ha.yml (REDIS_URL volontairement ABSENTE).
REDIS_PASSWORD=${REDIS_PASSWORD}
EOF
      ;;
      url) cat << EOF
# Mode : Redis managé (point d'entrée unique).
REDIS_URL=${REDIS_URL}
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_USERNAME=${REDIS_USERNAME}
EOF
      ;;
      sentinel) cat << EOF
# Mode : Redis Sentinel. REDIS_URL VIDE volontairement (annule le conteneur local ; exclusif avec REDIS_SENTINELS).
REDIS_URL=
REDIS_SENTINELS=${REDIS_SENTINELS}
REDIS_SENTINEL_MASTER=${REDIS_SENTINEL_MASTER}
REDIS_SENTINEL_PASSWORD=${REDIS_SENTINEL_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_USERNAME=${REDIS_USERNAME}
REDIS_TLS=${REDIS_TLS}
EOF
      ;;
    esac
  fi
  # Variables non gérées par ce script (SMTP, démo, réglages…) : recopiées telles quelles.
  if [ -n "$SRC_ENV" ] && [ -f "$SRC_ENV" ]; then
    local extras="" line k
    while IFS= read -r line || [ -n "$line" ]; do
      [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
      k="${line%%=*}"
      [[ "$MANAGED" == *" $k "* ]] && continue
      extras+="$line"$'\n'
    done < "$SRC_ENV"
    if [ -n "$extras" ]; then
      printf '\n# ── Autres variables (conservées par scripts/setup.sh) ──────────────────────\n%s' "$extras"
    fi
  fi
}

TMP_ENV="$(mktemp "$ROOT_DIR/.env.tmp.XXXXXX")"
trap 'rm -f "$TMP_ENV"' EXIT
emit_env > "$TMP_ENV"
chmod 600 "$TMP_ENV"
mv -f "$TMP_ENV" "$ENV_FILE"
trap - EXIT
if [ "$EXISTING" -eq 1 ] && [ "$FORCE" -eq 1 ]; then
  success "Secrets régénérés (--force) ; NEXT_SERVER_ACTIONS_ENCRYPTION_KEY et AUDIT_CHAIN_KEY conservées"
fi
# Dossier d'échange du bouton « Mettre à jour » : créé ici (utilisateur courant)
# pour que Docker ne le crée pas en root au premier démarrage.
(umask 022; mkdir -p "$ROOT_DIR/.acra-update") 2>/dev/null || true
success ".env écrit : $ENV_FILE (permissions 600)"

# Remplace toute valeur secrète par *** (sortie d'outils externes).
mask_secrets() {
  local text="$1" s
  for s in ${SECRET_VALUES[@]+"${SECRET_VALUES[@]}"}; do
    [ "${#s}" -ge 3 ] && text="${text//"$s"/***}"
  done
  printf '%s\n' "$text"
}

# ── Étapes suivantes ─────────────────────────────────────────────────────────
if [ "$PROFIL" = "mono" ]; then
  header "Prochaines étapes"
  echo -e "  ${CYAN}1.${RESET} Démarrer ACRA :        ${BOLD}docker compose up -d${RESET}"
  echo -e "  ${CYAN}2.${RESET} Créer l'admin local :  ${BOLD}docker compose exec app node scripts/create-admin.mjs <email> SUPER_ADMIN${RESET}"
  echo -e "     → en production, utilisez aussi ${BOLD}-f docker-compose.production.yml${RESET} (pas de PostgreSQL publié)."
  echo -e "  ${CYAN}3.${RESET} Ouvrir :               ${BOLD}${NEXTAUTH_URL}${RESET}"
  echo -e "  ${CYAN}4.${RESET} Logs :                 ${BOLD}docker compose logs -f app${RESET}"
  echo -e "  ${CYAN}5.${RESET} Bouton « Mettre à jour » (facultatif) : ${BOLD}scripts/update-agent.sh --install${RESET}"
  echo ""
  warn ".env contient des secrets — il est ignoré par git (.gitignore). Ne le partagez pas ; sauvegardez-le dans un coffre (AUDIT_CHAIN_KEY comprise)."
  echo ""
  exit 0
fi

# ── Profil « ha » : vérification par docker compose config ───────────────────
header "Vérification : docker compose … config"
if [ "$CHECK" -eq 0 ]; then
  warn "Vérification sautée (--sans-verification). À lancer : docker compose ${HA_COMPOSE} config -q"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  # -q : aucune configuration résolue affichée (elle contiendrait les secrets) ; erreurs masquées.
  set +e
  # shellcheck disable=SC2086
  CHECK_OUT="$(cd "$ROOT_DIR" && docker compose ${HA_COMPOSE} config -q 2>&1)"
  CHECK_RC=$?
  set -e
  if [ "$CHECK_RC" -ne 0 ]; then
    error "docker compose config a échoué (le .env est écrit ; corriger puis relancer setup.sh) :"
    mask_secrets "$CHECK_OUT" >&2
    exit 3
  fi
  success "docker compose config : configuration du profil « ha » valide"
else
  warn "docker compose indisponible : vérification NON faite. À lancer sur l'hôte : docker compose ${HA_COMPOSE} config -q"
fi

F="$HA_COMPOSE"
header "Prochaines étapes (profil « ha » — guide § 6)"
echo -e "  ${CYAN}0.${RESET} Prérequis à confirmer chez les fournisseurs (non vérifiables par ce script) :"
echo -e "     base HA joignable et sauvegardée en continu (PITR) · bucket ${BOLD}${S3_BUCKET}${RESET} privé, versionné, chiffré · Redis protégé."
echo -e "  ${CYAN}1.${RESET} Construire l'image :              ${BOLD}docker compose ${F} build app migrator${RESET}"
echo -e "  ${CYAN}2.${RESET} Migrations, UNE seule fois :      ${BOLD}docker compose ${F} run --rm --no-deps migrator${RESET}"
echo -e "     (vérifier la sortie ; à l'étape 3, le service migrator repasse avant les réplicas, sans effet)"
echo -e "  ${CYAN}3.${RESET} Démarrer redis, ${ACRA_REPLICAS} réplicas, caddy et le planificateur :"
echo -e "                                      ${BOLD}docker compose ${F} up -d${RESET}"
echo -e "  ${CYAN}4.${RESET} Administrateur initial :          ${BOLD}docker compose ${F} exec app node scripts/create-admin.mjs <email> SUPER_ADMIN${RESET}"
echo -e "  ${CYAN}5.${RESET} Planificateur UNIQUE : le service ${BOLD}scheduler${RESET} de cet hôte, et lui seul"
echo -e "     (ne pas activer aussi .github/workflows/scheduled-tasks.yml ni un second hôte avec scheduler)."
echo -e "  ${CYAN}6.${RESET} Recette : https://${DOMAIN}/api/health, connexion, téléversement d'un document (objet visible dans le bucket),"
echo -e "     ${BOLD}docker stop${RESET} d'un réplica sans erreur visible (guide § 6, « Vérifications après installation »)."
echo -e "  ${CYAN}7.${RESET} Mises à jour : ${BOLD}scripts/update-ha.sh stable --pitr-confirmed${RESET} — jamais ${BOLD}up -d --build${RESET} (§ 6.1)."
echo ""
warn ".env contient des secrets (clé des Server Functions et clé de chaînage du journal d'audit comprises) — ne le partagez pas ; sauvegardez-le dans un coffre."
echo ""
