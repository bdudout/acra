#!/usr/bin/env bash
# ─── Mise à jour d'une instance ACRA auto-hébergée (git + Docker Compose) ─────
# Issue #185 ; docs/specs/sauvegarde-rollback-spec.md (lots 0 à 3). Deux canaux :
#   stable : dernière version validée (branche `stable`, alignée sur la dernière release stable publiée) ;
#   beta   : dernière version validée + évolutions suivantes (branche `main`, version de préversion).
#
# Usage : scripts/update.sh [stable|beta] [--yes] [--no-docker] [--status-file FICHIER]
#         scripts/update.sh rollback <identifiant-de-point> --yes [--status-file FICHIER]
#         scripts/update.sh resume [--status-file FICHIER]     (reprise après interruption)
#   --yes          pas de confirmation interactive (utilisé par l'agent)
#   --no-docker    met seulement le code à jour (installation sans Docker : reconstruire et redémarrer ensuite)
#   --status-file  écrit l'avancement en JSON (lu par l'interface d'administration)
# Variables : ACRA_COMPOSE_FILES (ex. "-f docker-compose.yml -f docker-compose.production.yml"), ACRA_REMOTE (origin).
#
# Machine à états : PRECHECK → QUIESCE → SNAPSHOT → FETCH → HANDOFF (ce lanceur) puis MIGRATE → START → HEALTH →
# SMOKE → FINALIZE (scripts/update-steps.sh de la version CIBLE). Tout échec à partir de HANDOFF déclenche un retour
# arrière automatique (code + base + documents). Journal : .acra-update/run/current.json.
# Garanties : refus si modifications locales ; avance rapide uniquement ; application ARRÊTÉE puis point de
# restauration VÉRIFIÉ avant toute modification du code ; documents sauvés hors d'un conteneur sans volume.
# Variables de test : ACRA_HEALTH_RETRIES (60), ACRA_HEALTH_INTERVAL (5).
set -euo pipefail
umask 077

# Le lanceur se copie et se ré-exécute depuis la copie : jamais de lecture d'un script que `git merge` remplace.
if [ "${ACRA_UPDATE_REEXEC:-0}" != "1" ]; then
  ACRA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"; export ACRA_ROOT
  TMPDIR_RUN="$(mktemp -d "${TMPDIR:-/tmp}/acra-update.XXXXXX")"; export TMPDIR_RUN
  cp "$0" "$TMPDIR_RUN/update.sh"
  [ ! -f "$ACRA_ROOT/scripts/acra-snapshot.sh" ] || cp "$ACRA_ROOT/scripts/acra-snapshot.sh" "$TMPDIR_RUN/acra-snapshot.sh"
  ACRA_UPDATE_REEXEC=1 exec bash "$TMPDIR_RUN/update.sh" "$@"
fi
cd "$ACRA_ROOT"
# Le script de points de restauration INSTALLÉ (pas celui de la cible) fait le travail.
if [ -f "$TMPDIR_RUN/acra-snapshot.sh" ]; then ACRA_SNAPSHOT_SCRIPT="$TMPDIR_RUN/acra-snapshot.sh"; else ACRA_SNAPSHOT_SCRIPT=""; fi
export ACRA_SNAPSHOT_SCRIPT ACRA_RUN_OWNER=1
cleanup_tmp() { [ -z "${TMPDIR_RUN:-}" ] || rm -rf "$TMPDIR_RUN"; }
trap cleanup_tmp EXIT

MODE=update; CHANNEL="stable"; ROLLBACK_ID=""; YES=0; DOCKER=1; STATUS=""
case "${1:-}" in
  rollback) MODE=rollback; ROLLBACK_ID="${2:-}"; shift; [ $# -gt 0 ] && shift ;;
  resume) MODE=resume; shift ;;
  stable|beta) CHANNEL="$1"; shift ;;
  ""|--*) ;;
  *) echo "Canal inconnu : $1 (attendu : stable | beta)" >&2; exit 2 ;;
esac
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) YES=1 ;;
    --no-docker) DOCKER=0 ;;
    --status-file) STATUS="${2:-}"; shift ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done
