#!/usr/bin/env bash
# ─── Restauration en profil multi-instance « ha » — docs/deploiement-haute-disponibilite.md § 3.4 ───
# En profil « ha », la base est PARTAGÉE (managée ou Patroni) et les documents sont dans un bucket S3 versionné : ACRA ne
# restaure JAMAIS automatiquement (intégrité avant disponibilité). Ce script outille la procédure ; il n'arrête pas les écritures
# et ne bascule pas DATABASE_URL lui-même : ces deux décisions restent à l'exploitant (guide § 3.4, étapes 1 et 5).
#
# Usage :
#   scripts/acra-restore-ha.sh database  <id> --target-url <URL d'une base NEUVE> [--force] [--yes]
#       Restaure le dump logique d'un point (`backups/<id>/`, créé par acra-snapshot.sh) dans une base NEUVE et vide, en une
#       transaction, puis CONTRÔLE : comptes de lignes du manifeste, empreinte des clés de documents référencées.
#       Refus : base cible non vide (34) sauf --force ; base cible = base de production (35, jamais forçable) ; confirmation
#       par saisie du nom de la base cible sauf --yes.
#   scripts/acra-restore-ha.sh documents --at <AAAA-MM-JJTHH:MM:SSZ> (--to-bucket <bucket> [--to-prefix <préfixe>] | --to-dir <dossier>) [--keys-from <id>]
#       Copie l'état du bucket des documents tel qu'il était à l'instant donné (versioning S3, rclone `version_at`) vers un
#       AUTRE bucket/préfixe ou un dossier — jamais en place —, limité aux clés référencées par un point avec --keys-from.
#       Puis contrôle la copie (rclone check). Requiert rclone (≥ 1.59 pour version_at [à vérifier sur la version installée]).
#
# Variables : DATABASE_URL / BACKUP_DATABASE_URL / MIGRATION_DATABASE_URL (production, environnement ou .env : servent à refuser
#   une cible identique) ·
#   ACRA_BACKUP_DIR (./backups) · ACRA_BACKUP_AGE_IDENTITY (point chiffré) · ACRA_PG_CLIENT (auto|docker|host) ·
#   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PREFIX, S3_FORCE_PATH_STYLE (comme l'application) ·
#   ACRA_RCLONE (binaire rclone).
# Codes : 0 succès · 2 usage/annulé · 10 prérequis · 21 point corrompu · 30 restauration ou contrôle en échec · 31 point inconnu ·
#   34 base cible non vide · 35 base cible = base de production. Jamais de secret dans la sortie.
set -Eeuo pipefail
umask 077
cd "${ACRA_ROOT:-$(dirname "$0")/..}"

ID_RE='^[0-9]{8}T[0-9]{6}Z-(pre-update|manual|scheduled)-[0-9A-Za-z.+-]{1,40}$'
COUNTED_TABLES="User Organization Analyse Risque PlanAction AuditLog Document _prisma_migrations"
BACKUP_DIR="${ACRA_BACKUP_DIR:-./backups}"

die() { local code="$1"; shift; echo "✗ $*" >&2; exit "$code"; }
note() { echo "$*" >&2; }
is_id() { printf '%s' "$1" | grep -Eq "$ID_RE"; }
sha256_file() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
sha256_str() { if command -v sha256sum >/dev/null 2>&1; then printf '%s' "$1" | sha256sum | cut -d' ' -f1; else printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1; fi; }
mget() { sed -n "s/^[[:space:]]*\"$2\":[[:space:]]*\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\}[[:space:]]*\$/\1/p" "$1" | head -1; }
env_or_dotenv() { local v="${!1:-}"; if [ -z "$v" ] && [ -f .env ]; then v="$(sed -n "s/^$1=//p" .env 2>/dev/null | head -1 | tr -d '"'"'"'\r' || true)"; fi; printf '%s' "$v"; }
# Hôte:port/base d'une URL PostgreSQL (sans identifiants ni paramètres) : comparaison cible ↔ production, affichage sans secret.
url_ident() {
  local u="${1%%\?*}" hp db; u="${u#*://}"; u="${u##*@}"; hp="${u%%/*}"; db="${u#*/}"; [ "$db" != "$u" ] || db=""
  case "$hp" in *\]:*|[!\[]*:*) ;; *) hp="$hp:5432" ;; esac
  printf '%s/%s' "$(printf '%s' "$hp" | tr 'A-Z' 'a-z')" "$db"
}
url_db() { local u="${1%%\?*}"; printf '%s' "${u##*/}"; }
url_with_db() { local base="${1%%\?*}" q; q="${1#"$base"}"; printf '%s/%s%s' "${base%/*}" "$2" "$q"; }

