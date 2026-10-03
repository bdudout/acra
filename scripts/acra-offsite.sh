#!/usr/bin/env bash
# ─── Sauvegarde externe des points de restauration ACRA — docs/specs/sauvegarde-externe-proposition.md ───
# Copie un point (`backups/<id>/`, créé par scripts/acra-snapshot.sh) vers une cible externe, VÉRIFIE la copie et publie
# l'état dans `.acra-update/offsite.json` (lu par Administration → Version → « Sauvegarde externe », en lecture seule).
#
# Usage :
#   scripts/acra-offsite.sh push  <id>      envoie un point (appelé automatiquement par `acra-snapshot.sh create`)
#   scripts/acra-offsite.sh fetch <id>      rapatrie un point depuis la cible (restauration, test trimestriel)
#   scripts/acra-offsite.sh test            écrit, relit et supprime un fichier sonde sur la cible
#   scripts/acra-offsite.sh status          dernier envoi, âge, état (OK / EN RETARD / EN ÉCHEC / NON CONFIGURÉ)
#
# Pilotes (ACRA_OFFSITE_DRIVER) :
#   fs       dossier local ou monté (disque USB, NFS, SMB) : ACRA_OFFSITE_TARGET=/mnt/sauvegardes/acra ;
#            copie atomique (dossier provisoire puis renommage), empreintes relues côté cible, rétention ACRA_OFFSITE_KEEP (30).
#   command  commande libre ACRA_OFFSITE_CMD (logiciel de sauvegarde d'entreprise, script maison) : reçoit ACRA_SNAPSHOT_ID
#            et ACRA_SNAPSHOT_DIR ; elle porte la responsabilité de la vérification (code de sortie ≠ 0 ⇒ échec).
#   s3       stockage objet compatible S3 (AWS, OVH, Scaleway, MinIO…), via rclone : voir l'en-tête du pilote.
#
# Garde-fous : un point NON chiffré (`ACRA_BACKUP_AGE_RECIPIENT`) n'est jamais envoyé hors du serveur (pilotes command et
# s3) sans ACRA_OFFSITE_ALLOW_PLAINTEXT=1 ; un envoi non vérifié est un échec ; un échec n'interrompt jamais une mise à
# jour mais est publié. Variables : ACRA_BACKUP_DIR, ACRA_OFFSITE_MAX_AGE_HOURS (48).
# Codes : 0 succès · 2 usage · 10 configuration/prérequis · 31 identifiant invalide · 50 envoi en échec · 51 vérification
#         en échec · 52 envoi d'un point non chiffré refusé · 53 rapatriement en échec.
set -Eeuo pipefail
umask 077
cd "${ACRA_ROOT:-$(dirname "$0")/..}"

ID_RE='^[0-9]{8}T[0-9]{6}Z-(pre-update|manual)-[0-9A-Za-z.+-]{1,40}$'
BACKUP_DIR="${ACRA_BACKUP_DIR:-./backups}"
STATE=".acra-update/offsite.json"
DRIVER="${ACRA_OFFSITE_DRIVER:-}"
TARGET="${ACRA_OFFSITE_TARGET:-}"
KEEP="${ACRA_OFFSITE_KEEP:-30}"
MAX_AGE_H="${ACRA_OFFSITE_MAX_AGE_HOURS:-48}"
FILES="database.dump database.dump.age documents.tar.gz documents.tar.gz.age"

die() { local code="$1"; shift; echo "✗ $*" >&2; exit "$code"; }
note() { echo "$*" >&2; }
iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }
is_id() { printf '%s' "$1" | grep -Eq "$ID_RE"; }
sha256_file() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
epoch_of() { date -u -d "$1" +%s 2>/dev/null || date -j -u -f %Y-%m-%dT%H:%M:%SZ "$1" +%s 2>/dev/null || echo 0; }
mget() { sed -n "s/^[[:space:]]*\"$2\":[[:space:]]*\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\}[[:space:]]*\$/\1/p" "$1" | head -1; }

