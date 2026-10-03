#!/usr/bin/env bash
# ─── Planification des sauvegardes ACRA (grand-père / père / fils) ───
# Appelé CHAQUE MINUTE par l'agent hôte (scripts/update-agent.sh, cron). Décide si une sauvegarde planifiée est due selon
# `.acra-update/backup-policy.json` (défaut : une par jour, par semaine, par mois, 3 copies de chacune, à 02 h, heure
# locale du serveur), crée UN point (`acra-snapshot.sh create --reason scheduled --tier …`), applique la rétention
# (`acra-snapshot.sh prune`), puis publie `.acra-update/backup-stats.json` (espace libre, espace occupé, taille d'un
# point, dernier passage) que l'interface affiche et utilise pour avertir sur l'espace disque.
#
# Usage : scripts/acra-schedule.sh tick | stats | status
# Un point planifié n'a pas de clone (économie d'espace) ; vérification complète si le point sert une sauvegarde
# hebdomadaire ou mensuelle, rapide sinon. Un seul point sert plusieurs fréquences le même jour. Rien ne tourne pendant
# une mise à jour (verrou d'exécution) ; après un échec, nouvelle tentative au plus tôt ACRA_SCHEDULE_RETRY_MINUTES (30).
# Variable de test : ACRA_SCHEDULE_NOW="AAAA-MM-JJ HH" (date et heure locales simulées).
set -Eeuo pipefail
umask 077
cd "${ACRA_ROOT:-$(dirname "$0")/..}"

UPDATE_DIR=".acra-update"
POLICY="$UPDATE_DIR/backup-policy.json"
STATS="$UPDATE_DIR/backup-stats.json"
BACKUP_DIR="${ACRA_BACKUP_DIR:-./backups}"
RETRY_MIN="${ACRA_SCHEDULE_RETRY_MINUTES:-30}"
SNAP="$(dirname "$0")/acra-snapshot.sh"

iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }
epoch_of() { date -u -d "$1" +%s 2>/dev/null || date -j -u -f %Y-%m-%dT%H:%M:%SZ "$1" +%s 2>/dev/null || echo 0; }
day_epoch() { epoch_of "$1T00:00:00Z"; }
dow_of() { date -u -d "$1" +%w 2>/dev/null || date -j -u -f %Y-%m-%d "$1" +%w; }
mget() { sed -n "s/^[[:space:]]*\"$2\":[[:space:]]*\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\}[[:space:]]*\$/\1/p" "$1" | head -1; }
mget_list() { sed -n "s/^[[:space:]]*\"$2\":[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$1" | head -1; }
file_size() { if stat -c %s "$1" >/dev/null 2>&1; then stat -c %s "$1"; else stat -f %z "$1"; fi; }

# ── Politique (valeurs par défaut si le fichier est absent ou incomplet) ──────────────────────────
pol() { # tier champ défaut
  local v; v="$(sed -n "s/^[[:space:]]*\"$1\":[[:space:]]*{.*\"$2\":[[:space:]]*\([^,} ]*\).*/\1/p" "$POLICY" 2>/dev/null | head -1)"; printf '%s' "${v:-$3}"
}
pol_hour() { local v; v="$(sed -n 's/^[[:space:]]*"hour":[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$POLICY" 2>/dev/null | head -1)"; printf '%s' "${v:-2}"; }