case "$CHANNEL" in stable) BRANCH=stable ;; beta) BRANCH=main ;; *) echo "Canal inconnu : $CHANNEL" >&2; exit 2 ;; esac
REMOTE="${ACRA_REMOTE:-origin}"

if [ -f scripts/update-lib.sh ]; then
  # shellcheck disable=SC1091
  . scripts/update-lib.sh
else
  echo "scripts/update-lib.sh introuvable." >&2; exit 2
fi
export ACRA_STATUS_FILE="$STATUS"

# ── Verrou d'exécution (mkdir atomique + pid ; un verrou orphelin est repris) ───────────────────────
mkdir -p .acra-update/run; chmod 755 .acra-update 2>/dev/null || true
RUN_LOCK=".acra-update/run/lock"
take_run_lock() {
  if mkdir "$RUN_LOCK" 2>/dev/null; then echo "$$" > "$RUN_LOCK/pid"; return 0; fi
  local pid; pid="$(cat "$RUN_LOCK/pid" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then return 1; fi
  rm -rf "$RUN_LOCK"; mkdir "$RUN_LOCK" 2>/dev/null && echo "$$" > "$RUN_LOCK/pid"
}
release_run_lock() { rm -rf "$RUN_LOCK"; }
trap 'cleanup_tmp; release_run_lock' EXIT
take_run_lock || { echo "Une mise à jour est déjà en cours." >&2; exit 40; }

fail() { # code message : échec AVANT que du code ou de la base soit touché
  local code="$1"; shift
  echo "✗ $*" >&2
  if [ "$STOPPED" -eq 1 ]; then restart_old; fi
  STATE="${STATE:-PRECHECK}"; [ -z "$RUN_ID" ] || { step_ko "$STATE" "$code"; archive_run; }
  status FAILED "$*" "$code"; exit 1
}

