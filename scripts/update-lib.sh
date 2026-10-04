#!/usr/bin/env bash
# ─── Fonctions communes de la mise à jour ACRA — docs/specs/sauvegarde-rollback-spec.md, lot 2 ───
# Sourcé par scripts/update.sh (lanceur) et scripts/update-steps.sh (étapes exécutées depuis la version CIBLE).
# Journal d'exécution : .acra-update/run/current.json ; statut publié (rétrocompatible) : fichier --status-file.
# Aucune dépendance autre que bash 3.2+, git, docker compose, sed, grep.
# Variables attendues : CHANNEL, STATUS (fichier de statut ou vide), ACRA_COMPOSE_FILES.

RUN_DIR=".acra-update/run"
CURRENT="$RUN_DIR/current.json"
LAST="$RUN_DIR/last.json"
EVENTS=".acra-update/events.log"
# shellcheck disable=SC2206
COMPOSE=(docker compose ${ACRA_COMPOSE_FILES:-})
git() { command git -c safe.directory="$PWD" "$@"; }
update_command() {
  if [ "${ACRA_UPDATE_VERBOSE:-0}" = "1" ]; then "$@"
  else "$@" >/dev/null 2>&1
  fi
}

iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }
jesc() { printf '%s' "$1" | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g'; }
pkg_version() { sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' | head -1; }

# ── Journal ───────────────────────────────────────────────────────────────────────────────────────
RUN_ID=""; KIND="update"; FROM=""; FROM_SHA=""; TO=""; TO_SHA=""; SNAPSHOT_ID=""; STATE=""; STARTED=""
STEP_ITEMS=()
ROLLED_BACK=false; LAST_CODE=""
PRECHECK_DESTRUCTIVE="${ACRA_PRECHECK_DESTRUCTIVE:-}"   # noms de migrations destructives en attente (PRECHECK, lot 5), séparés par des espaces

journal_write() {
  mkdir -p "$RUN_DIR"
  local i n=${#STEP_ITEMS[@]} start=0 sid="null"
  [ "$n" -le 50 ] || start=$(( n - 50 ))
  [ -z "$SNAPSHOT_ID" ] || sid="\"$SNAPSHOT_ID\""
  {
    printf '{\n  "schema": 1,\n  "runId": "%s",\n  "kind": "%s",\n  "channel": "%s",\n' "$RUN_ID" "$KIND" "${CHANNEL:-}"
    printf '  "from": { "version": "%s", "sha": "%s" },\n  "to": { "version": "%s", "sha": "%s" },\n' "$FROM" "$FROM_SHA" "$TO" "$TO_SHA"
    printf '  "snapshotId": %s,\n  "state": "%s",\n  "startedAt": "%s",\n  "updatedAt": "%s",\n  "steps": [\n' "$sid" "$STATE" "$STARTED" "$(iso)"
    for (( i = start; i < n; i++ )); do
      if [ "$i" -lt $(( n - 1 )) ]; then printf '    %s,\n' "${STEP_ITEMS[$i]}"; else printf '    %s\n' "${STEP_ITEMS[$i]}"; fi
    done
    printf '  ]\n}\n'
  } > "$CURRENT.tmp"
  chmod 644 "$CURRENT.tmp"; mv "$CURRENT.tmp" "$CURRENT"
}
jget() { sed -n "s/^[[:space:]]*\"$2\":[[:space:]]*\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\}[[:space:]]*\$/\1/p" "$1" | head -1; }
jver() { sed -n "s/^[[:space:]]*\"$2\":[[:space:]]*{[[:space:]]*\"version\":[[:space:]]*\"\([^\"]*\)\",[[:space:]]*\"sha\":[[:space:]]*\"\([^\"]*\)\".*/\1 \2/p" "$1" | head -1; }
load_journal() { # fichier
  local f="$1" line
  RUN_ID="$(jget "$f" runId)"; KIND="$(jget "$f" kind)"; CHANNEL="$(jget "$f" channel)"
  local fv tv; fv="$(jver "$f" from)"; tv="$(jver "$f" to)"
  FROM="${fv% *}"; FROM_SHA="${fv#* }"; TO="${tv% *}"; TO_SHA="${tv#* }"
  SNAPSHOT_ID="$(jget "$f" snapshotId)"; [ "$SNAPSHOT_ID" != "null" ] || SNAPSHOT_ID=""
  STATE="$(jget "$f" state)"; STARTED="$(jget "$f" startedAt)"
  STEP_ITEMS=()
  while IFS= read -r line; do STEP_ITEMS[${#STEP_ITEMS[@]}]="$line"; done < <(sed -n 's/^[[:space:]]*\({ "state".*}\),\{0,1\}[[:space:]]*$/\1/p' "$f")
}
journal_init() { # kind from from_sha to to_sha
  RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"; KIND="$1"; FROM="$2"; FROM_SHA="$3"; TO="$4"; TO_SHA="$5"; SNAPSHOT_ID=""; STATE="PRECHECK"; STARTED="$(iso)"; STEP_ITEMS=()
  journal_write
}
step_enter() { STATE="$1"; journal_write; status RUNNING "${2:-$1}"; }
step_ok() { STEP_ITEMS[${#STEP_ITEMS[@]}]="{ \"state\": \"$1\", \"ok\": true, \"at\": \"$(iso)\", \"code\": null }"; journal_write; }
step_ko() { STEP_ITEMS[${#STEP_ITEMS[@]}]="{ \"state\": \"$1\", \"ok\": false, \"at\": \"$(iso)\", \"code\": \"$2\" }"; LAST_CODE="$2"; journal_write; }

# ── Statut publié (champs historiques conservés ; champs ajoutés seulement) ───────────────────────
status() { # state message [code]
  [ -n "${STATUS:-}" ] || return 0
  local state="$1" msg="${2//[\"\\]/}" code="${3:-}" codej="null" steps="" i n=${#STEP_ITEMS[@]} sid="null" first=1 start=0
  [ -z "$code" ] || codej="\"$code\""
  [ -z "$SNAPSHOT_ID" ] || sid="\"$SNAPSHOT_ID\""
  [ "$n" -le 20 ] || start=$(( n - 20 ))
  for (( i = start; i < n; i++ )); do
    local st at ok; st="$(printf '%s' "${STEP_ITEMS[$i]}" | sed -n 's/.*"state": "\([A-Z_]*\)".*/\1/p')"; at="$(printf '%s' "${STEP_ITEMS[$i]}" | sed -n 's/.*"at": "\([^"]*\)".*/\1/p')"
    case "${STEP_ITEMS[$i]}" in *'"ok": true'*) ok=true ;; *) ok=false ;; esac
    [ "$first" -eq 1 ] || steps="$steps,"; first=0
    steps="$steps{\"step\":\"$st\",\"ok\":$ok,\"at\":\"$at\"}"
  done
  local destr="" d; for d in $PRECHECK_DESTRUCTIVE; do destr="$destr${destr:+,}\"$d\""; done
  printf '{"state":"%s","channel":"%s","version":"%s","message":"%s","at":"%s","step":"%s","code":%s,"snapshotId":%s,"from":"%s","to":"%s","rolledBack":%s,"precheck":{"destructive":[%s]},"steps":[%s]}\n' \
    "$state" "${CHANNEL:-}" "${TO:-}" "$msg" "$(iso)" "${STATE:-}" "$codej" "$sid" "${FROM:-}" "${TO:-}" "$ROLLED_BACK" "$destr" "$steps" > "$STATUS.tmp" \
    && chmod 644 "$STATUS.tmp" && mv "$STATUS.tmp" "$STATUS"
}

event() { mkdir -p .acra-update; printf '%s\n' "$*" >> "$EVENTS"; chmod 644 "$EVENTS" 2>/dev/null || true; }

# ── Services ──────────────────────────────────────────────────────────────────────────────────────
existing_services() {
  local defined svc; defined="$("${COMPOSE[@]}" config --services 2>/dev/null || true)"
  for svc in "$@"; do printf '%s\n' "$defined" | grep -qx "$svc" && printf '%s\n' "$svc"; done
  return 0
}
STOPPED=0
# Mode sans Docker (ACRA_NO_DOCKER=1) : l'arrêt et le démarrage passent par ACRA_STOP_CMD / ACRA_START_CMD (ex. systemctl).
nodocker() { [ "${ACRA_NO_DOCKER:-0}" = "1" ]; }
stop_services() {
  if nodocker; then bash -c "${ACRA_STOP_CMD:?}" >/dev/null 2>&1 || return 1; STOPPED=1; return 0; fi
  local list; list="$(existing_services app scheduler backup cron | tr '\n' ' ')"
  # shellcheck disable=SC2086
  [ -z "$list" ] || "${COMPOSE[@]}" stop $list >/dev/null 2>&1 || return 1
  STOPPED=1
}
restart_old() { # redémarre sans reconstruire (les images de l'ancienne version sont encore là)
  if nodocker; then bash -c "${ACRA_START_CMD:?}" >/dev/null 2>&1 || true; STOPPED=0; return 0; fi
  local list; list="$(existing_services app scheduler backup cron | tr '\n' ' ')"
  # shellcheck disable=SC2086
  [ -z "$list" ] || "${COMPOSE[@]}" up -d --no-build $list >/dev/null 2>&1 || true
  STOPPED=0
}

# ── PRECHECK : migrations en attente et destructives (lot 5) — facultatif (nécessite node et tsx sur l'hôte) ──────────
precheck_migrations() { # sha cible
  command -v npx >/dev/null 2>&1 || return 0
  local tmp out; tmp="$(mktemp "${TMPDIR:-/tmp}/acra-applied.XXXXXX")"
  # shellcheck disable=SC2016
  "${COMPOSE[@]}" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "SELECT migration_name FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL"' > "$tmp" 2>/dev/null || { rm -f "$tmp"; return 0; }
  out="$(npx --no-install tsx scripts/check-migrations.ts --json --ref "$1" --applied-file "$tmp" 2>/dev/null)" || { rm -f "$tmp"; return 0; }
  rm -f "$tmp"
  PRECHECK_DESTRUCTIVE="$(printf '%s' "$out" | sed -n 's/.*"destructive":\[\([^]]*\)\].*/\1/p' | tr -d '",' )"
  export ACRA_PRECHECK_DESTRUCTIVE="$PRECHECK_DESTRUCTIVE"
  [ -z "$PRECHECK_DESTRUCTIVE" ] || echo "⚠ Migrations destructives en attente : $PRECHECK_DESTRUCTIVE (le point de restauration protège ; un retour arrière du code seul ne suffirait pas)." >&2
  return 0
}

# ── Santé et fumée ────────────────────────────────────────────────────────────────────────────────
wait_health() { # sha
  local sha="$1" out i
  for (( i = 0; i < ${ACRA_HEALTH_RETRIES:-60}; i++ )); do
    if nodocker; then out="$(curl -fsS "http://127.0.0.1:${ACRA_PORT:-3000}/api/health?deep=1" 2>/dev/null || true)"
    else out="$("${COMPOSE[@]}" exec -T app wget -q -O - 'http://127.0.0.1:3000/api/health?deep=1' 2>/dev/null || true)"; fi
    if printf '%s' "$out" | grep -q "\"revision\":\"$sha\"" && printf '%s' "$out" | grep -q '"status":"ok"'; then
      # Si l'application publie l'état des migrations (santé approfondie), rien ne doit être en attente ni en échec.
      if ! printf '%s' "$out" | grep -q '"migrations"' || { printf '%s' "$out" | grep -q '"pending":\[\]' && printf '%s' "$out" | grep -q '"failed":\[\]'; }; then return 0; fi
    fi
    sleep "${ACRA_HEALTH_INTERVAL:-5}"
  done
  # La réponse est l'endpoint public de santé (sans secret) ; l'exposer évite
  # qu'un échec de déploiement reste muet pendant toute la fenêtre de retry.
  echo "✗ Santé cible absente ou non conforme (révision attendue : $sha ; dernière réponse : ${out:0:500})" >&2
  return 1
}
smoke_ok() {
  local p out status_line
  for p in / /auth/signin /api/health; do
    if nodocker; then out="HTTP/1.1 $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${ACRA_PORT:-3000}$p" 2>/dev/null || echo 000)"
    else out="$("${COMPOSE[@]}" exec -T app wget -S -q -O /dev/null "http://127.0.0.1:3000$p" 2>&1 || true)"; fi
    status_line="$(printf '%s\n' "$out" | sed -n '/HTTP\/[0-9.]\+ [0-9][0-9][0-9]/p' | tail -1)"
    if ! printf '%s' "$status_line" | grep -Eq 'HTTP/[0-9.]+ (200|307)'; then
      [ "${ACRA_UPDATE_VERBOSE:-0}" != "1" ] || echo "✗ Fumée $p : ${out:0:500}" >&2
      return 1
    fi
  done
}

# ── Retour arrière ────────────────────────────────────────────────────────────────────────────────
# Code (git), base + documents (si la migration a pu commencer), redémarrage et santé sur l'ancienne révision.
# $1 = code d'erreur d'origine · $2 = 1 si la base doit être restaurée · $3 = 1 pour une demande manuelle (statut final SUCCESS)
manual_help() {
  cat >&2 <<EOF
Procédure manuelle (dans le dossier d'ACRA) :
  docker compose ${ACRA_COMPOSE_FILES:-} stop app scheduler
  git reset --hard ${FROM_SHA}
  scripts/acra-snapshot.sh restore ${SNAPSHOT_ID:-<identifiant>} --yes
  docker compose ${ACRA_COMPOSE_FILES:-} up -d --build
  (voir docs/runbook-exploitation.md § 6)
EOF
}
do_rollback() {
  local cause="$1" needdb="$2" manual="${3:-0}"
  STATE="ROLLBACK"; journal_write; status RUNNING "Retour arrière en cours" "$cause"
  stop_services || true
  if [ "$(git rev-parse HEAD)" != "$FROM_SHA" ]; then
    git reset --hard -q "$FROM_SHA" || { rollback_failed "$cause"; return 1; }
  fi
  if [ "$needdb" = "1" ] && [ -n "$SNAPSHOT_ID" ]; then
    local snap="${ACRA_SNAPSHOT_SCRIPT:-scripts/acra-snapshot.sh}"
    ACRA_RUN_OWNER=1 bash "$snap" restore "$SNAPSHOT_ID" --yes >/dev/null || { rollback_failed "$cause"; return 1; }
  fi
  export ACRA_VERSION="v$FROM" ACRA_REVISION="$FROM_SHA"
  if nodocker; then
    { npm ci >/dev/null 2>&1 && npm run build >/dev/null 2>&1 && bash -c "${ACRA_START_CMD:?}" >/dev/null 2>&1; } || { rollback_failed "$cause"; return 1; }
  else
    local list; list="$(existing_services app scheduler backup cron | tr '\n' ' ')"
    # shellcheck disable=SC2086
    "${COMPOSE[@]}" up -d --build --no-deps $list >/dev/null 2>&1 || { rollback_failed "$cause"; return 1; }
    # La stable peut stocker les documents dans un volume anonyme. Une
    # restauration via `compose run` utilise alors un autre volume éphémère :
    # recopier le secours hôte dans le conteneur app effectivement redémarré.
    if [ -d .acra-update/rescue/documents-rescue ]; then
      "${COMPOSE[@]}" cp .acra-update/rescue/documents-rescue/. app:/app/.data/documents/ >/dev/null 2>&1 || { rollback_failed "$cause"; return 1; }
      "${COMPOSE[@]}" exec -T -u 0 app chown -R 1001:1001 /app/.data/documents >/dev/null 2>&1 || { rollback_failed "$cause"; return 1; }
    fi
  fi
  wait_health "$FROM_SHA" || { rollback_failed "$cause"; return 1; }
  STATE="ROLLED_BACK"; ROLLED_BACK=true; step_ok ROLLED_BACK
  event "ROLLED_BACK $TO $FROM $cause $(iso)"
  if [ "$manual" = "1" ]; then
    status SUCCESS "Point de restauration $SNAPSHOT_ID restauré (version $FROM)." ""
  else
    status FAILED "Mise à jour vers $TO annulée à l'étape $cause ; version $FROM restaurée." "$cause"
  fi
  archive_run
  return 0
}
rollback_failed() {
  STATE="ROLLBACK_FAILED"; step_ko ROLLBACK_FAILED rollback_failed
  stop_services || true   # on ne relance pas une version incohérente avec sa base
  manual_help
  status FAILED "Retour arrière en échec : l'application est arrêtée. Procédure manuelle : docs/runbook-exploitation.md § 6." "rollback_failed"
}
archive_run() { [ ! -f "$CURRENT" ] || { cp "$CURRENT" "$LAST" && chmod 644 "$LAST"; rm -f "$CURRENT"; }; }

# ── Étapes exécutées depuis la version cible : MIGRATE → DONE ─────────────────────────────────────
run_steps() {
  local migrate_fail=0
  step_enter MIGRATE "Migration de la base"
  export ACRA_VERSION="v$TO" ACRA_REVISION="$TO_SHA" ACRA_MIGRATE_AUTO_RESOLVE=0
  if nodocker; then
    npx prisma migrate deploy >/dev/null 2>&1 || migrate_fail=1
  elif ! { update_command "${COMPOSE[@]}" build app migrator || update_command "${COMPOSE[@]}" build; } || ! update_command "${COMPOSE[@]}" run --rm --no-deps migrator; then migrate_fail=1; fi
  if [ "$migrate_fail" -eq 1 ]; then step_ko MIGRATE migrate_failed; do_rollback migrate_failed 1; return 1; fi
  step_ok MIGRATE

  step_enter START "Démarrage de la nouvelle version"
  if nodocker; then
    if ! { npm ci >/dev/null 2>&1 && npm run build >/dev/null 2>&1 && bash -c "${ACRA_START_CMD:?}" >/dev/null 2>&1; }; then step_ko START start_failed; do_rollback start_failed 1; return 1; fi
  else
    local list; list="$(existing_services app scheduler backup cron | tr '\n' ' ')"
    # shellcheck disable=SC2086
    if ! "${COMPOSE[@]}" up -d --build --no-deps $list >/dev/null 2>&1; then step_ko START start_failed; do_rollback start_failed 1; return 1; fi
  fi
  STOPPED=0
  step_ok START

  step_enter HEALTH "Contrôle de santé"
  if ! wait_health "$TO_SHA"; then step_ko HEALTH health_failed; do_rollback health_failed 1; return 1; fi
  step_ok HEALTH

  step_enter SMOKE "Contrôle de fumée"
  if ! smoke_ok; then step_ko SMOKE smoke_failed; do_rollback smoke_failed 1; return 1; fi
  step_ok SMOKE

  step_enter FINALIZE "Finalisation"
  STATE="DONE"; step_ok FINALIZE
  event "UPDATED $FROM $TO $(iso)"
  local snap="${ACRA_SNAPSHOT_SCRIPT:-scripts/acra-snapshot.sh}"
  ACRA_RUN_OWNER=1 bash "$snap" prune >/dev/null 2>&1 || echo "⚠ Purge des anciens points de restauration en échec (non bloquant)." >&2
  status SUCCESS "Mise à jour terminée"
  archive_run
  return 0
}