# ── Outils clients PostgreSQL (conteneur postgres:<majeure> si Docker, sinon hôte avec un client ≥ serveur) ──────────────
PG_PREFIX=()
pgx() { if [ "${#PG_PREFIX[@]}" -gt 0 ]; then "${PG_PREFIX[@]}" "$@"; else "$@"; fi; }
init_client() { # url
  local client="${ACRA_PG_CLIENT:-auto}" major cmajor t
  if [ "$client" = "host" ] || { [ "$client" = "auto" ] && ! command -v docker >/dev/null 2>&1; }; then client=host; else client=docker; fi
  if [ "$client" = "host" ]; then major="$(psql -d "$1" -tA -c 'SHOW server_version_num' 2>/dev/null | tr -d '[:space:]')"
  else major="$(docker run --rm -i --network host postgres:alpine psql -d "$1" -tA -c 'SHOW server_version_num' 2>/dev/null | tr -d '[:space:]')"; fi
  [ -n "${major:-}" ] || die 10 "Base cible inaccessible ($(url_ident "$1")) : la créer d'abord (CREATE DATABASE) et vérifier l'URL."
  major=$(( major / 10000 ))
  if [ "$client" = "docker" ]; then PG_PREFIX=(docker run --rm -i --network host "postgres:${major}-alpine")
  else
    for t in pg_restore psql; do
      command -v "$t" >/dev/null 2>&1 || die 10 "$t introuvable sur l'hôte (ni Docker)."
      cmajor="$("$t" --version | sed -n 's/[^0-9]*\([0-9][0-9]*\)\..*/\1/p' | head -1)"
      [ "${cmajor:-0}" -ge "$major" ] || die 10 "$t (version ${cmajor:-?}) plus ancien que le serveur ($major)."
    done
  fi
}
q() { pgx psql -d "$1" -v ON_ERROR_STOP=1 -tA -c "$2"; }

# Clés de stockage référencées (même requête et même tri que acra-snapshot.sh doc_keys).
doc_keys() {
  q "$1" "SELECT k FROM (SELECT \"storageKey\" AS k FROM \"Document\" UNION SELECT r->>'storageKey' FROM \"CampagneControle\" c, jsonb_array_elements(CASE WHEN jsonb_typeof(c.\"rapports\") = 'array' THEN c.\"rapports\" ELSE '[]'::jsonb END) r UNION SELECT r->>'storageKey' FROM \"AuditMission\" m, jsonb_array_elements(CASE WHEN jsonb_typeof(m.\"rapports\") = 'array' THEN m.\"rapports\" ELSE '[]'::jsonb END) r) s WHERE k IS NOT NULL AND k <> '' ORDER BY k COLLATE \"C\""
}

check_point() { # id → dossier
  local id="$1" dir h f
  is_id "$id" || die 31 "Identifiant de point invalide."
  dir="$BACKUP_DIR/$id"
  [ -f "$dir/manifest.json" ] || die 31 "Point inconnu : $id (rapatrier depuis la sauvegarde externe : scripts/acra-offsite.sh fetch $id)."
  [ -f "$dir/SHA256SUMS" ] || die 21 "Empreintes absentes : point incomplet."
  while read -r h f; do
    [ -n "$f" ] || continue
    [ -f "$dir/$f" ] && [ "$(sha256_file "$dir/$f")" = "$h" ] || die 21 "Empreinte SHA-256 invalide ($f) : point corrompu."
  done < "$dir/SHA256SUMS"
  printf '%s' "$dir"
}

