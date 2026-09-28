#!/usr/bin/env bash
# ─── Mise à jour d'une instance ACRA auto-hébergée (git + Docker Compose) ─────
# Issue #185. Deux canaux :
#   stable : dernière version validée (branche `stable`, alignée sur la dernière
#            release stable publiée) ;
#   beta   : dernière version validée + évolutions suivantes (branche `main`,
#            version de préversion, ex. 1.0.4-beta.1).
#
# Usage : scripts/update.sh [stable|beta] [--yes] [--no-docker] [--status-file FICHIER]
#   --yes          pas de confirmation interactive (utilisé par l'agent)
#   --no-docker    met seulement le code à jour (installation sans Docker :
#                  lancer ensuite `npm ci && npm run build` puis redémarrer)
#   --status-file  écrit l'avancement en JSON (lu par l'interface d'administration)
# Variables : ACRA_COMPOSE_FILES (ex. "-f docker-compose.yml -f docker-compose.production.yml"),
#             ACRA_REMOTE (défaut : origin).
#
# Garanties : refus si modifications locales ; avance rapide uniquement (jamais de
# réécriture d'historique) ; sauvegarde de la base AVANT migration ; contrôle de
# santé dans le conteneur ; en cas d'échec, commandes de retour arrière affichées.
set -euo pipefail

CHANNEL="${1:-stable}"
[ $# -gt 0 ] && shift
YES=0; DOCKER=1; STATUS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) YES=1 ;;
    --no-docker) DOCKER=0 ;;
    --status-file) STATUS="${2:-}"; shift ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done
case "$CHANNEL" in
  stable) BRANCH=stable ;;
  beta) BRANCH=main ;;
  *) echo "Canal inconnu : $CHANNEL (attendu : stable | beta)" >&2; exit 2 ;;
esac

cd "$(dirname "$0")/.."
REMOTE="${ACRA_REMOTE:-origin}"
# Exécuté en root (agent installé via sudo) dans un clone appartenant à un autre
# utilisateur, git refuse le dépôt (« dubious ownership ») : on l'autorise pour
# CE dossier uniquement, sans toucher à la configuration globale.
git() { command git -c safe.directory="$PWD" "$@"; }
# shellcheck disable=SC2206
COMPOSE=(docker compose ${ACRA_COMPOSE_FILES:-})

pkg_version() { sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' | head -1; }
status() {
  [ -n "$STATUS" ] || return 0
  local msg="${2//[\"\\]/}"
  printf '{"state":"%s","channel":"%s","version":"%s","message":"%s","at":"%s"}\n' \
    "$1" "$CHANNEL" "${3:-}" "$msg" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATUS.tmp" && mv "$STATUS.tmp" "$STATUS"
}
fail() { echo "✗ $1" >&2; status FAILED "$1" "${TO:-}"; exit 1; }

status RUNNING "Préparation"
git diff --quiet && git diff --cached --quiet || fail "Modifications locales non commitées : mise à jour annulée (voir git status)."
git fetch "$REMOTE" --tags --prune --quiet || fail "Impossible de joindre le dépôt $REMOTE."
git rev-parse --verify --quiet "refs/remotes/$REMOTE/$BRANCH" >/dev/null || fail "Branche $REMOTE/$BRANCH introuvable."

FROM="$(pkg_version < package.json)"
FROM_SHA="$(git rev-parse HEAD)"
TARGET_SHA="$(git rev-parse "refs/remotes/$REMOTE/$BRANCH")"
TO="$(git show "$TARGET_SHA:package.json" | pkg_version)"
echo "ACRA : $FROM → $TO (canal $CHANNEL, $REMOTE/$BRANCH)"

if [ "$FROM_SHA" = "$TARGET_SHA" ]; then
  echo "Déjà à jour."; status SUCCESS "Déjà à jour" "$TO"; exit 0
fi
if [ "$YES" -ne 1 ]; then
  read -r -p "Continuer ? [o/N] " answer
  case "$answer" in o|O|y|Y) ;; *) echo "Annulé."; status FAILED "Annulé par l'opérateur" "$TO"; exit 1 ;; esac
fi

BACKUP=""
if [ "$DOCKER" -eq 1 ] && "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx db; then
  status RUNNING "Sauvegarde de la base" "$TO"
  mkdir -p backups
  BACKUP="backups/pre-update-$(date -u +%Y%m%dT%H%M%SZ)-${FROM}.sql.gz"
  # shellcheck disable=SC2016
  "${COMPOSE[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUP" || fail "Sauvegarde de la base échouée."
  [ -s "$BACKUP" ] || fail "Sauvegarde de la base vide."
  echo "Sauvegarde : $BACKUP"
fi

status RUNNING "Mise à jour du code" "$TO"
if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git checkout -q "$BRANCH" || fail "Passage sur la branche $BRANCH impossible."
  else
    git checkout -q -b "$BRANCH" --track "$REMOTE/$BRANCH" || fail "Création de la branche $BRANCH impossible."
  fi
fi
git merge --ff-only -q "$REMOTE/$BRANCH" || fail "Historique local divergent de $REMOTE/$BRANCH : avance rapide impossible, rien n'a été modifié côté base."

if [ "$DOCKER" -eq 0 ]; then
  echo "✓ Code à jour ($TO). Étapes suivantes : npm ci && npx prisma migrate deploy && npm run build, puis redémarrer."
  status SUCCESS "Code mis à jour (installation sans Docker : reconstruire et redémarrer)" "$TO"; exit 0
fi

status RUNNING "Reconstruction et redémarrage" "$TO"
# Dossier d'échange du bouton « Mettre à jour » : créé par l'utilisateur courant
# avant que Docker ne le crée en root lors du montage.
mkdir -p .acra-update
"${COMPOSE[@]}" up -d --build || fail "docker compose up a échoué (voir docker compose logs app). Retour arrière : git checkout $FROM_SHA && docker compose up -d --build."

status RUNNING "Contrôle de santé" "$TO"
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T app wget -q -O /dev/null http://127.0.0.1:3000/api/health 2>/dev/null; then
    echo "✓ ACRA $TO opérationnel."; status SUCCESS "Mise à jour terminée" "$TO"; exit 0
  fi
  sleep 5
done
fail "ACRA ne répond pas 5 min après la mise à jour. Retour arrière : git checkout $FROM_SHA && docker compose up -d --build${BACKUP:+ ; si des migrations ont été appliquées, restaurer $BACKUP}."