# ── État publié ───────────────────────────────────────────────────────────────────────────────────
publish() { # code id ok(1|0)
  local code="$1" id="$2" ok="$3" prev_ok prev_id prev_fail
  prev_ok="$(mget "$STATE" lastSuccessAt 2>/dev/null || true)"; prev_id="$(mget "$STATE" lastSnapshotId 2>/dev/null || true)"; prev_fail="$(mget "$STATE" lastFailureAt 2>/dev/null || true)"
  local succ="null" fail="null" sid="null" now; now="$(iso)"
  [ -z "$prev_ok" ] || [ "$prev_ok" = "null" ] || succ="\"$prev_ok\""
  [ -z "$prev_id" ] || [ "$prev_id" = "null" ] || sid="\"$prev_id\""
  [ -z "$prev_fail" ] || [ "$prev_fail" = "null" ] || fail="\"$prev_fail\""
  if [ "$ok" = "1" ]; then succ="\"$now\""; sid="\"$id\""; else fail="\"$now\""; fi
  mkdir -p .acra-update
  printf '{\n  "schema": 1,\n  "driver": "%s",\n  "lastSnapshotId": %s,\n  "lastSuccessAt": %s,\n  "lastFailureAt": %s,\n  "lastCode": %s,\n  "updatedAt": "%s"\n}\n' \
    "${DRIVER:-none}" "$sid" "$succ" "$fail" "$code" "$now" > "$STATE.tmp"
  chmod 644 "$STATE.tmp"; mv "$STATE.tmp" "$STATE"
}
fail_push() { local code="$1" id="$2"; shift 2; publish "$code" "$id" 0; die "$code" "$@"; }

# ── Empreintes d'un dossier de point (SHA256SUMS + manifeste identique) ───────────────────────────
verify_dir() { # dossier_copie dossier_source
  local d="$1" src="$2" h f
  [ -f "$d/SHA256SUMS" ] && [ -f "$d/manifest.json" ] || return 1
  cmp -s "$d/manifest.json" "$src/manifest.json" || return 1
  while read -r h f; do
    [ -n "$f" ] || continue
    [ -f "$d/$f" ] && [ "$(sha256_file "$d/$f")" = "$h" ] || return 1
  done < "$d/SHA256SUMS"
}

need_target() { [ -n "$TARGET" ] || die 10 "ACRA_OFFSITE_TARGET non défini pour le pilote $DRIVER."; }
check_driver() {
  case "$DRIVER" in
    fs) need_target ;;
    command) [ -n "${ACRA_OFFSITE_CMD:-}" ] || die 10 "ACRA_OFFSITE_CMD non défini (pilote command)." ;;
    s3) s3_prepare ;;
    "") die 10 "ACRA_OFFSITE_DRIVER non défini (fs | command | s3)." ;;
    *) die 10 "Pilote inconnu : $DRIVER (fs | command | s3)." ;;
  esac
}

# ── Pilote fs ─────────────────────────────────────────────────────────────────────────────────────
fs_push() { # id dir
  local id="$1" dir="$2" tmp
  mkdir -p "$TARGET" 2>/dev/null || return 10
  [ -w "$TARGET" ] || return 10
  tmp="$TARGET/.tmp-$id-$$"
  rm -rf "$tmp"
  cp -R "$dir" "$tmp" || { rm -rf "$tmp"; return 50; }
  if ! verify_dir "$tmp" "$dir"; then rm -rf "$tmp"; return 51; fi
  rm -rf "${TARGET:?}/$id"
  mv "$tmp" "$TARGET/$id" || { rm -rf "$tmp"; return 50; }
  # Rétention : on ne garde que les KEEP derniers points reconnus.
  local n=0 x
  for x in $(ls -1 "$TARGET" 2>/dev/null | sort -r); do
    is_id "$x" || continue
    n=$(( n + 1 ))
    [ "$n" -le "$KEEP" ] || rm -rf "${TARGET:?}/$x"
  done
  return 0
}
fs_fetch() { # id → dossier provisoire local
  local id="$1" tmp="$2"
  [ -d "$TARGET/$id" ] || return 53
  cp -R "$TARGET/$id" "$tmp" || return 53
}
fs_test() {
  mkdir -p "$TARGET" 2>/dev/null || return 10
  local probe="$TARGET/.probe-$$"
  printf 'acra-offsite-%s' "$$" > "$probe" 2>/dev/null || return 10
  [ "$(cat "$probe")" = "acra-offsite-$$" ] || { rm -f "$probe"; return 10; }
  rm -f "$probe"
}

# ── Pilote command ────────────────────────────────────────────────────────────────────────────────
command_push() { # id dir
  export ACRA_SNAPSHOT_ID="$1" ACRA_SNAPSHOT_DIR="$(cd "$2" && pwd)"
  bash -c "$ACRA_OFFSITE_CMD" >/dev/null 2>&1 || return 50
}

# ── Pilote s3 (lot S2) : défini plus bas ──────────────────────────────────────────────────────────
s3_prepare() { die 10 "Pilote s3 non disponible dans cette version."; }

