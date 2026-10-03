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
# réécriture d'historique) ; application ARRÊTÉE puis sauvegarde VÉRIFIÉE de la base
# (format custom) et des documents AVANT toute modification du code ; documents
# sauvés hors d'un conteneur sans volume ; contrôle de santé sur la RÉVISION cible ;
# en cas d'échec, commandes de retour arrière exactes affichées.
# Variables de test : ACRA_HEALTH_RETRIES (60), ACRA_HEALTH_INTERVAL (5).
set -euo pipefail
umask 077

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
    "$1" "$CHANNEL" "${3:-}" "$msg" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATUS.tmp" && chmod 644 "$STATUS.tmp" && mv "$STATUS.tmp" "$STATUS"
}
STOPPED=0; RESCUED=0; SNAP_DIR=".acra-update/rescue"; BACKUP=""; DOCS_BACKUP=""
# Services optionnels réellement définis dans cette installation (les absents sont ignorés).
existing_services() {
  local defined svc; defined="$("${COMPOSE[@]}" config --services 2>/dev/null || true)"
  for svc in "$@"; do printf '%s\n' "$defined" | grep -qx "$svc" && printf '%s\n' "$svc"; done
  return 0
}
restart_old() {
  [ "$STOPPED" -eq 1 ] || return 0
  local list; list="$(existing_services app scheduler backup | tr '\n' ' ')"
  # shellcheck disable=SC2086
  [ -z "$list" ] || "${COMPOSE[@]}" up -d --no-build $list >/dev/null 2>&1 || true
  STOPPED=0
}
print_restore_help() {
  cat >&2 <<EOF
Retour arrière manuel (dans le dossier d'ACRA) :
  docker compose ${ACRA_COMPOSE_FILES:-} stop app scheduler
  docker compose ${ACRA_COMPOSE_FILES:-} exec -T db sh -c 'dropdb -U "\$POSTGRES_USER" --if-exists "\$POSTGRES_DB" && createdb -U "\$POSTGRES_USER" "\$POSTGRES_DB"'
  docker compose ${ACRA_COMPOSE_FILES:-} exec -T db sh -c 'pg_restore -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" --no-owner --exit-on-error' < ${BACKUP:-<sauvegarde.dump>}
  git checkout ${FROM_SHA:-<commit-précédent>} && docker compose ${ACRA_COMPOSE_FILES:-} up -d --build
EOF
}
fail() { echo "✗ $1" >&2; restart_old; [ -z "$BACKUP" ] || print_restore_help; status FAILED "$1" "${TO:-}"; exit 1; }
# Instance antérieure sans volume de documents : copier les fichiers hors du conteneur AVANT de le recréer.
rescue_documents() {
  local cid; cid="$("${COMPOSE[@]}" ps -q app 2>/dev/null || true)"
  [ -n "$cid" ] || return 0
  # shellcheck disable=SC2016
  if docker inspect -f '{{range .Mounts}}{{.Destination}}{{"\n"}}{{end}}' "$cid" 2>/dev/null | grep -qx /app/.data/documents; then return 0; fi
  mkdir -p "$SNAP_DIR"
  rm -rf "$SNAP_DIR/documents-rescue"
  docker cp "$cid:/app/.data/documents" "$SNAP_DIR/documents-rescue" >/dev/null 2>&1 || return 0
  echo "Documents sauvés hors du conteneur : $SNAP_DIR/documents-rescue"
  RESCUED=1
}

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

if [ "$DOCKER" -eq 1 ] && "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx db; then
  rescue_documents
  status RUNNING "Arrêt de l'application" "$TO"
  # shellcheck disable=SC2046
  "${COMPOSE[@]}" stop $(existing_services app scheduler backup | tr '\n' ' ') >/dev/null 2>&1 || true
  STOPPED=1
  status RUNNING "Sauvegarde de la base" "$TO"
  mkdir -p backups; chmod 700 backups
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  BACKUP="backups/pre-update-${stamp}-${FROM}.dump"
  # shellcheck disable=SC2016
  "${COMPOSE[@]}" exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP" || { rm -f "$BACKUP"; fail "Sauvegarde de la base échouée (rien n'a été modifié)."; }
  [ -s "$BACKUP" ] || { rm -f "$BACKUP"; fail "Sauvegarde de la base vide (rien n'a été modifié)."; }
  LISTING="$("${COMPOSE[@]}" exec -T db pg_restore --list < "$BACKUP" 2>/dev/null)" || { fail "Sauvegarde illisible (pg_restore --list a échoué) : mise à jour annulée, rien n'a été modifié."; }
  printf '%s\n' "$LISTING" | grep -q 'TABLE DATA' || fail "Sauvegarde sans aucune donnée de table : mise à jour annulée, rien n'a été modifié."
  chmod 600 "$BACKUP"
  echo "Sauvegarde vérifiée : $BACKUP"
  DOCS_BACKUP="backups/pre-update-${stamp}-${FROM}-documents.tar.gz"
  if "${COMPOSE[@]}" run --rm --no-deps --entrypoint tar app -C /app/.data -czf - documents > "$DOCS_BACKUP" 2>/dev/null && gzip -t "$DOCS_BACKUP" 2>/dev/null; then
    chmod 600 "$DOCS_BACKUP"; echo "Documents sauvegardés : $DOCS_BACKUP"
  else
    rm -f "$DOCS_BACKUP"; DOCS_BACKUP=""; echo "Pas d'archive de documents (volume absent ou vide)."
  fi
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
mkdir -p .acra-update; chmod 755 .acra-update
# Version et révision servies : l'image est construite avec elles, /api/health les renvoie.
export ACRA_VERSION="v$TO" ACRA_REVISION="$TARGET_SHA"
# Pas de réconciliation automatique des migrations pendant une mise à jour.
export ACRA_MIGRATE_AUTO_RESOLVE=0
STOPPED=0
"${COMPOSE[@]}" up -d --build || fail "docker compose up a échoué (voir docker compose logs app). Retour arrière : git checkout $FROM_SHA && docker compose up -d --build."
if [ "$RESCUED" -eq 1 ]; then
  "${COMPOSE[@]}" cp "$SNAP_DIR/documents-rescue/." app:/app/.data/documents/ >/dev/null 2>&1 || echo "⚠ Copie des documents sauvés impossible : fichiers conservés dans $SNAP_DIR/documents-rescue" >&2
  "${COMPOSE[@]}" exec -T -u 0 app chown -R 1001:1001 /app/.data/documents >/dev/null 2>&1 || true
fi

status RUNNING "Contrôle de santé" "$TO"
for _ in $(seq 1 "${ACRA_HEALTH_RETRIES:-60}"); do
  # La RÉVISION servie doit être la cible : sinon c'est l'ancien conteneur qui répond.
  if "${COMPOSE[@]}" exec -T app wget -q -O - http://127.0.0.1:3000/api/health 2>/dev/null | grep -q "\"revision\":\"$TARGET_SHA\""; then
    echo "✓ ACRA $TO opérationnel."; status SUCCESS "Mise à jour terminée" "$TO"; exit 0
  fi
  sleep "${ACRA_HEALTH_INTERVAL:-5}"
done
echo "✗ ACRA ne répond pas (ou pas avec la révision attendue) 5 min après la mise à jour." >&2
BACKUP_NOTE="${BACKUP:+ ; si des migrations ont été appliquées, restaurer $BACKUP}"
print_restore_help || true
fail "ACRA ne répond pas avec la révision $TARGET_SHA. Retour arrière : git checkout $FROM_SHA && docker compose up -d --build${BACKUP_NOTE}."