# ── Heure locale (ou simulée) ─────────────────────────────────────────────────────────────────────
if [ -n "${ACRA_SCHEDULE_NOW:-}" ]; then TODAY="${ACRA_SCHEDULE_NOW%% *}"; HOUR=$(( 10#${ACRA_SCHEDULE_NOW##* } ))
else TODAY="$(date +%Y-%m-%d)"; HOUR=$(( 10#$(date +%H) )); fi
DOW="$(dow_of "$TODAY")"; DOM=$(( 10#${TODAY:8:2} ))

# Date planifiée (scheduledFor) du point planifié le plus récent portant la fréquence, ou vide.
newest() { # tier
  local id tl
  for id in $(ls -1 "$BACKUP_DIR" 2>/dev/null | sort -r); do
    case "$id" in *-scheduled-*) ;; *) continue ;; esac
    [ -f "$BACKUP_DIR/$id/manifest.json" ] || continue
    tl="$(mget_list "$BACKUP_DIR/$id/manifest.json" tiers)"
    case ",$tl," in *",$1,"*) mget "$BACKUP_DIR/$id/manifest.json" scheduledFor; return 0 ;; esac
  done
}

due_tiers() {
  local out="" h n; h="$(pol_hour)"
  [ "$HOUR" -ge "$h" ] || return 0
  if [ "$(pol daily enabled true)" = "true" ]; then n="$(newest daily)"; { [ -z "$n" ] || [ "$n" \< "$TODAY" ]; } && out="daily"; fi
  if [ "$(pol weekly enabled true)" = "true" ]; then
    n="$(newest weekly)"
    if [ -z "$n" ]; then [ "$DOW" = "$(pol weekly weekday 0)" ] && out="${out:+$out,}weekly"
    elif [ $(( ( $(day_epoch "$TODAY") - $(day_epoch "$n") ) / 86400 )) -ge 7 ]; then out="${out:+$out,}weekly"; fi
  fi
  if [ "$(pol monthly enabled true)" = "true" ] && [ "$DOM" -ge "$(pol monthly day 1)" ]; then
    n="$(newest monthly)"
    { [ -z "$n" ] || [ "${n:0:7}" \< "${TODAY:0:7}" ]; } && out="${out:+$out,}monthly"
  fi
  printf '%s' "$out"
}

# ── Statistiques publiées pour l'interface ────────────────────────────────────────────────────────
dir_bytes() { du -sk "$1" 2>/dev/null | cut -f1 | awk '{print $1*1024}'; }
LAST_AT=""; LAST_CODE="null"; LAST_TIERS=""
publish_stats() {
  mkdir -p "$UPDATE_DIR"
  local free used n id sched="null" pre="null" dbb="null" nsch=0
  free="$(df -Pk "$BACKUP_DIR" 2>/dev/null | awk 'NR==2{print $4*1024}')"; free="${free:-null}"
  used=0; n=0
  if [ -d "$BACKUP_DIR" ]; then used="$(dir_bytes "$BACKUP_DIR")"; used="${used:-0}"; fi
  for id in $(ls -1 "$BACKUP_DIR" 2>/dev/null | sort -r); do
    [ -f "$BACKUP_DIR/$id/manifest.json" ] || continue
    n=$(( n + 1 ))
    case "$id" in
      *-scheduled-*) nsch=$(( nsch + 1 )); [ "$sched" != "null" ] || sched="$(dir_bytes "$BACKUP_DIR/$id")" ;;
      *-pre-update-*) [ "$pre" != "null" ] || pre="$(dir_bytes "$BACKUP_DIR/$id")" ;;
    esac
    [ "$dbb" != "null" ] || { dbb="$(mget "$BACKUP_DIR/$id/manifest.json" sizeBytes)"; dbb="${dbb:-null}"; }
  done
  [ -n "$LAST_AT" ] || { LAST_AT="$(mget "$STATS" lastRunAt 2>/dev/null || true)"; LAST_CODE="$(mget "$STATS" lastCode 2>/dev/null || true)"; LAST_CODE="${LAST_CODE:-null}"; LAST_TIERS="$(mget_list "$STATS" lastTiers 2>/dev/null || true)"; }
  local la="null"; [ -z "$LAST_AT" ] || [ "$LAST_AT" = "null" ] || la="\"$LAST_AT\""
  printf '{\n  "schema": 1,\n  "at": "%s",\n  "freeBytes": %s,\n  "backupsBytes": %s,\n  "points": %s,\n  "scheduledPoints": %s,\n  "lastScheduledPointBytes": %s,\n  "lastPreUpdatePointBytes": %s,\n  "dbBytes": %s,\n  "lastRunAt": %s,\n  "lastCode": %s,\n  "lastTiers": "%s"\n}\n' \
    "$(iso)" "$free" "$used" "$n" "$nsch" "$sched" "$pre" "$dbb" "$la" "$LAST_CODE" "$LAST_TIERS" > "$STATS.tmp"
  chmod 644 "$STATS.tmp"; mv "$STATS.tmp" "$STATS"
}

# Hors échéance, les statistiques (df/du) ne sont rafraîchies que toutes les ACRA_STATS_TTL_MIN minutes (10) : le passage a lieu chaque minute.
stats_if_stale() {
  local at; at="$(mget "$STATS" at 2>/dev/null || true)"
  if [ -n "$at" ] && [ $(( ( $(date -u +%s) - $(epoch_of "$at") ) / 60 )) -lt "${ACRA_STATS_TTL_MIN:-10}" ]; then return 0; fi
  publish_stats
}

cmd_tick() {
  # Jamais pendant une mise à jour, ni deux passages en parallèle (une sauvegarde peut durer plus d'une minute).
  [ ! -f "$UPDATE_DIR/run/current.json" ] || exit 0
  local pid; pid="$(cat "$UPDATE_DIR/run/lock/pid" 2>/dev/null || true)"; { [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; } || exit 0
  mkdir -p "$UPDATE_DIR"
  LOCKDIR="$UPDATE_DIR/.schedule-lock"
  if ! mkdir "$LOCKDIR" 2>/dev/null; then
    local lp; lp="$(cat "$LOCKDIR/pid" 2>/dev/null || true)"
    if [ -n "$lp" ] && kill -0 "$lp" 2>/dev/null; then exit 0; fi
    rm -rf "$LOCKDIR"; mkdir "$LOCKDIR" 2>/dev/null || exit 0
  fi
  echo "$$" > "$LOCKDIR/pid"; trap 'rm -rf "$LOCKDIR"' EXIT

  local tiers; tiers="$(due_tiers)"
  if [ -z "$tiers" ]; then stats_if_stale; exit 0; fi
  # Après un échec : pas de nouvelle tentative avant ACRA_SCHEDULE_RETRY_MINUTES.
  local lc la; lc="$(mget "$STATS" lastCode 2>/dev/null || true)"; la="$(mget "$STATS" lastRunAt 2>/dev/null || true)"
  if [ -n "$lc" ] && [ "$lc" != "0" ] && [ "$lc" != "null" ] && [ -n "$la" ] && [ "$la" != "null" ]; then
    [ $(( ( $(date -u +%s) - $(epoch_of "$la") ) / 60 )) -ge "$RETRY_MIN" ] || { stats_if_stale; exit 0; }
  fi
  local verify=quick; case ",$tiers," in *,weekly,*|*,monthly,*) verify=full ;; esac
  local ver; ver="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' package.json 2>/dev/null | head -1)"
  local rc=0
  ACRA_BACKUP_DIR="$BACKUP_DIR" ACRA_RUN_OWNER=1 ACRA_ROOT="$PWD" bash "$SNAP" create --reason scheduled --tier "$tiers" --scheduled-for "$TODAY" --from-version "${ver:-unknown}" --no-clone --verify "$verify" >/dev/null 2>&1 || rc=$?
  LAST_AT="$(iso)"; LAST_CODE="$rc"; LAST_TIERS="$tiers"
  if [ "$rc" -eq 0 ]; then ACRA_BACKUP_DIR="$BACKUP_DIR" ACRA_RUN_OWNER=1 ACRA_ROOT="$PWD" bash "$SNAP" prune >/dev/null 2>&1 || true
  else echo "✗ Sauvegarde planifiée en échec (code $rc) : nouvelle tentative dans ${RETRY_MIN} min." >&2; fi
  publish_stats
  [ "$rc" -eq 0 ] || exit "$rc"
}

cmd_status() {
  local t; t="$(due_tiers)"
  if [ -n "$t" ]; then echo "DUE : $t"; else echo "À JOUR"; fi
}

case "${1:-}" in
  tick) cmd_tick ;;
  stats) publish_stats ;;
  status) cmd_status ;;
  *) echo "Usage : acra-schedule.sh tick | stats | status" >&2; exit 2 ;;
esac