# ── database ──────────────────────────────────────────────────────────────────────────────────────
cmd_database() {
  local id="${1:-}" target="" force=0 yes=0
  [ $# -gt 0 ] && shift
  while [ $# -gt 0 ]; do
    case "$1" in --target-url) target="${2:-}"; shift ;; --force) force=1 ;; --yes) yes=1 ;; *) die 2 "Option inconnue : $1" ;; esac
    shift
  done
  local dir; dir="$(check_point "$id")"
  [ -n "$target" ] || die 2 "--target-url <URL d'une base neuve> requis."
  case "$target" in postgres://*|postgresql://*) ;; *) die 2 "--target-url doit être une URL postgresql://…" ;; esac
  local tdb; tdb="$(url_db "$target")"
  printf '%s' "$tdb" | grep -Eq '^[A-Za-z0-9_-]{1,63}$' || die 2 "Nom de base cible invalide."
  # Jamais sur la base de production (même hôte:port/base que DATABASE_URL, BACKUP_DATABASE_URL ou MIGRATION_DATABASE_URL),
  # même avec --force.
  local p; for p in DATABASE_URL BACKUP_DATABASE_URL MIGRATION_DATABASE_URL; do
    local u; u="$(env_or_dotenv "$p")"
    [ -z "$u" ] || [ "$(url_ident "$u")" != "$(url_ident "$target")" ] || die 35 "La base cible est la base de production ($p) : restaurer dans une base NEUVE, contrôler, puis basculer DATABASE_URL (guide HA § 3.4)."
  done
  init_client "$target"
  local n; n="$(q "$target" "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')" | tr -d '[:space:]')" || die 10 "Base cible illisible."
  if [ "${n:-0}" -gt 0 ] && [ "$force" -ne 1 ]; then die 34 "La base cible $(url_ident "$target") n'est pas vide ($n table(s)) : utiliser une base neuve, ou --force pour la remplacer."; fi
  if [ "$yes" -ne 1 ]; then
    echo "Restauration du point $id (ACRA $(mget "$dir/manifest.json" version), $(mget "$dir/manifest.json" createdAt)) dans $(url_ident "$target")."
    local ans=""; read -r -p "Saisir le nom de la base cible ($tdb) pour confirmer : " ans || ans=""
    [ "$ans" = "$tdb" ] || die 2 "Annulé."
  fi
  local dumpfile; dumpfile="$(mget "$dir/manifest.json" dumpFile)"
  local opts=(--no-owner --no-privileges --exit-on-error --single-transaction)
  [ "${n:-0}" -eq 0 ] || opts+=(--clean --if-exists)
  note "Restauration dans $(url_ident "$target")…"
  if [ "$dumpfile" = "database.dump.age" ]; then
    [ -n "${ACRA_BACKUP_AGE_IDENTITY:-}" ] || die 10 "Point chiffré : ACRA_BACKUP_AGE_IDENTITY (clé privée age) requis."
    command -v age >/dev/null 2>&1 || die 10 "« age » introuvable."
    age -d -i "$ACRA_BACKUP_AGE_IDENTITY" "$dir/database.dump.age" | pgx pg_restore -d "$target" "${opts[@]}" >/dev/null || die 30 "Restauration en échec (transaction annulée : la base cible est inchangée)."
  else
    pgx pg_restore -d "$target" "${opts[@]}" < "$dir/database.dump" >/dev/null || die 30 "Restauration en échec (transaction annulée : la base cible est inchangée)."
  fi

  # Contrôle 1 : comptes de lignes == manifeste.
  local t exp got bad=0
  for t in $COUNTED_TABLES; do
    exp="$(sed -n "s/^[[:space:]]*\"$t\":[[:space:]]*\([0-9]*\),\{0,1\}\$/\1/p" "$dir/manifest.json" | head -1)"
    [ -n "$exp" ] || continue
    got="$(q "$target" "SELECT count(*) FROM \"$t\"" 2>/dev/null | tr -d '[:space:]' || true)"
    [ "$got" = "$exp" ] || { bad=1; note "Écart $t : manifeste $exp, restauré ${got:-?}"; }
  done
  # Contrôle 2 : empreinte des clés de documents référencées (profil ha) == manifeste.
  local want; want="$(mget "$dir/manifest.json" keysSha256)"
  if [ -n "$want" ]; then
    local keys have; keys="$(doc_keys "$target" 2>/dev/null)" || { bad=1; note "Inventaire des documents impossible dans la base restaurée."; }
    if [ -n "$keys" ]; then have="$(sha256_str "$keys