# ── Commandes ─────────────────────────────────────────────────────────────────────────────────────
cmd_push() {
  local id="${1:-}"; is_id "$id" || die 31 "Identifiant de point invalide."
  local dir="$BACKUP_DIR/$id"
  [ -f "$dir/manifest.json" ] || die 31 "Point de restauration inconnu : $id"
  check_driver
  if [ "$DRIVER" != "fs" ] && [ "$(mget "$dir/manifest.json" encrypted)" != "true" ] && [ "${ACRA_OFFSITE_ALLOW_PLAINTEXT:-0}" != "1" ]; then
    fail_push 52 "$id" "Point non chiffré : envoi hors du serveur refusé (définir ACRA_BACKUP_AGE_RECIPIENT, ou ACRA_OFFSITE_ALLOW_PLAINTEXT=1 en connaissance de cause)."
  fi
  local rc=0
  case "$DRIVER" in
    fs) fs_push "$id" "$dir" || rc=$? ;;
    command) command_push "$id" "$dir" || rc=$? ;;
    s3) s3_push "$id" "$dir" || rc=$? ;;
  esac
  case "$rc" in
    0) publish 0 "$id" 1; note "Point $id envoyé et vérifié (pilote $DRIVER)." ;;
    10) fail_push 10 "$id" "Cible inaccessible ou non inscriptible (pilote $DRIVER)." ;;
    51) fail_push 51 "$id" "Vérification de la copie en échec : empreintes différentes, copie supprimée." ;;
    *) fail_push 50 "$id" "Envoi en échec (pilote $DRIVER)." ;;
  esac
}

cmd_fetch() {
  local id="${1:-}"; is_id "$id" || die 31 "Identifiant de point invalide."
  check_driver
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  [ ! -e "$BACKUP_DIR/$id" ] || die 53 "Le point $id existe déjà en local : rien n'est écrasé."
  local tmp="$BACKUP_DIR/.tmp-fetch-$id-$$"
  rm -rf "$tmp"
  local rc=0
  case "$DRIVER" in
    fs) fs_fetch "$id" "$tmp" || rc=$? ;;
    s3) s3_fetch "$id" "$tmp" || rc=$? ;;
    *) rm -rf "$tmp"; die 10 "Le pilote $DRIVER ne sait pas rapatrier un point : utiliser l'outil de sauvegarde." ;;
  esac
  [ "$rc" -eq 0 ] || { rm -rf "$tmp"; die 53 "Point $id introuvable sur la cible ou rapatriement en échec."; }
  # Empreintes des fichiers : sans référence locale, on contrôle la cohérence interne du point.
  local h f
  while read -r h f; do
    [ -n "$f" ] || continue
    [ -f "$tmp/$f" ] && [ "$(sha256_file "$tmp/$f")" = "$h" ] || { rm -rf "$tmp"; die 53 "Point rapatrié corrompu (empreinte de $f)."; }
  done < "$tmp/SHA256SUMS"
  chmod 700 "$tmp"; find "$tmp" -type f -exec chmod 600 {} +
  mv "$tmp" "$BACKUP_DIR/$id"
  echo "Point $id rapatrié : vérifier avec scripts/acra-snapshot.sh verify $id --full"
}

cmd_test() {
  check_driver
  case "$DRIVER" in
    fs) fs_test || die 10 "Cible inaccessible ou non inscriptible." ;;
    s3) s3_test || die 10 "Cible S3 inaccessible ou non inscriptible." ;;
    *) die 10 "Le pilote $DRIVER n'a pas de test intégré." ;;
  esac
  echo "Cible OK (pilote $DRIVER)."
}

cmd_status() {
  if [ -z "$DRIVER" ] && [ ! -f "$STATE" ]; then echo "NON CONFIGURÉ"; return 0; fi
  [ -f "$STATE" ] || { echo "OK (aucun envoi pour l'instant, pilote ${DRIVER})"; return 0; }
  local ok fail code age now
  ok="$(mget "$STATE" lastSuccessAt)"; fail="$(mget "$STATE" lastFailureAt)"; code="$(mget "$STATE" lastCode)"; now="$(date -u +%s)"
  if [ -z "$ok" ] || [ "$ok" = "null" ]; then echo "EN ÉCHEC (aucun envoi réussi, dernier code ${code:-?})"; return 0; fi
  age=$(( (now - $(epoch_of "$ok")) / 3600 ))
  if [ -n "$fail" ] && [ "$fail" != "null" ] && [ "$(epoch_of "$fail")" -gt "$(epoch_of "$ok")" ]; then echo "EN ÉCHEC (dernier envoi réussi il y a ${age} h, code ${code:-?})"; return 0; fi
  if [ "$age" -gt "$MAX_AGE_H" ]; then echo "EN RETARD (dernier envoi il y a ${age} h, seuil ${MAX_AGE_H} h)"; else echo "OK (dernier envoi il y a ${age} h)"; fi
}

CMD="${1:-}"; [ $# -gt 0 ] && shift
case "$CMD" in
  push) cmd_push "$@" ;;
  fetch) cmd_fetch "$@" ;;
  test) cmd_test ;;
  status) cmd_status ;;
  *) die 2 "Usage : acra-offsite.sh push <id> | fetch <id> | test | status (voir l'en-tête du script)" ;;
esac
