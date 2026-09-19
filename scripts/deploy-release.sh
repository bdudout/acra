#!/usr/bin/env bash
# Serveur Linux : déploiement d'une image stable déjà qualifiée, sans git pull ni build.
set -Eeuo pipefail
umask 077
mode="${1:-}"
state_dir=".release-state"
mkdir -p "$state_dir"
exec 9>"$state_dir/deploy.lock"
flock -n 9 || { echo 'Un déploiement est déjà en cours.' >&2; exit 1; }
compose=(docker compose --env-file .env -f docker-compose.yml -f docker-compose.demo.yml -f docker-compose.release.yml)
load_state() {
  local file="$1"
  # Fichiers générés par ce script exclusivement, sans valeur saisie librement.
  read -r ACRA_IMAGE < "$file"
  VERSION="$(sed -n '2p' "$file")"
  REVISION="$(sed -n '3p' "$file")"
  MIGRATIONS_HASH="$(sed -n '4p' "$file")"
  export ACRA_IMAGE
}
validate() {
  [[ "$ACRA_IMAGE" =~ ^ghcr\.io/bdudout/acra@sha256:[a-f0-9]{64}$ ]]
  [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
  [[ "$REVISION" =~ ^[a-f0-9]{40}$ && "$MIGRATIONS_HASH" =~ ^[a-f0-9]{64}$ ]]
}
check_health() {
  "${compose[@]}" exec -T -e EXPECT_VERSION="$VERSION" -e EXPECT_REVISION="$REVISION" app node -e '
    fetch("http://127.0.0.1:3000/api/health").then(async r => {
      const h = await r.json(); if (!r.ok || h.status !== "ok" || h.db !== "connected" || h.version !== process.env.EXPECT_VERSION || h.revision !== process.env.EXPECT_REVISION) process.exit(1)
    }).catch(() => process.exit(1))'
}
rollback() {
  [[ -f "$state_dir/previous" && -f "$state_dir/pending" ]] || { "${compose[@]}" stop app; echo 'Aucune version précédente qualifiée ; application arrêtée, intervention requise.' >&2; return 1; }
  [[ "$(sed -n '4p' "$state_dir/previous")" == "$(sed -n '4p' "$state_dir/pending")" ]] || {
    echo 'Migrations différentes : restauration manuelle qualifiée requise, application arrêtée.' >&2
    "${compose[@]}" stop app
    return 1
  }
  load_state "$state_dir/previous"
  validate
  "${compose[@]}" up -d --no-build --no-deps --wait app
  check_health
  "${compose[@]}" up -d --no-build --no-deps caddy scheduler cron
  cp "$state_dir/previous" "$state_dir/current"
  rm -f "$state_dir/pending"
  echo 'Version précédente restaurée ; déploiement considéré en échec.'
}
case "$mode" in
  rollback)
    load_state "$state_dir/pending"
    rollback
    exit 0
    ;;
  finalize)
    load_state "$state_dir/pending"
    validate
    check_health
    "${compose[@]}" up -d --no-build --no-deps scheduler cron
    mv "$state_dir/pending" "$state_dir/current"
    echo 'Release confirmée après recette publique.'
    exit 0
    ;;
  stage)
    ACRA_IMAGE="${2:-}" VERSION="${3:-}" REVISION="${4:-}" MIGRATIONS_HASH="${5:-}"
    export ACRA_IMAGE
    validate || { echo 'Paramètres de release invalides.' >&2; exit 1; }
    [[ ! -f "$state_dir/pending" ]] || { echo 'Une livraison attend une recette ou une restauration.' >&2; exit 1; }
    ;;
  *) echo 'Usage : deploy-release.sh stage IMAGE VERSION SHA MIGRATIONS_HASH | finalize | rollback' >&2; exit 1 ;;
esac
"${compose[@]}" config --quiet
if [[ ! -f "$state_dir/current" && -n "$("${compose[@]}" ps -q app)" ]]; then
  echo 'Installation existante sans manifeste : sauvegarder base et fichiers, puis qualifier la migration initiale manuellement.' >&2
  exit 1
fi
"${compose[@]}" pull app migrator
# Ne pas arrêter une instance si l'image n'est pas disponible.
[[ ! -f "$state_dir/current" ]] || cp "$state_dir/current" "$state_dir/previous"
printf '%s\n' "$ACRA_IMAGE" "$VERSION" "$REVISION" "$MIGRATIONS_HASH" > "$state_dir/pending"
trap 'echo "Échec du déploiement." >&2; rollback || true; exit 1' ERR
"${compose[@]}" up -d --wait db
"${compose[@]}" stop app scheduler cron
backup_dir="$state_dir/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
# Les variables sont développées dans le conteneur PostgreSQL, jamais sur l’hôte.
# shellcheck disable=SC2016
"${compose[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$backup_dir/database.sql.gz"
gzip -t "$backup_dir/database.sql.gz"
"${compose[@]}" run --rm --no-deps --entrypoint tar app -C /app/.data -czf - documents > "$backup_dir/documents.tar.gz"
gzip -t "$backup_dir/documents.tar.gz"
# Migration explicite : aucun marquage automatique d'une migration en échec.
"${compose[@]}" run --rm --no-deps migrator
"${compose[@]}" up -d --no-build --no-deps --wait app
check_health
"${compose[@]}" up -d --no-build --no-deps caddy
trap - ERR
echo 'Image saine ; recette publique obligatoire avant finalize.'