")"; else have="$(sha256_str "")"; fi
    [ "$have" = "$want" ] || { bad=1; note "Empreinte des clés de documents différente du manifeste."; }
  fi
  [ "$bad" -eq 0 ] || die 30 "Contrôle de la base restaurée en échec : NE PAS basculer DATABASE_URL. La base $(url_ident "$target") est conservée pour analyse."
  echo "Base restaurée et contrôlée : $(url_ident "$target") (point $id)."
  echo "Étapes suivantes (guide HA § 3.4) : écritures arrêtées → documents à l'instant $(mget "$dir/manifest.json" keysCapturedAt) (scripts/acra-restore-ha.sh documents …) → bascule de DATABASE_URL → migrations (service migrator) → redémarrage → tâche « coherence-documents »."
}

# ── documents ─────────────────────────────────────────────────────────────────────────────────────
cmd_documents() {
  local at="" tob="" topfx="" todir="" keysFrom=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --at) at="${2:-}"; shift ;; --to-bucket) tob="${2:-}"; shift ;; --to-prefix) topfx="${2:-}"; shift ;;
      --to-dir) todir="${2:-}"; shift ;; --keys-from) keysFrom="${2:-}"; shift ;;
      *) die 2 "Option inconnue : $1" ;;
    esac
    shift
  done
  printf '%s' "$at" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' || die 2 "--at AAAA-MM-JJTHH:MM:SSZ (UTC) requis."
  { [ -n "$tob" ] && [ -z "$todir" ]; } || { [ -z "$tob" ] && [ -n "$todir" ]; } || die 2 "Une destination : --to-bucket <bucket> [--to-prefix p] OU --to-dir <dossier>."
  [ -z "$tob" ] || printf '%s' "$tob" | grep -Eq '^[a-z0-9][a-z0-9.-]{1,62}$' || die 2 "Nom de bucket de destination invalide."
  topfx="$(printf '%s' "$topfx" | sed 's#^/*##; s#/*$##')"
  [ -z "$topfx" ] || printf '%s' "$topfx" | grep -Eq '^[A-Za-z0-9._/-]{1,200}$' || die 2 "Préfixe de destination invalide."
  local rcl="${ACRA_RCLONE:-rclone}"
  command -v "$rcl" >/dev/null 2>&1 || die 10 "rclone introuvable (https://rclone.org/install/) ou ACRA_RCLONE."
  local ep reg bucket kid sec pfx path_style
  ep="$(env_or_dotenv S3_ENDPOINT)"; reg="$(env_or_dotenv S3_REGION)"; bucket="$(env_or_dotenv S3_BUCKET)"
  kid="$(env_or_dotenv S3_ACCESS_KEY_ID)"; sec="$(env_or_dotenv S3_SECRET_ACCESS_KEY)"; pfx="$(env_or_dotenv S3_PREFIX)"; path_style="$(env_or_dotenv S3_FORCE_PATH_STYLE)"
  [ -n "$ep" ] && [ -n "$bucket" ] && [ -n "$kid" ] && [ -n "$sec" ] || die 10 "Configuration S3 incomplète (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)."
  pfx="$(printf '%s' "$pfx" | sed 's#^/*##; s#/*$##')"
  if [ -n "$tob" ] && [ "$tob" = "$bucket" ] && [ "$topfx" = "$pfx" ]; then die 2 "Restauration en place refusée : choisir un autre bucket ou un autre préfixe, contrôler, puis basculer S3_BUCKET/S3_PREFIX."; fi
  # Identifiants par l'ENVIRONNEMENT de rclone (jamais en argument).
  export RCLONE_CONFIG_ACRADOCS_TYPE=s3 RCLONE_CONFIG_ACRADOCS_PROVIDER="${ACRA_S3_PROVIDER:-Other}" RCLONE_CONFIG_ACRADOCS_ENDPOINT="$ep" \
    RCLONE_CONFIG_ACRADOCS_ACCESS_KEY_ID="$kid" RCLONE_CONFIG_ACRADOCS_SECRET_ACCESS_KEY="$sec" RCLONE_CONFIG_ACRADOCS_NO_CHECK_BUCKET=true
  [ -z "$reg" ] || export RCLONE_CONFIG_ACRADOCS_REGION="$reg"
  case "$path_style" in false|0|no) export RCLONE_CONFIG_ACRADOCS_FORCE_PATH_STYLE=false ;; *) export RCLONE_CONFIG_ACRADOCS_FORCE_PATH_STYLE=true ;; esac
  local src="ACRADOCS,version_at=$at:$bucket${pfx:+/$pfx}" dst
  if [ -n "$tob" ]; then dst="ACRADOCS:$tob${topfx:+/$topfx}"; else mkdir -p "$todir"; dst="$todir"; fi
  local filter=() tmp=""
  if [ -n "$keysFrom" ]; then
    local dir; dir="$(check_point "$keysFrom")"
    tmp="$(mktemp "${TMPDIR:-/tmp}/acra-keys.XXXXXX")"
    if [ -f "$dir/documents-keys.txt" ]; then cp "$dir/documents-keys.txt" "$tmp"
    elif [ -f "$dir/documents-keys.txt.age" ]; then
      [ -n "${ACRA_BACKUP_AGE_IDENTITY:-}" ] || { rm -f "$tmp"; die 10 "Liste des clés chiffrée : ACRA_BACKUP_AGE_IDENTITY requis."; }
      age -d -i "$ACRA_BACKUP_AGE_IDENTITY" "$dir/documents-keys.txt.age" > "$tmp" || { rm -f "$tmp"; die 10 "Déchiffrement de la liste des clés en échec."; }
    else rm -f "$tmp"; die 31 "Le point $keysFrom ne contient pas de liste de clés de documents (profil mono-instance ?)."; fi
    filter=(--files-from-raw "$tmp")
  fi
  note "Copie des documents tels qu'au $at vers ${tob:+$tob${topfx:+/$topfx}}${todir}…"
  local rc=0
  "$rcl" copy "$src" "$dst" ${filter[@]+"${filter[@]}"} --checksum >/dev/null 2>&1 || rc=30
  if [ "$rc" -eq 0 ]; then "$rcl" check "$src" "$dst" --one-way ${filter[@]+"${filter[@]}"} >/dev/null 2>&1 || rc=30; fi
  [ -z "$tmp" ] || rm -f "$tmp"
  [ "$rc" -eq 0 ] || die 30 "Copie ou contrôle des documents en échec (rien n'a été modifié dans le bucket source)."
  echo "Documents copiés et contrôlés (état au $at). Basculer S3_BUCKET/S3_PREFIX vers la copie, redémarrer, puis lancer la tâche « coherence-documents »."
}

CMD="${1:-}"; [ $# -gt 0 ] && shift
case "$CMD" in
  database) cmd_database "$@" ;;
  documents) cmd_documents "$@" ;;
  *) die 2 "Usage : acra-restore-ha.sh database <id> --target-url <url> [--force] [--yes] | documents --at <AAAA-MM-JJTHH:MM:SSZ> (--to-bucket <b> [--to-prefix <p>] | --to-dir <d>) [--keys-from <id>]" ;;
esac