# ── Reprise après interruption (2.2) ──────────────────────────────────────────────────────────────
resume_run() {
  [ -f "$CURRENT" ] || return 0
  load_journal "$CURRENT"
  case "$STATE" in
    PRECHECK|QUIESCE) [ "$DOCKER" -eq 0 ] || restart_old; step_ko "$STATE" interrupted_before_snapshot; archive_run; status FAILED "Mise à jour interrompue avant le point de restauration ; application redémarrée." interrupted_before_snapshot ;;
    SNAPSHOT) [ "$DOCKER" -eq 0 ] || restart_old
              for d in backups/*/; do [ -d "$d" ] && [ ! -f "${d}manifest.json" ] && case "$d" in *pre-update*) rm -rf "$d" ;; esac; done
              step_ko SNAPSHOT interrupted_before_snapshot; archive_run; status FAILED "Mise à jour interrompue pendant le point de restauration." interrupted_before_snapshot ;;
    FETCH|HANDOFF|MIGRATE|START|HEALTH|SMOKE|ROLLBACK)
      echo "Reprise : mise à jour interrompue à l'étape $STATE — retour arrière."
      local needdb=0; case "$STATE" in MIGRATE|START|HEALTH|SMOKE|ROLLBACK) needdb=1 ;; esac
      # ROLLBACK interrompu : rejoué (restore est idempotent : base courante déjà conforme ⇒ le renommage est refait proprement).
      do_rollback interrupted "$needdb" || exit 1; exit 0 ;;
    FINALIZE|DONE) event "UPDATED $FROM $TO $(iso)"; archive_run; status SUCCESS "Mise à jour terminée (reprise)" ;;
    *) archive_run ;;
  esac
}
if [ "$MODE" = resume ]; then resume_run; exit 0; fi
resume_run || true

# ── Retour arrière manuel ─────────────────────────────────────────────────────────────────────────
if [ "$MODE" = rollback ]; then
  printf '%s' "$ROLLBACK_ID" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-(pre-update|manual)-[0-9A-Za-z.+-]{1,40}$' || { status FAILED "Identifiant de point invalide" invalid_request; exit 1; }
  MAN="backups/$ROLLBACK_ID/manifest.json"
  [ -f "$MAN" ] || { status FAILED "Point de restauration inconnu" invalid_request; exit 1; }
  [ "$YES" -eq 1 ] || { read -r -p "Restaurer le point $ROLLBACK_ID (les saisies postérieures seront perdues) ? [o/N] " a; case "$a" in o|O|y|Y) ;; *) echo "Annulé."; exit 1 ;; esac; }
  PT_VERSION="$(jget "$MAN" version)"; PT_REV="$(jget "$MAN" revision)"
  FROM_NOW="$(pkg_version < package.json)"
  # Le code restauré est celui du point : seulement s'il est un ancêtre de la branche suivie.
  if ! git merge-base --is-ancestor "$PT_REV" HEAD 2>/dev/null; then
    status FAILED "Le code de ce point n'est pas un ancêtre de la version courante (retour arrière refusé)." rollback_not_ancestor; echo "✗ rollback_not_ancestor" >&2; exit 1
  fi
  # Pour do_rollback : « FROM » = version visée (celle du point), « TO » = version actuelle annulée.
  journal_init rollback "$PT_VERSION" "$PT_REV" "$FROM_NOW" "$(git rev-parse HEAD)"
  SNAPSHOT_ID="$ROLLBACK_ID"; CHANNEL="rollback"; journal_write
  step_enter QUIESCE "Arrêt de l'application"; stop_services || true; step_ok QUIESCE
  do_rollback rollback 1 1 || exit 1
  exit 0
fi

# ── Mise à jour ───────────────────────────────────────────────────────────────────────────────────
status RUNNING "Préparation"
git diff --quiet && git diff --cached --quiet || { status FAILED "Modifications locales non commitées : mise à jour annulée (voir git status)." precheck_dirty; echo "✗ modifications locales" >&2; exit 1; }
git fetch "$REMOTE" --tags --prune --quiet || { status FAILED "Impossible de joindre le dépôt $REMOTE." precheck_fetch; exit 1; }
git rev-parse --verify --quiet "refs/remotes/$REMOTE/$BRANCH" >/dev/null || { status FAILED "Branche $REMOTE/$BRANCH introuvable." precheck_branch; exit 1; }

FROM="$(pkg_version < package.json)"
FROM_SHA="$(git rev-parse HEAD)"
TARGET_SHA="$(git rev-parse "refs/remotes/$REMOTE/$BRANCH")"
TO="$(git show "$TARGET_SHA:package.json" | pkg_version)"; TO_SHA="$TARGET_SHA"
echo "ACRA : $FROM → $TO (canal $CHANNEL, $REMOTE/$BRANCH)"

if [ "$FROM_SHA" = "$TARGET_SHA" ]; then
  echo "Déjà à jour."; status SUCCESS "Déjà à jour"; exit 0
fi
git merge-base --is-ancestor "$FROM_SHA" "$TARGET_SHA" || { status FAILED "Historique local divergent de $REMOTE/$BRANCH : avance rapide impossible, rien n'a été modifié." precheck_not_ff; echo "✗ avance rapide impossible" >&2; exit 1; }
if [ "$YES" -ne 1 ]; then
  read -r -p "Continuer ? [o/N] " answer
  case "$answer" in o|O|y|Y) ;; *) echo "Annulé."; status FAILED "Annulé par l'opérateur" precheck_failed; exit 1 ;; esac
fi

journal_init update "$FROM" "$FROM_SHA" "$TO" "$TO_SHA"
status RUNNING "Préparation"
if [ "$DOCKER" -eq 1 ]; then precheck_migrations "$TO_SHA"; fi
status RUNNING "Préparation"
step_ok PRECHECK

# ── Mode sans Docker (lot 6) : arrêt/démarrage par commandes de l'exploitant, base externe, migrate via npx ──────────
checkout_and_merge() {
  if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
    if git show-ref --verify --quiet "refs/heads/$BRANCH"; then git checkout -q "$BRANCH" || return 1
    else git checkout -q -b "$BRANCH" --track "$REMOTE/$BRANCH" || return 1; fi
  fi
  git merge --ff-only -q "$REMOTE/$BRANCH"
}
if [ "$DOCKER" -eq 0 ]; then
  # Sans commande d'arrêt, on refuse : on ne migre jamais une base en service.
  if [ -z "${ACRA_STOP_CMD:-}" ] || [ -z "${ACRA_START_CMD:-}" ]; then
    echo "✗ Mode sans Docker : définir ACRA_STOP_CMD et ACRA_START_CMD (ex. systemctl stop acra / systemctl start acra)." >&2
    STATE=PRECHECK; step_ko PRECHECK precheck_no_stop_cmd; archive_run
    status FAILED "Mode sans Docker : ACRA_STOP_CMD et ACRA_START_CMD sont requis (la base ne sera pas migrée en service)." precheck_no_stop_cmd; exit 1
  fi
  export ACRA_NO_DOCKER=1 ACRA_DB_MODE="${ACRA_DB_MODE:-url}"
  step_ok PRECHECK
  step_enter QUIESCE "Arrêt de l'application"
  stop_services || fail quiesce_failed "Arrêt de l'application impossible (ACRA_STOP_CMD)."
  step_ok QUIESCE
  step_enter SNAPSHOT "Point de restauration"
  SNAP_OUT=""; SNAP_RC=0
  SNAP_OUT="$(bash "$ACRA_SNAPSHOT_SCRIPT" create --reason pre-update --from-version "$FROM" --to-version "$TO" 2>&1)" || SNAP_RC=$?
  if [ "$SNAP_RC" -ne 0 ]; then
    echo "$SNAP_OUT" >&2
    [ "$SNAP_RC" -ne 11 ] || fail snapshot_space "Espace disque insuffisant pour le point de restauration : rien n'a été modifié."
    fail snapshot_failed "Point de restauration impossible (code $SNAP_RC) : rien n'a été modifié, application redémarrée."
  fi
  SNAPSHOT_ID="$(printf '%s\n' "$SNAP_OUT" | tail -1)"; step_ok SNAPSHOT
  step_enter FETCH "Mise à jour du code"
  if ! checkout_and_merge; then git reset --hard -q "$FROM_SHA" || true; fail fetch_failed "Mise à jour du code impossible : code d'origine rétabli."; fi
  step_ok FETCH
  step_enter HANDOFF "Passage de main à la version cible"; step_ok HANDOFF
  export ACRA_ROOT
  if [ -f scripts/update-steps.sh ] && grep -q '^ACRA_UPDATE_STEPS_API=1' scripts/update-steps.sh; then
    cp scripts/update-steps.sh "$TMPDIR_RUN/update-steps.sh"; bash "$TMPDIR_RUN/update-steps.sh" "$CURRENT" && RC=0 || RC=$?
  else run_steps && RC=0 || RC=$?; fi
  [ "$RC" -eq 0 ] && echo "✓ ACRA $TO opérationnel." || echo "✗ Mise à jour échouée : voir le statut (retour arrière tenté)." >&2
  exit "$RC"
fi

# ── Instance Docker : est-elle démarrée ? ──────────────────────────────────────────────────────────
RESCUED=0; SNAP_DIR=".acra-update/rescue"
rescue_documents() {
  local cid; cid="$("${COMPOSE[@]}" ps -q app 2>/dev/null || true)"
  [ -n "$cid" ] || return 0
  # shellcheck disable=SC2016
  if docker inspect -f '{{range .Mounts}}{{.Destination}}{{"\n"}}{{end}}' "$cid" 2>/dev/null | grep -qx /app/.data/documents; then return 0; fi
  mkdir -p "$SNAP_DIR"; rm -rf "$SNAP_DIR/documents-rescue"
  docker cp "$cid:/app/.data/documents" "$SNAP_DIR/documents-rescue" >/dev/null 2>&1 || return 0
  echo "Documents sauvés hors du conteneur : $SNAP_DIR/documents-rescue"
  RESCUED=1
}
INSTANCE_UP=0
"${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx db && INSTANCE_UP=1

if [ "$INSTANCE_UP" -eq 1 ]; then
  rescue_documents
  step_enter QUIESCE "Arrêt de l'application"
  stop_services || fail quiesce_failed "Arrêt de l'application impossible."
  step_ok QUIESCE

  step_enter SNAPSHOT "Point de restauration"
  SNAP_OUT=""; SNAP_RC=0
  SNAP_OUT="$(bash "$ACRA_SNAPSHOT_SCRIPT" create --reason pre-update --from-version "$FROM" --to-version "$TO" 2>&1)" || SNAP_RC=$?
  if [ "$SNAP_RC" -ne 0 ]; then
    echo "$SNAP_OUT" >&2
    if [ "$SNAP_RC" -eq 11 ]; then fail snapshot_space "Espace disque insuffisant pour le point de restauration : rien n'a été modifié."; fi
    fail snapshot_failed "Point de restauration impossible (code $SNAP_RC) : rien n'a été modifié, ancienne version redémarrée."
  fi
  SNAPSHOT_ID="$(printf '%s\n' "$SNAP_OUT" | tail -1)"
  printf '%s' "$SNAPSHOT_ID" | grep -Eq '^[0-9]{8}T[0-9]{6}Z-pre-update-[0-9A-Za-z.+-]{1,40}$' || fail snapshot_failed "Identifiant de point de restauration illisible."
  step_ok SNAPSHOT
  echo "Point de restauration : $SNAPSHOT_ID"
fi

step_enter FETCH "Mise à jour du code"
if ! checkout_and_merge; then
  git reset --hard -q "$FROM_SHA" || true
  fail fetch_failed "Mise à jour du code impossible : code d'origine rétabli, ancienne version redémarrée."
fi
step_ok FETCH

# ── Passage de main (ADR-004) : les étapes suivantes s'exécutent depuis la version CIBLE ────────────
step_enter HANDOFF "Passage de main à la version cible"
mkdir -p .acra-update; chmod 755 .acra-update
if [ "$INSTANCE_UP" -eq 1 ] && [ -f scripts/update-steps.sh ] && ! grep -q '^ACRA_UPDATE_STEPS_API=1' scripts/update-steps.sh; then
  step_ko HANDOFF handoff_failed
  do_rollback handoff_failed 0 || exit 1; exit 1
fi
if [ "$INSTANCE_UP" -eq 1 ]; then
  step_ok HANDOFF
  if [ -f scripts/update-steps.sh ]; then
    STEPS_COPY="$TMPDIR_RUN/update-steps.sh"; cp scripts/update-steps.sh "$STEPS_COPY"
    export ACRA_ROOT
    # Documents sauvés : remis en place dès que le nouveau conteneur existe (cf. run_steps → après START).
    bash "$STEPS_COPY" "$CURRENT" && RC=0 || RC=$?
  else
    # Cible sans update-steps.sh : ce lanceur exécute lui-même les étapes.
    run_steps && RC=0 || RC=$?
  fi
  if [ "$RESCUED" -eq 1 ] && [ "$RC" -eq 0 ]; then
    "${COMPOSE[@]}" cp "$SNAP_DIR/documents-rescue/." app:/app/.data/documents/ >/dev/null 2>&1 || echo "⚠ Copie des documents sauvés impossible : fichiers conservés dans $SNAP_DIR/documents-rescue" >&2
    "${COMPOSE[@]}" exec -T -u 0 app chown -R 1001:1001 /app/.data/documents >/dev/null 2>&1 || true
  fi
  [ "$RC" -eq 0 ] && echo "✓ ACRA $TO opérationnel." || echo "✗ Mise à jour échouée : voir le statut (retour arrière tenté)." >&2
  exit "$RC"
fi
# Instance non démarrée : mise à jour du code seulement ; la reconstruction se fera au démarrage.
step_ok HANDOFF; STATE=DONE; step_ok FINALIZE
echo "✓ Code à jour ($TO) ; l'instance n'était pas démarrée : docker compose up -d --build."
status SUCCESS "Code mis à jour (instance arrêtée)"; archive_run
