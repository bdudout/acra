#!/usr/bin/env bash
# ─── Points de restauration ACRA (base + documents) — docs/specs/sauvegarde-rollback-spec.md, lot 1 ───
# Un point de restauration = un dossier `backups/<id>/` : dump PostgreSQL (format custom), archive des
# documents, empreintes, manifeste (écrit EN DERNIER), et un clone de la base (restauration rapide).
#
# Usage :
#   scripts/acra-snapshot.sh create  --reason pre-update|manual|scheduled [--tier daily,weekly,monthly --scheduled-for AAAA-MM-JJ (scheduled)] [--from-version V] [--to-version V] [--verify full|quick] [--no-clone] [--json]
#   scripts/acra-snapshot.sh verify  <id> [--full]
#   scripts/acra-snapshot.sh list    [--json]
#   scripts/acra-snapshot.sh restore <id> [--yes] [--keep-current]     # base + documents ; ne touche pas au code
#   scripts/acra-snapshot.sh prune   [--keep N] [--dry-run] [--include-manual] [--ids id1,id2]   (--ids : liste exacte, sans règle de rétention)
#   scripts/acra-snapshot.sh index                                       # régénère .acra-update/snapshots.json
#
# Codes de sortie : 0 succès · 2 usage · 10 prérequis · 11 espace insuffisant · 20 dump en échec ·
#   21 vérification en échec · 22 clone en échec (non bloquant) · 30 restauration en échec ·
#   31 identifiant inconnu · 32 empreinte de clé différente · 33 restauration automatique refusée (profil ha) ·
#   40 verrou détenu · 41 sauvegarde de la base partagée déjà en cours ou déjà faite (profil ha, autre hôte).
# Variables : ACRA_BACKUP_DIR (./backups) · ACRA_COMPOSE_FILES · ACRA_SNAPSHOT_VERIFY · ACRA_SNAPSHOT_FULL_MAX_MB (2048)
#   · ACRA_SNAPSHOT_KEEP (3) · ACRA_FAILED_DB_RETENTION_DAYS (14) · ACRA_BACKUP_AGE_RECIPIENT / ACRA_BACKUP_AGE_IDENTITY
#   · ACRA_DB_MODE (compose|url ; lot 6) · ACRA_PG_CLIENT (auto|docker|host : où tournent pg_dump/pg_restore/psql en mode url) · ACRA_DOCUMENTS_DIR (documents sur disque, installation sans Docker) · ACRA_SNAPSHOT_HOOK (commande appelée avec l'identifiant) · ACRA_SNAPSHOT_OFFSITE_CMD.
# Profil multi-instance « ha » (docker-compose.ha.yml ; ACRA_DEPLOY_PROFILE=ha ou surcouche dans ACRA_COMPOSE_FILES) —
#   docs/deploiement-haute-disponibilite.md § 3.4 : base EXTERNE (mode url par défaut ; BACKUP_DATABASE_URL, connexion directe
#   hors pgbouncer en mode transaction, préférée à DATABASE_URL), documents en S3 (pas d'archive : inventaire des clés
#   référencées + empreinte au manifeste, contrôle de présence dans le bucket par l'application), pas de clone, bail en base
#   (CronVerrou « script:sauvegarde-base ») pour qu'une seule sauvegarde tourne tous hôtes confondus, restauration de contrôle
#   sur ACRA_BACKUP_VERIFY_DATABASE_URL si défini, et AUCUNE restauration automatique (code 33 : scripts/acra-restore-ha.sh).
# Jamais de secret dans un journal, un manifeste ou un nom de fichier.
set -Eeuo pipefail
umask 077
cd "${ACRA_ROOT:-$(dirname "$0")/..}"

ID_RE='^[0-9]{8}T[0-9]{6}Z-(pre-update|manual|scheduled)-[0-9A-Za-z.+-]{1,40}$'
COUNTED_TABLES="User Organization Analyse Risque PlanAction AuditLog Document _prisma_migrations"

BACKUP_DIR="${ACRA_BACKUP_DIR:-./backups}"
UPDATE_DIR=".acra-update"
KEEP="${ACRA_SNAPSHOT_KEEP:-3}"
FAILED_RETENTION_DAYS="${ACRA_FAILED_DB_RETENTION_DAYS:-14}"
FULL_MAX_MB="${ACRA_SNAPSHOT_FULL_MAX_MB:-2048}"
# Profil de déploiement : « ha » (multi-instance) ou « single » (défaut).
# Ordre : variable ACRA_DEPLOY_PROFILE, surcouche docker-compose.ha.yml de l'agent, puis ACRA_DEPLOY_PROFILE du .env (écrit par
# scripts/setup.sh --profil ha) : un lancement à la main sans variable ne doit jamais traiter une base partagée en mono-instance.
PROFILE="${ACRA_DEPLOY_PROFILE:-}"
if [ -z "$PROFILE" ]; then case " ${ACRA_COMPOSE_FILES:-} " in *docker-compose.ha.yml*) PROFILE=ha ;; esac; fi
if [ -z "$PROFILE" ] && [ -f .env ]; then PROFILE="$(sed -n 's/^ACRA_DEPLOY_PROFILE=//p' .env 2>/dev/null | tail -1 | tr -d '"'"'"'\r[:space:]' || true)"; fi
[ "$PROFILE" = "ha" ] || PROFILE=single
DB_MODE="${ACRA_DB_MODE:-}"
if [ -z "$DB_MODE" ]; then if [ "$PROFILE" = "ha" ]; then DB_MODE=url; else DB_MODE=compose; fi; fi
# Documents : volume local (archive tar) ou stockage objet S3 (inventaire des clés référencées, pas de copie du bucket).
DOCS_STORAGE=local
if [ "$PROFILE" = "ha" ] || [ "${DOCUMENT_STORAGE:-}" = "s3" ]; then DOCS_STORAGE=s3; fi
# shellcheck disable=SC2206
COMPOSE=(docker compose ${ACRA_COMPOSE_FILES:-})
git() { command git -c safe.directory="$PWD" "$@"; }

die() { local code="$1"; shift; echo "✗ $*" >&2; exit "$code"; }
note() { echo "$*" >&2; }
now_stamp() { date -u +%Y%m%dT%H%M%SZ; }
now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }
is_id() { printf '%s' "$1" | grep -Eq "$ID_RE"; }

sha256_file() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
sha256_str() { if command -v sha256sum >/dev/null 2>&1; then printf '%s' "$1" | sha256sum | cut -d' ' -f1; else printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1; fi; }
file_size() { if stat -c %s "$1" >/dev/null 2>&1; then stat -c %s "$1"; else stat -f %z "$1"; fi; }
free_kb() { df -Pk "$1" 2>/dev/null | awk 'NR==2{print $4}'; }
json_escape() { printf '%s' "$1" | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g'; }

# ── Accès base (mode compose ; le mode url est traité au lot 6) ───────────────────────────────────
# shellcheck disable=SC2016
# Mode url (base externe ou managée, lot 6) : DATABASE_URL (environnement ou .env, jamais affichée) ; les outils clients
# tournent dans un conteneur éphémère postgres:<majeure du serveur>-alpine si Docker est présent, sinon sur l'hôte à condition
# que leur version majeure soit ≥ celle du serveur (sinon code 10).
env_or_dotenv() { local v="${!1:-}"; if [ -z "$v" ] && [ -f .env ]; then v="$(sed -n "s/^$1=//p" .env 2>/dev/null | head -1 | tr -d '"'"'"'\r' || true)"; fi; printf '%s' "$v"; }
# URL_OVERRIDE (locale à verify_full) : serveur de la restauration de contrôle. BACKUP_DATABASE_URL : connexion dédiée à la
# sauvegarde (directe, idéalement en lecture), préférée à DATABASE_URL.
db_url() {
  if [ -n "${URL_OVERRIDE:-}" ]; then printf '%s' "$URL_OVERRIDE"; return 0; fi
  local u; u="$(env_or_dotenv BACKUP_DATABASE_URL)"; [ -n "$u" ] || u="$(env_or_dotenv DATABASE_URL)"; printf '%s' "$u"
}
url_for() { local u base q; u="$(db_url)"; base="${u%%\?*}"; q="${u#"$base"}"; printf '%s/%s%s' "${base%/*}" "$1" "$q"; }
PG_PREFIX=()
pgx() { if [ "${#PG_PREFIX[@]}" -gt 0 ]; then "${PG_PREFIX[@]}" "$@"; else "$@"; fi; }
init_db() {
  [ "$DB_MODE" = "url" ] || return 0
  [ -n "$(db_url)" ] || die 10 "ACRA_DB_MODE=url : DATABASE_URL introuvable (environnement ou .env)."
  local major cmajor t u client="${ACRA_PG_CLIENT:-auto}"   # auto | docker | host
  u="$(url_for postgres)"
  if [ "$client" = "host" ] || { [ "$client" = "auto" ] && ! command -v docker >/dev/null 2>&1; }; then client=host; else client=docker; fi
  if [ "$client" = "host" ]; then major="$(psql -d "$u" -tA -c 'SHOW server_version_num' 2>/dev/null | tr -d '[:space:]')"
  else major="$(docker run --rm -i --network host postgres:alpine psql -d "$u" -tA -c 'SHOW server_version_num' 2>/dev/null | tr -d '[:space:]')"; fi
  [ -n "${major:-}" ] || die 10 "Base inaccessible (SHOW server_version_num en échec)."
  major=$(( major / 10000 ))
  if [ "$client" = "docker" ]; then
    PG_PREFIX=(docker run --rm -i --network host "postgres:${major}-alpine")
  else
    for t in pg_dump pg_restore psql; do
      command -v "$t" >/dev/null 2>&1 || die 10 "Ni Docker ni $t sur l'hôte : impossible de sauvegarder une base externe."
      cmajor="$("$t" --version | sed -n 's/[^0-9]*\([0-9][0-9]*\)\..*/\1/p' | head -1)"
      [ "${cmajor:-0}" -ge "$major" ] || die 10 "$t (version majeure ${cmajor:-?}) est plus ancien que le serveur PostgreSQL ($major) : installer un client ≥ $major ou Docker."
    done
  fi
}
dbq() {
  if [ "$DB_MODE" = "url" ]; then pgx psql -d "$(url_for "$1")" -tA -c "$2"
  else "${COMPOSE[@]}" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$1" -tA -c "$2"' _ "$1" "$2"; fi
}
db_name() {
  if [ "$DB_MODE" = "url" ]; then local u base; u="$(db_url)"; base="${u%%\?*}"; printf '%s' "${base##*/}"
  else "${COMPOSE[@]}" exec -T db printenv POSTGRES_DB | tr -d '\r\n'; fi
}
# Dump, liste et restauration (stdin/stdout transmis).
pg_dump_cmd() { # db
  if [ "$DB_MODE" = "url" ]; then pgx pg_dump -d "$(url_for "$1")" -Fc -Z 6
  # shellcheck disable=SC2016
  else "${COMPOSE[@]}" exec -T db sh -c 'pg_dump -Fc -Z 6 -U "$POSTGRES_USER" "$POSTGRES_DB"'; fi
}
pg_list_cmd() { if [ "$DB_MODE" = "url" ]; then pgx pg_restore --list; else "${COMPOSE[@]}" exec -T db pg_restore --list; fi; }
pg_restore_cmd() { # db
  if [ "$DB_MODE" = "url" ]; then pgx pg_restore -d "$(url_for "$1")" --no-owner --exit-on-error
  # shellcheck disable=SC2016
  else "${COMPOSE[@]}" exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error' _ "$1"; fi
}
existing_services() {
  local defined svc; defined="$("${COMPOSE[@]}" config --services 2>/dev/null || true)"
  for svc in "$@"; do printf '%s\n' "$defined" | grep -qx "$svc" && printf '%s\n' "$svc"; done
  return 0
}

# ── Verrou (mkdir atomique + pid) ─────────────────────────────────────────────────────────────────
LOCK=""
take_lock() {
  # Une mise à jour en cours (scripts/update.sh) est seule maîtresse des points de restauration.
  if [ "${ACRA_RUN_OWNER:-0}" != "1" ] && [ -f "$UPDATE_DIR/run/lock/pid" ] && kill -0 "$(cat "$UPDATE_DIR/run/lock/pid" 2>/dev/null)" 2>/dev/null; then
    die 40 "Une mise à jour est en cours : opération refusée."
  fi
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  LOCK="$BACKUP_DIR/.lock"
  if ! mkdir "$LOCK" 2>/dev/null; then
    local pid; pid="$(cat "$LOCK/pid" 2>/dev/null || true)"
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || die 40 "Verrou détenu ($LOCK)."
    else die 40 "Une autre opération (mise à jour ou point de restauration) est en cours ($LOCK)."; fi
  fi
  echo "$$" > "$LOCK/pid"
}
release_lock() { lease_release; [ -z "$LOCK" ] || rm -rf "$LOCK"; LOCK=""; }

# ── Profil ha : bail en base (une seule sauvegarde de la base partagée, tous hôtes confondus) ─────
# Même table et même sémantique que les tâches planifiées HTTP (lib/cron-verrou.server.ts) : acquisition atomique
# (INSERT … ON CONFLICT … WHERE échu), libération par jeton, expiration automatique (ACRA_BACKUP_LEASE_MINUTES, 360) si
# l'hôte s'arrête en cours de route. Un point planifié fait le jour J est marqué (« script:sauvegarde-planifiee ») : un
# second hôte où l'agent serait aussi installé s'abstient (code 41) au lieu de refaire la sauvegarde.
LEASE_TOKEN=""; LEASE_DB=""
lease_take() { # base
  [ "$PROFILE" = "ha" ] || return 0
  local mins="${ACRA_BACKUP_LEASE_MINUTES:-360}" tok out
  case "$mins" in ''|*[!0-9]*) mins=360 ;; esac
  tok="run-$(hostname 2>/dev/null | tr -cd 'A-Za-z0-9.-' | cut -c1-40)-$$-$(date +%s)"
  out="$(dbq "$1" "INSERT INTO \"CronVerrou\" (\"tache\", \"jusqua\", \"jeton\") VALUES ('script:sauvegarde-base', (now() AT TIME ZONE 'UTC') + make_interval(mins => $mins), '$tok') ON CONFLICT (\"tache\") DO UPDATE SET \"jusqua\" = EXCLUDED.\"jusqua\", \"jeton\" = EXCLUDED.\"jeton\" WHERE \"CronVerrou\".\"jusqua\" < (now() AT TIME ZONE 'UTC') RETURNING \"tache\"" 2>/dev/null)" \
    || die 10 "Bail de sauvegarde impossible (table CronVerrou inaccessible : migrations appliquées ?)."
  printf '%s\n' "$out" | grep -qx 'script:sauvegarde-base' || die 41 "Une sauvegarde de la base partagée est déjà en cours (autre hôte ou autre processus) : rien n'est fait."
  LEASE_TOKEN="$tok"; LEASE_DB="$1"
}
lease_release() {
  [ -n "${LEASE_TOKEN:-}" ] || return 0
  dbq "$LEASE_DB" "UPDATE \"CronVerrou\" SET \"jusqua\" = '1970-01-01' WHERE \"tache\" = 'script:sauvegarde-base' AND \"jeton\" = '$LEASE_TOKEN'" >/dev/null 2>&1 || true
  LEASE_TOKEN=""
}
scheduled_done_check() { # date base — 41 si un autre hôte a déjà fait la sauvegarde planifiée de ce jour
  [ "$PROFILE" = "ha" ] && [ -n "$1" ] || return 0
  local v; v="$(dbq "$2" "SELECT \"jeton\" FROM \"CronVerrou\" WHERE \"tache\" = 'script:sauvegarde-planifiee'" 2>/dev/null | tr -d '[:space:]' || true)"
  [ "$v" != "fait:$1" ] || die 41 "La sauvegarde planifiée du $1 a déjà été faite (autre hôte) : rien n'est fait."
}
scheduled_done_mark() { # date base
  [ "$PROFILE" = "ha" ] && [ -n "$1" ] || return 0
  dbq "$2" "INSERT INTO \"CronVerrou\" (\"tache\", \"jusqua\", \"jeton\") VALUES ('script:sauvegarde-planifiee', (now() AT TIME ZONE 'UTC'), 'fait:$1') ON CONFLICT (\"tache\") DO UPDATE SET \"jusqua\" = EXCLUDED.\"jusqua\", \"jeton\" = EXCLUDED.\"jeton\"" >/dev/null 2>&1 \
    || note "Marqueur de sauvegarde planifiée non écrit (non bloquant) : un autre hôte pourrait refaire la sauvegarde du jour."
}

# ── Documents en S3 : inventaire des clés référencées par la base et contrôle de présence ────────
# Clés de stockage de tous les fichiers : Document.storageKey et pièces jointes des campagnes de contrôle et des missions
# d'audit (`rapports[].storageKey`). Triées en ordre d'octets (COLLATE "C"), sans doublon : l'empreinte SHA-256 de la liste
# (une clé par ligne, saut de ligne final) est la même que celle calculée par l'application (lib/documents-coherence).
doc_keys() { # base
  dbq "$1" "SELECT k FROM (SELECT \"storageKey\" AS k FROM \"Document\" UNION SELECT r->>'storageKey' FROM \"CampagneControle\" c, jsonb_array_elements(CASE WHEN jsonb_typeof(c.\"rapports\") = 'array' THEN c.\"rapports\" ELSE '[]'::jsonb END) r UNION SELECT r->>'storageKey' FROM \"AuditMission\" m, jsonb_array_elements(CASE WHEN jsonb_typeof(m.\"rapports\") = 'array' THEN m.\"rapports\" ELSE '[]'::jsonb END) r) s WHERE k IS NOT NULL AND k <> '' ORDER BY k COLLATE \"C\""
}
# Contrôle « tous les documents référencés existent dans le bucket » : exécuté PAR L'APPLICATION (adaptateur S3, HEAD de chaque
# clé ; tâche planifiée « coherence-documents », tracée, signalée au journal d'audit et relançable). Le secret CRON_SECRET reste
# dans le conteneur. Rend ok | ecart | non_execute.
bucket_check() {
  local err; err="$(mktemp "${TMPDIR:-/tmp}/acra-bucket-check.XXXXXX")"
  # shellcheck disable=SC2016
  if "${COMPOSE[@]}" exec -T app sh -c 'wget -qO- -T 900 --header "Authorization: Bearer $CRON_SECRET" --post-data "" http://127.0.0.1:3000/api/cron/coherence-documents' >/dev/null 2>"$err"; then echo ok
  elif grep -q ' 409' "$err"; then echo ecart
  else echo non_execute; fi
  rm -f "$err"
}

# ── Lecture d'un manifeste (un champ par ligne, cf. write_manifest) ───────────────────────────────
mget() { sed -n "s/^[[:space:]]*\"$2\":[[:space:]]*\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\}[[:space:]]*\$/\1/p" "$1" | head -1; }
# Valeur textuelle pouvant contenir des virgules (ex. "daily,weekly").
mget_list() { sed -n "s/^[[:space:]]*\"$2\":[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$1" | head -1; }
snapshot_dir() { printf '%s/%s' "$BACKUP_DIR" "$1"; }

# ── Empreintes ────────────────────────────────────────────────────────────────────────────────────
write_sums() { # dossier
  ( cd "$1" && : > SHA256SUMS.tmp
    for f in database.dump database.dump.age documents.tar.gz documents.tar.gz.age documents-keys.txt documents-keys.txt.age; do
      [ -f "$f" ] && printf '%s  %s\n' "$(sha256_file "$f")" "$f" >> SHA256SUMS.tmp
    done
    mv SHA256SUMS.tmp SHA256SUMS )
}
check_sums() { # dossier
  local d="$1" h f
  [ -f "$d/SHA256SUMS" ] || return 1
  while read -r h f; do
    [ -n "$f" ] || continue
    [ -f "$d/$f" ] || return 1
    [ "$(sha256_file "$d/$f")" = "$h" ] || return 1
  done < "$d/SHA256SUMS"
}

# ── Comptes de lignes (liste fixe) ────────────────────────────────────────────────────────────────
row_counts() { # base → "Table=N …" (N vide si la table n'existe pas)
  local t n
  for t in $COUNTED_TABLES; do
    n="$(dbq "$1" "SELECT count(*) FROM \"$t\"" 2>/dev/null | tr -d '[:space:]' || true)"
    printf '%s=%s ' "$t" "${n:-}"
  done
}
count_of() { printf '%s' "$1" | tr ' ' '\n' | sed -n "s/^$2=//p" | head -1; }

# ── Vérification ──────────────────────────────────────────────────────────────────────────────────
verify_quick() { # dossier
  local d="$1" dump="$1/database.dump"
  check_sums "$d" || return 1
  if [ -f "$dump" ]; then
    # Ne pas relier directement pg_restore à grep -q : ce dernier ferme le pipe
    # après la première correspondance et peut provoquer un SIGPIPE de pg_restore
    # avec `pipefail`, malgré un dump parfaitement lisible.
    local catalog status
    catalog="$(mktemp "${TMPDIR:-/tmp}/acra-snapshot-pg-list.XXXXXX")" || return 1
    if ! pg_list_cmd < "$dump" > "$catalog" 2>/dev/null; then
      rm -f "$catalog"
      return 1
    fi
    grep -q 'TABLE DATA' "$catalog"
    status=$?
    rm -f "$catalog"
    [ "$status" -eq 0 ] || return 1
  fi
  if [ -f "$d/documents.tar.gz" ]; then gzip -t "$d/documents.tar.gz" 2>/dev/null || return 1; fi
  return 0
}
verify_full() { # dossier db before after → 0 si les comptes restaurés correspondent ; 2 si la base jetable n'a pas pu être créée
  local d="$1" db="$2" before="$3" after="$4" vdb="" ok=0 t got b a
  # Profil ha : restauration de contrôle sur un serveur dédié si ACRA_BACKUP_VERIFY_DATABASE_URL est défini (pas de charge ni
  # de base temporaire sur le primaire de production) ; sinon sur le serveur de la sauvegarde.
  local URL_OVERRIDE=""
  if [ "$PROFILE" = "ha" ] && [ -n "${ACRA_BACKUP_VERIFY_DATABASE_URL:-}" ]; then URL_OVERRIDE="$ACRA_BACKUP_VERIFY_DATABASE_URL"; fi
  vdb="$(printf '%.40s__verify_%s' "$db" "$(now_stamp)")"
  # shellcheck disable=SC2064
  # Le piège RETURN se désarme lui-même : sinon il se redéclenche au retour de l'appelant (hors du serveur de contrôle).
  trap "dbq postgres \"DROP DATABASE IF EXISTS \\\"$vdb\\\"\" >/dev/null 2>&1 || true; trap - RETURN" RETURN
  dbq postgres "CREATE DATABASE \"$vdb\"" >/dev/null || return 2
  pg_restore_cmd "$vdb" < "$d/database.dump" >/dev/null 2>&1 || return 1
  local restored; restored="$(row_counts "$vdb")"
  RESTORED_COUNTS="$restored"
  # Documents en S3 : clés référencées par le dump LUI-MÊME (lues dans la base restaurée) — inventaire exact du point.
  if [ "$DOCS_STORAGE" = "s3" ]; then RESTORED_KEYS="$(doc_keys "$vdb" 2>/dev/null)" && RESTORED_KEYS_OK=1 || RESTORED_KEYS_OK=0; fi
  for t in $COUNTED_TABLES; do
    got="$(count_of "$restored" "$t")"; b="$(count_of "$before" "$t")"; a="$(count_of "$after" "$t")"
    [ -n "$b$a" ] || continue
    if [ "$got" != "$b" ] && [ "$got" != "$a" ]; then ok=1; note "Écart de comptes (table $t) : dump=$b/$a restauré=$got"; fi
  done
  return "$ok"
}

# ── Manifeste (écrit en dernier) ──────────────────────────────────────────────────────────────────
write_manifest() { # dossier + variables M_*
  local d="$1" t first=1 line
  {
    printf '{\n  "schema": 1,\n  "id": "%s",\n  "reason": "%s",\n  "profile": "%s",\n  "createdAt": "%s",\n  "tiers": "%s",\n  "scheduledFor": "%s",\n' "$M_ID" "$M_REASON" "$PROFILE" "$M_CREATED" "${M_TIERS:-}" "${M_SFOR:-}"
    printf '  "acra": {\n    "version": "%s",\n    "revision": "%s",\n    "image": %s,\n    "channel": %s,\n    "toVersion": %s\n  },\n' "$M_VERSION" "$M_REVISION" "$M_IMAGE" "$M_CHANNEL" "$M_TOVERSION"
    printf '  "database": {\n    "mode": "%s",\n    "serverVersion": "%s",\n    "name": "%s",\n    "sizeBytes": %s,\n    "dumpFile": "%s",\n    "dumpBytes": %s,\n    "encrypted": %s,\n    "clone": %s,\n' "$DB_MODE" "$M_SERVER" "$M_DB" "$M_DBBYTES" "$M_DUMPFILE" "$M_DUMPBYTES" "$M_ENCRYPTED" "$M_CLONE"
    printf '    "migrationsCount": %s,\n    "migrationsLast": "%s",\n    "migrationsHash": "%s",\n' "${M_MIGCOUNT:-0}" "${M_MIGLAST:-}" "${M_MIGHASH:-}"
    printf '    "rowCounts": {\n'
    for t in $COUNTED_TABLES; do
      line="$(count_of "$M_COUNTS" "$t")"
      [ "$first" -eq 1 ] || printf ',\n'; first=0
      printf '      "%s": %s' "$t" "${line:-null}"
    done
    printf '\n    }\n  },\n'
    if [ "$DOCS_STORAGE" = "s3" ]; then
      # Documents en S3 : rien n'est copié ; inventaire des clés référencées (fichier chiffré comme le dump), horodatage, empreinte
      # et résultat du contrôle de présence dans le bucket — cohérence vérifiable à la restauration (versioning S3, § 3.4).
      printf '  "documents": {\n    "storage": "s3",\n    "included": false,\n    "files": %s,\n    "bytes": 0,\n    "archive": "",\n    "referencedKeys": %s,\n    "keysFile": "%s",\n    "keysSha256": "%s",\n    "keysCapturedAt": "%s",\n    "keysSource": "%s",\n    "bucketCheck": "%s"\n  },\n' \
        "$M_KEYS_COUNT" "$M_KEYS_COUNT" "$M_KEYS_FILE" "$M_KEYS_SHA" "$M_KEYS_AT" "$M_KEYS_SOURCE" "$M_BUCKET_CHECK"
    else
      printf '  "documents": {\n    "storage": "local",\n    "included": %s,\n    "files": %s,\n    "bytes": %s,\n    "archive": "%s"\n  },\n' "$M_DOCS_INCLUDED" "${M_DOCS_FILES:-0}" "${M_DOCS_BYTES:-0}" "${M_DOCS_ARCHIVE:-}"
    fi
    printf '  "secretsKeyFingerprint": %s,\n' "$M_FINGERPRINT"
    if [ "${M_FULL_IMPOSSIBLE:-0}" = "1" ]; then
      printf '  "verification": {\n    "level": "%s",\n    "at": "%s",\n    "ok": true,\n    "fullImpossible": true\n  },\n' "$M_LEVEL" "$(now_iso)"
    else
      printf '  "verification": {\n    "level": "%s",\n    "at": "%s",\n    "ok": true\n  },\n' "$M_LEVEL" "$(now_iso)"
    fi
    printf '  "host": {\n    "composeFiles": "%s"\n  }\n}\n' "$(json_escape "${ACRA_COMPOSE_FILES:-}")"
  } > "$d/manifest.json.tmp"
  chmod 600 "$d/manifest.json.tmp"; mv "$d/manifest.json.tmp" "$d/manifest.json"
}

# ── Index publié pour l'application ───────────────────────────────────────────────────────────────
cmd_index() {
  mkdir -p "$UPDATE_DIR"
  local out="$UPDATE_DIR/snapshots.json" first=1 d id
  {
    printf '{ "schema": 1, "generatedAt": "%s", "snapshots": [' "$(now_iso)"
    for d in "$BACKUP_DIR"/*/; do
      [ -f "${d}manifest.json" ] || continue
      id="$(basename "$d")"; is_id "$id" || continue
      [ "$first" -eq 1 ] || printf ','; first=0
      printf '\n  { "id": "%s", "reason": "%s", "tiers": [%s], "createdAt": "%s", "version": "%s", "toVersion": "%s", "verified": "%s", "clone": %s, "documents": %s, "encrypted": %s, "sizeBytes": %s, "documentsStorage": "%s", "referencedKeys": %s, "bucketCheck": "%s" }' \
        "$id" "$(mget "${d}manifest.json" reason)" "$(tl=$(mget_list "${d}manifest.json" tiers); printf '%s' "$tl" | sed 's/\([a-z]*\)/"\1"/g')" "$(mget "${d}manifest.json" createdAt)" "$(mget "${d}manifest.json" version)" \
        "$(m=$(mget "${d}manifest.json" toVersion); [ "$m" = "null" ] && m=""; printf '%s' "$m")" \
        "$(mget "${d}manifest.json" level)" \
        "$(c=$(mget "${d}manifest.json" clone); if [ -n "$c" ] && [ "$c" != "null" ]; then echo true; else echo false; fi)" \
        "$(mget "${d}manifest.json" included)" "$(mget "${d}manifest.json" encrypted | head -1)" "$(mget "${d}manifest.json" dumpBytes)" \
        "$(s=$(mget "${d}manifest.json" storage); printf '%s' "${s:-local}")" "$(k=$(mget "${d}manifest.json" referencedKeys); printf '%s' "${k:-null}")" "$(mget "${d}manifest.json" bucketCheck)"
    done
    printf '\n] }\n'
  } > "$out.tmp"
  chmod 644 "$out.tmp"; mv "$out.tmp" "$out"
}

C_DIR=""; C_CLONE=""
cleanup_create() {
  [ -z "$C_DIR" ] || rm -rf "$C_DIR"
  [ -z "$C_CLONE" ] || dbq postgres "DROP DATABASE IF EXISTS \"$C_CLONE\"" >/dev/null 2>&1 || true
  release_lock
}

# ── create ────────────────────────────────────────────────────────────────────────────────────────
cmd_create() {
  local reason="" from="" to="" level="${ACRA_SNAPSHOT_VERIFY:-}" clone=1 json=0 tiers="" sfor=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --reason) reason="${2:-}"; shift ;;
      --from-version) from="${2:-}"; shift ;;
      --to-version) to="${2:-}"; shift ;;
      --verify) level="${2:-}"; shift ;;
      --no-clone) clone=0 ;;
      --tier) tiers="${2:-}"; shift ;;
      --scheduled-for) sfor="${2:-}"; shift ;;
      --json) json=1 ;;
      *) die 2 "Option inconnue : $1" ;;
    esac
    shift
  done
  case "$reason" in pre-update|manual|scheduled) ;; *) die 2 "--reason pre-update|manual|scheduled requis" ;; esac
  if [ "$reason" = "scheduled" ]; then
    printf '%s' "$tiers" | grep -Eq '^(daily|weekly|monthly)(,(daily|weekly|monthly))*$' || die 2 "--tier daily,weekly,monthly requis pour un point planifié"
    printf '%s' "$sfor" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' || die 2 "--scheduled-for AAAA-MM-JJ requis pour un point planifié"
  else tiers=""; sfor=""; fi
  case "$level" in ""|full|quick) ;; *) die 2 "--verify full|quick" ;; esac
  printf '%s' "${from:-x}" | grep -Eq '^[0-9A-Za-z.+-]{1,40}$' || die 2 "--from-version invalide"
  [ -z "$to" ] || printf '%s' "$to" | grep -Eq '^[0-9A-Za-z.+-]{1,40}$' || die 2 "--to-version invalide"

  if [ "$DB_MODE" = "url" ]; then init_db
  else
    "${COMPOSE[@]}" ps >/dev/null 2>&1 || die 10 "docker compose ne répond pas."
    "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx db || die 10 "Le service db n'est pas démarré."
  fi
  take_lock
  trap 'release_lock' EXIT

  local db; db="$(db_name)" || die 10 "Nom de la base introuvable."
  [ -n "$db" ] || die 10 "Nom de la base introuvable."
  # Profil ha : une seule sauvegarde de la base partagée à la fois, et une seule sauvegarde planifiée par jour, tous hôtes confondus.
  scheduled_done_check "$sfor" "$db"
  lease_take "$db"
  if [ -z "$from" ]; then from="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)"; from="${from:-unknown}"; fi
  local stamp id dir; stamp="$(now_stamp)"; id="${stamp}-${reason}-${from}"
  # Deux points dans la même seconde auraient le même identifiant : on attend la seconde suivante plutôt que d'écraser.
  while [ -e "$(snapshot_dir "$id")" ] || [ -e "$(snapshot_dir "$id").invalid" ]; do sleep 1; stamp="$(now_stamp)"; id="${stamp}-${reason}-${from}"; done
  is_id "$id" || die 2 "Identifiant calculé invalide : $id"

  # Mesures et espace disque (avant tout fichier).
  local dbbytes docskb dbkb need free pgfree
  dbbytes="$(dbq "$db" 'SELECT pg_database_size(current_database())' | tr -d '[:space:]')"; dbbytes="${dbbytes:-0}"; dbkb=$(( dbbytes / 1024 ))
  if [ "$DOCS_STORAGE" = "s3" ]; then docskb=0   # documents dans le bucket : rien n'est copié localement
  elif [ -n "${ACRA_DOCUMENTS_DIR:-}" ]; then docskb="$(du -sk "$ACRA_DOCUMENTS_DIR" 2>/dev/null | cut -f1 | tr -d '[:space:]' || true)"
  else docskb="$("${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh app -c 'du -sk /app/.data/documents 2>/dev/null | cut -f1' 2>/dev/null | tr -d '[:space:]' || true)"; fi
  docskb="${docskb:-0}"
  need=$(( (dbkb * 6 / 10 + docskb) * 12 / 10 + 200 * 1024 ))
  free="$(free_kb "$BACKUP_DIR")"; free="${free:-0}"
  [ "$free" -ge "$need" ] || die 11 "Espace insuffisant dans $BACKUP_DIR : ${free} Ko libres, ${need} Ko nécessaires."
  # Base partagée (profil ha) : jamais de clone (CREATE DATABASE … TEMPLATE exige une base sans connexion ; restauration manuelle).
  [ "$PROFILE" != "ha" ] || clone=0
  if [ "$clone" -eq 1 ] && [ "$DB_MODE" = "compose" ]; then
    pgfree="$("${COMPOSE[@]}" exec -T db df -Pk /var/lib/postgresql/data 2>/dev/null | awk 'NR==2{print $4}')"; pgfree="${pgfree:-0}"
    if [ "$pgfree" -lt $(( dbkb * 13 / 10 + 500 * 1024 )) ]; then clone=0; note "Clone sauté : espace insuffisant sur le volume PostgreSQL."; fi
  fi
  if [ -z "$level" ]; then if [ $(( dbbytes / 1048576 )) -le "$FULL_MAX_MB" ]; then level=full; else level=quick; fi; fi

  # Connexions applicatives : refus pour une mise à jour (l'application doit être arrêtée), avertissement sinon.
  local conns; conns="$(dbq "$db" 'SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()' | tr -d '[:space:]')"
  if [ "${conns:-0}" -gt 0 ]; then
    if [ "$reason" = "pre-update" ] && [ "$PROFILE" != "ha" ]; then die 10 "$conns connexion(s) active(s) sur la base : arrêter l'application avant un point pre-update."
    else note "Avertissement : $conns connexion(s) active(s) ; le dump reste cohérent (transactionnel)."; fi
  fi

  dir="$(snapshot_dir "$id")"
  mkdir -p "$dir"; chmod 700 "$dir"
  : > "$dir/create.log"; chmod 600 "$dir/create.log"
  local cloneName=""
  C_DIR="$dir"; C_CLONE=""
  trap 'cleanup_create' ERR
  local before after counts
  before="$(row_counts "$db")"
  # Documents en S3 : clés référencées AVANT et APRÈS le dump (l'union couvre ce que le dump référence ; remplacée par la liste
  # exacte relue dans la base restaurée lors d'une vérification complète).
  local keys_before="" keys_after="" keys_at=""
  if [ "$DOCS_STORAGE" = "s3" ]; then
    keys_at="$(now_iso)"
    keys_before="$(doc_keys "$db" 2>>"$dir/create.log")" || { rm -rf "$dir"; trap - ERR; die 20 "Inventaire des documents référencés impossible (requête en échec)."; }
  fi

  # Dump (format custom), écrit sous un nom provisoire.
  note "Dump de la base ${db}…"
  if ! pg_dump_cmd "$db" > "$dir/database.dump.partial" 2>>"$dir/create.log"; then
    rm -rf "$dir"; trap - ERR; die 20 "Dump de la base en échec."
  fi
  [ -s "$dir/database.dump.partial" ] || { rm -rf "$dir"; trap - ERR; die 20 "Dump de la base vide."; }
  mv "$dir/database.dump.partial" "$dir/database.dump"
  after="$(row_counts "$db")"
  if [ "$DOCS_STORAGE" = "s3" ]; then
    keys_after="$(doc_keys "$db" 2>>"$dir/create.log")" || { rm -rf "$dir"; trap - ERR; die 20 "Inventaire des documents référencés impossible (requête en échec)."; }
    printf '%s\n%s\n' "$keys_before" "$keys_after" | sed '/^$/d' | LC_ALL=C sort -u > "$dir/documents-keys.txt"
  fi

  # Clone (non bloquant).
  if [ "$clone" -eq 1 ]; then
    cloneName="$(printf '%.40s__snap_%s' "$db" "$stamp")"; C_CLONE="$cloneName"
    if dbq postgres "CREATE DATABASE \"$cloneName\" TEMPLATE \"$db\" STRATEGY FILE_COPY" >>"$dir/create.log" 2>&1; then :; else
      note "Clone en échec (code 22, non bloquant) : le point reste utilisable depuis le dump."; cloneName=""; C_CLONE=""
    fi
  fi

  # Documents.
  local docsIncluded=false docsArchive="" docsBytes=0
  local docsOk=0
  if [ "$DOCS_STORAGE" = "s3" ]; then :   # documents dans le bucket versionné : aucune archive (§ 3.4)
  elif [ -n "${ACRA_DOCUMENTS_DIR:-}" ]; then
    # Installation sans Docker : documents sur le disque de l'hôte.
    [ -d "$ACRA_DOCUMENTS_DIR" ] && tar -czf "$dir/documents.tar.gz" -C "$(dirname "$ACRA_DOCUMENTS_DIR")" "$(basename "$ACRA_DOCUMENTS_DIR")" 2>>"$dir/create.log" && docsOk=1
  elif "${COMPOSE[@]}" run --rm --no-deps -T --entrypoint tar app -C /app/.data -czf - documents > "$dir/documents.tar.gz" 2>>"$dir/create.log"; then docsOk=1; fi
  if [ "$DOCS_STORAGE" = "s3" ]; then :
  elif [ "$docsOk" -eq 1 ] && gzip -t "$dir/documents.tar.gz" 2>/dev/null; then
    docsIncluded=true; docsArchive="documents.tar.gz"; docsBytes="$(file_size "$dir/documents.tar.gz")"
  else rm -f "$dir/documents.tar.gz"; fi

  # Chiffrement (exigence explicite : on ne dégrade pas en silence).
  local encrypted=false dumpfile="database.dump"
  if [ -n "${ACRA_BACKUP_AGE_RECIPIENT:-}" ]; then
    command -v age >/dev/null 2>&1 || { rm -rf "$dir"; trap - ERR; die 10 "ACRA_BACKUP_AGE_RECIPIENT défini mais « age » est introuvable."; }
    age -r "$ACRA_BACKUP_AGE_RECIPIENT" -o "$dir/database.dump.age" "$dir/database.dump" && rm -f "$dir/database.dump"
    if [ -f "$dir/documents.tar.gz" ]; then age -r "$ACRA_BACKUP_AGE_RECIPIENT" -o "$dir/documents.tar.gz.age" "$dir/documents.tar.gz" && rm -f "$dir/documents.tar.gz"; docsArchive="documents.tar.gz.age"; fi
    if [ -f "$dir/documents-keys.txt" ]; then age -r "$ACRA_BACKUP_AGE_RECIPIENT" -o "$dir/documents-keys.txt.age" "$dir/documents-keys.txt" && rm -f "$dir/documents-keys.txt"; fi
    encrypted=true; dumpfile="database.dump.age"
  fi
  write_sums "$dir"

  # Vérification (jamais sur un fichier chiffré : l'empreinte suffit, le test complet se fait avec `verify --full`).
  RESTORED_COUNTS=""; RESTORED_KEYS=""; RESTORED_KEYS_OK=0; M_FULL_IMPOSSIBLE=0
  if [ "$encrypted" = "false" ]; then
    if ! verify_quick "$dir"; then mv "$dir" "$dir.invalid"; trap - ERR; release_lock; die 21 "Vérification rapide en échec : point marqué invalide."; fi
    if [ "$level" = "full" ]; then
      local vr=0; verify_full "$dir" "$db" "$before" "$after" || vr=$?
      if [ "$vr" -eq 2 ] && [ "$PROFILE" = "ha" ]; then
        # Base partagée : la base jetable n'a pas pu être créée (droits de l'hébergeur). Le point reste valide (vérification
        # rapide réussie), l'impossibilité est consignée au manifeste et signalée.
        level=quick; M_FULL_IMPOSSIBLE=1
        note "Vérification complète impossible : le serveur refuse de créer une base jetable. Définir ACRA_BACKUP_VERIFY_DATABASE_URL (serveur de contrôle dédié) ; point conservé avec une vérification rapide."
      elif [ "$vr" -ne 0 ]; then mv "$dir" "$dir.invalid"; trap - ERR; release_lock; die 21 "Vérification complète en échec : point marqué invalide."
      elif [ "$DOCS_STORAGE" = "s3" ] && [ "$RESTORED_KEYS_OK" = "1" ]; then
        printf '%s\n' "$RESTORED_KEYS" | sed '/^$/d' | LC_ALL=C sort -u > "$dir/documents-keys.txt"; write_sums "$dir"
      fi
    fi
  else
    check_sums "$dir" || { mv "$dir" "$dir.invalid"; trap - ERR; release_lock; die 21 "Empreintes invalides."; }
  fi

  # Métadonnées du manifeste.
  counts="$after"
  M_TIERS="$tiers"; M_SFOR="$sfor"
  M_ID="$id"; M_REASON="$reason"; M_CREATED="$(now_iso)"; M_VERSION="$from"
  M_REVISION="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  if [ -n "${ACRA_IMAGE:-}" ]; then M_IMAGE="\"$(json_escape "${ACRA_IMAGE}")\""; else M_IMAGE=null; fi
  if [ -n "${ACRA_CHANNEL:-}" ]; then M_CHANNEL="\"$(json_escape "$ACRA_CHANNEL")\""; else M_CHANNEL=null; fi
  if [ -n "$to" ]; then M_TOVERSION="\"$to\""; else M_TOVERSION=null; fi
  M_SERVER="$(dbq "$db" 'SHOW server_version' | tr -d '[:space:]' | cut -c1-20)"
  M_DB="$db"; M_DBBYTES="$dbbytes"; M_DUMPFILE="$dumpfile"; M_DUMPBYTES="$(file_size "$dir/$dumpfile")"; M_ENCRYPTED="$encrypted"
  if [ -n "$cloneName" ]; then M_CLONE="\"$cloneName\""; else M_CLONE=null; fi
  M_MIGCOUNT="$(count_of "$counts" _prisma_migrations)"
  M_MIGLAST="$(dbq "$db" 'SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name DESC LIMIT 1' 2>/dev/null | tr -d '[:space:]' | cut -c1-120 || true)"
  M_MIGHASH="$(dbq "$db" 'SELECT migration_name||checksum FROM "_prisma_migrations" ORDER BY migration_name' 2>/dev/null | { if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi; } | cut -d' ' -f1 || true)"
  M_COUNTS="$counts"; M_DOCS_INCLUDED="$docsIncluded"; M_DOCS_ARCHIVE="$docsArchive"; M_DOCS_BYTES="$docsBytes"
  if [ -n "${ACRA_DOCUMENTS_DIR:-}" ]; then M_DOCS_FILES="$(find "$ACRA_DOCUMENTS_DIR" -type f 2>/dev/null | wc -l | tr -d '[:space:]' || true)"
  else M_DOCS_FILES="$("${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh app -c 'find /app/.data/documents -type f 2>/dev/null | wc -l' 2>/dev/null | tr -d '[:space:]' || true)"; fi
  M_DOCS_FILES="${M_DOCS_FILES:-0}"
  local key=""; [ -f .env ] && key="$(sed -n 's/^SECRETS_ENCRYPTION_KEY=//p' .env | head -1 | tr -d '"'"'"'\r')"
  if [ -n "$key" ]; then M_FINGERPRINT="\"$(sha256_str "$key" | cut -c1-12)\""; else M_FINGERPRINT=null; fi
  M_LEVEL="$level"
  if [ "$DOCS_STORAGE" = "s3" ]; then
    if [ -f "$dir/documents-keys.txt.age" ]; then M_KEYS_FILE="documents-keys.txt.age"; else M_KEYS_FILE="documents-keys.txt"; fi
    # Nombre et empreinte calculés sur la liste en clair (avant chiffrement, ou relue).
    local klist; if [ "$RESTORED_KEYS_OK" = "1" ]; then klist="$(cat "$dir/documents-keys.txt")"; M_KEYS_SOURCE=dump
    else klist="$(printf '%s\n%s\n' "$keys_before" "$keys_after" | sed '/^$/d' | LC_ALL=C sort -u)"; M_KEYS_SOURCE=live; fi
    if [ -n "$klist" ]; then M_KEYS_COUNT="$(printf '%s\n' "$klist" | wc -l | tr -d '[:space:]')"; M_KEYS_SHA="$(sha256_str "$klist
")"
    else M_KEYS_COUNT=0; M_KEYS_SHA="$(sha256_str "")"; fi
    M_KEYS_AT="$keys_at"
    M_BUCKET_CHECK="$(bucket_check)"
    case "$M_BUCKET_CHECK" in
      ok) ;;
      ecart) note "⚠ Écart base ↔ bucket : des documents référencés par la base sont absents du stockage S3. Voir Administration → Tâches planifiées (« coherence-documents ») ; restaurer les versions d'objets (docs/deploiement-haute-disponibilite.md § 3.4)." ;;
      *) note "Contrôle de présence des documents dans le bucket non exécuté (application injoignable ou CRON_SECRET absent) : le relancer depuis Administration → Tâches planifiées." ;;
    esac
  fi
  write_manifest "$dir"
  trap - ERR
  cmd_index
  [ "$reason" != "scheduled" ] || scheduled_done_mark "$sfor" "$db"

  [ -z "${ACRA_SNAPSHOT_HOOK:-}" ] || "$ACRA_SNAPSHOT_HOOK" "$id" >>"$dir/create.log" 2>&1 || note "Crochet ACRA_SNAPSHOT_HOOK en échec (non bloquant)."
  if [ -n "${ACRA_OFFSITE_DRIVER:-}" ]; then
    # Sauvegarde externe vérifiée (scripts/acra-offsite.sh) : un échec est publié mais ne fait jamais échouer le point.
    ACRA_BACKUP_DIR="$BACKUP_DIR" ACRA_ROOT="$PWD" bash "$(dirname "$0")/acra-offsite.sh" push "$id" >>"$dir/create.log" 2>&1 || note "Envoi hors site en échec (non bloquant) : voir scripts/acra-offsite.sh status."
  elif [ -n "${ACRA_SNAPSHOT_OFFSITE_CMD:-}" ]; then
    # shellcheck disable=SC2086
    $ACRA_SNAPSHOT_OFFSITE_CMD "$dir" >>"$dir/create.log" 2>&1 || note "Copie hors site en échec (non bloquant)."
  fi
  release_lock; trap - EXIT
  if [ "$json" -eq 1 ]; then cat "$dir/manifest.json"; else printf '%s\n' "$id"; fi
}

# ── verify ────────────────────────────────────────────────────────────────────────────────────────
cmd_verify() {
  local id="${1:-}" full=0
  [ $# -gt 0 ] && shift
  while [ $# -gt 0 ]; do case "$1" in --full) full=1 ;; *) die 2 "Option inconnue : $1" ;; esac; shift; done
  is_id "$id" || die 31 "Identifiant invalide."
  local dir; dir="$(snapshot_dir "$id")"
  [ -f "$dir/manifest.json" ] || die 31 "Point de restauration inconnu : $id"
  init_db
  verify_quick "$dir" || die 21 "Vérification rapide en échec."
  if [ "$full" -eq 1 ]; then
    [ "$(mget "$dir/manifest.json" encrypted)" != "true" ] || die 21 "Vérification complète d'un point chiffré : déchiffrer d'abord."
    local db; db="$(db_name)"
    verify_full "$dir" "$db" "$(sed -n 's/^[[:space:]]*"\([A-Za-z_]*\)":[[:space:]]*\([0-9]*\),\{0,1\}$/\1=\2/p' "$dir/manifest.json" | tr '\n' ' ')" "" || die 21 "Vérification complète en échec."
  fi
  echo "OK $id"
}

# ── list ──────────────────────────────────────────────────────────────────────────────────────────
cmd_list() {
  local json=0 d id
  [ "${1:-}" != "--json" ] || json=1
  if [ "$json" -eq 1 ]; then cmd_index; cat "$UPDATE_DIR/snapshots.json"; return 0; fi
  for d in "$BACKUP_DIR"/*/; do
    [ -f "${d}manifest.json" ] || continue
    id="$(basename "$d")"; is_id "$id" || continue
    printf '%s\t%s\t%s\t%s\n' "$id" "$(mget "${d}manifest.json" createdAt)" "$(mget "${d}manifest.json" version)" "$(mget "${d}manifest.json" level)"
  done
}

# ── restore ───────────────────────────────────────────────────────────────────────────────────────
cmd_restore() {
  local id="${1:-}" yes=0 keep=0 ts db dir cur
  [ $# -gt 0 ] && shift
  while [ $# -gt 0 ]; do case "$1" in --yes) yes=1 ;; --keep-current) keep=1 ;; *) die 2 "Option inconnue : $1" ;; esac; shift; done
  is_id "$id" || die 31 "Identifiant invalide."
  dir="$(snapshot_dir "$id")"
  [ -f "$dir/manifest.json" ] || die 31 "Point de restauration inconnu : $id"
  # Base partagée (profil ha) : jamais de restauration automatique. L'intégrité exige une procédure (arrêt des écritures,
  # restauration dans une base NEUVE, contrôle, bascule de DATABASE_URL) : scripts/acra-restore-ha.sh et guide HA § 3.4.
  [ "$PROFILE" != "ha" ] || die 33 "Profil ha : restauration automatique refusée sur la base partagée. Procédure : scripts/acra-restore-ha.sh database $id --target-url <base neuve> (docs/deploiement-haute-disponibilite.md § 3.4)."
  init_db
  take_lock; trap 'release_lock' EXIT
  check_sums "$dir" || die 21 "Empreintes SHA-256 invalides : point corrompu."

  local want have key=""; want="$(mget "$dir/manifest.json" secretsKeyFingerprint)"
  [ -f .env ] && key="$(sed -n 's/^SECRETS_ENCRYPTION_KEY=//p' .env | head -1 | tr -d '"'"'"'\r')"
  if [ -n "$key" ]; then have="$(sha256_str "$key" | cut -c1-12)"; else have=""; fi
  if [ -n "$want" ] && [ "$want" != "null" ] && [ "$want" != "$have" ] && [ "$yes" -ne 1 ]; then
    die 32 "La clé de chiffrement des secrets a changé depuis ce point : les secrets stockés (SMTP, SSO, SIEM, jetons) seront illisibles. Relancer avec --yes pour continuer."
  fi

  db="$(db_name)"; [ -n "$db" ] || die 10 "Nom de la base introuvable."
  local created later; created="$(mget "$dir/manifest.json" createdAt)"
  later="$(dbq "$db" "SELECT count(*) FROM \"AuditLog\" WHERE \"createdAt\" > '$created'" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ "$yes" -ne 1 ]; then
    echo "Restauration du point $id (version $(mget "$dir/manifest.json" version), $created). ${later:-?} entrée(s) du journal d'audit postérieure(s) seront perdues."
    read -r -p "Continuer ? [o/N] " ans; case "$ans" in o|O|y|Y) ;; *) die 2 "Annulé." ;; esac
  fi

  ts="$(now_stamp)"; local failed; failed="$(printf '%.40s__failed_%s' "$db" "$ts")"
  : >> "$dir/restore.log"; chmod 600 "$dir/restore.log"
  # shellcheck disable=SC2046
  "${COMPOSE[@]}" stop $(existing_services app scheduler backup cron | tr '\n' ' ') >>"$dir/restore.log" 2>&1 || true
  dbq postgres "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db' AND pid <> pg_backend_pid()" >>"$dir/restore.log" 2>&1 || true
  dbq postgres "ALTER DATABASE \"$db\" RENAME TO \"$failed\"" >>"$dir/restore.log" 2>&1 || die 30 "Impossible de conserver la base courante (renommage en échec)."
  [ "$keep" -ne 1 ] || : > "$dir/keep"

  rollback_rename() { dbq postgres "DROP DATABASE IF EXISTS \"$db\"" >/dev/null 2>&1 || true; dbq postgres "ALTER DATABASE \"$failed\" RENAME TO \"$db\"" >>"$dir/restore.log" 2>&1 || true; }
  local clone; clone="$(mget "$dir/manifest.json" clone)"; local used_clone=0
  if [ -n "$clone" ] && [ "$clone" != "null" ] && [ "$(dbq postgres "SELECT 1 FROM pg_database WHERE datname = '$clone'" | tr -d '[:space:]')" = "1" ]; then
    dbq postgres "ALTER DATABASE \"$clone\" RENAME TO \"$db\"" >>"$dir/restore.log" 2>&1 && used_clone=1
  fi
  if [ "$used_clone" -eq 0 ]; then
    dbq postgres "CREATE DATABASE \"$db\"" >>"$dir/restore.log" 2>&1 || { rollback_rename; die 30 "Création de la base en échec (base précédente remise en place)."; }
    local dumpfile; dumpfile="$(mget "$dir/manifest.json" dumpFile)"
    if [ "$dumpfile" = "database.dump.age" ]; then
      [ -n "${ACRA_BACKUP_AGE_IDENTITY:-}" ] || { rollback_rename; die 10 "Point chiffré : ACRA_BACKUP_AGE_IDENTITY requis."; }
      age -d -i "$ACRA_BACKUP_AGE_IDENTITY" "$dir/database.dump.age" | pg_restore_cmd "$db" >>"$dir/restore.log" 2>&1 || { rollback_rename; die 30 "Restauration du dump en échec (base précédente remise en place)."; }
    else
      pg_restore_cmd "$db" < "$dir/database.dump" >>"$dir/restore.log" 2>&1 || { rollback_rename; die 30 "Restauration du dump en échec (base précédente remise en place)."; }
    fi
  fi

  # Contrôle : comptes == manifeste (tables non nulles).
  local counts t exp got bad=0; counts="$(row_counts "$db")"
  for t in $COUNTED_TABLES; do
    exp="$(sed -n "s/^[[:space:]]*\"$t\":[[:space:]]*\([0-9]*\),\{0,1\}\$/\1/p" "$dir/manifest.json" | head -1)"
    [ -n "$exp" ] || continue
    got="$(count_of "$counts" "$t")"
    [ "$got" = "$exp" ] || { bad=1; echo "Écart $t : attendu $exp, obtenu ${got:-?}" >>"$dir/restore.log"; }
  done
  if [ "$bad" -eq 1 ]; then rollback_rename; die 30 "Les comptes de lignes restaurés divergent du manifeste : base précédente remise en place."; fi

  # Le clone est consommé : le point garde son dump.
  if [ "$used_clone" -eq 1 ]; then sed -i.bak "s/\"clone\": \"[^\"]*\"/\"clone\": null/" "$dir/manifest.json" && rm -f "$dir/manifest.json.bak"; fi

  # Documents.
  if [ "$(mget "$dir/manifest.json" included)" = "true" ]; then
    local arc; arc="$(mget "$dir/manifest.json" archive)"
    if [ -f "$dir/$arc" ] && [ -n "${ACRA_DOCUMENTS_DIR:-}" ]; then
      mkdir -p "$ACRA_DOCUMENTS_DIR" && find "$ACRA_DOCUMENTS_DIR" -mindepth 1 -delete 2>/dev/null; tar -xzf "$dir/$arc" -C "$(dirname "$ACRA_DOCUMENTS_DIR")" >>"$dir/restore.log" 2>&1 || note "Avertissement : restauration des documents en échec (voir restore.log)."
    elif [ -f "$dir/$arc" ]; then
      "${COMPOSE[@]}" run --rm --no-deps -T -u 0 --entrypoint sh app -c 'rm -rf /app/.data/documents/* && tar -xzf - -C /app/.data && chown -R 1001:1001 /app/.data/documents' < "$dir/$arc" >>"$dir/restore.log" 2>&1 || note "Avertissement : restauration des documents en échec (voir restore.log)."
    fi
  fi
  mkdir -p "$UPDATE_DIR"; printf 'RESTORED %s %s\n' "$id" "$(now_iso)" >> "$UPDATE_DIR/events.log"; chmod 644 "$UPDATE_DIR/events.log" 2>/dev/null || true
  cmd_index
  echo "Restauré : $id (base courante conservée sous $failed)."
}

# ── prune ─────────────────────────────────────────────────────────────────────────────────────────
cmd_prune() {
  local dry=0 includeManual=0 ids=""
  while [ $# -gt 0 ]; do
    case "$1" in --keep) KEEP="${2:-3}"; shift ;; --dry-run) dry=1 ;; --include-manual) includeManual=1 ;; --ids) ids="${2:-}"; shift ;; *) die 2 "Option inconnue : $1" ;; esac; shift
  done
  # --ids : liste EXACTE (libération d'espace) — chaque identifiant est validé AVANT tout appel à docker.
  if [ "${ids+x}" = x ] && [ -n "$ids" ]; then
    local one; for one in ${ids//,/ }; do is_id "$one" || die 31 "Identifiant de point invalide : $one"; done
  fi
  init_db
  take_lock; trap 'release_lock' EXIT
  local protect=""
  [ -f "$UPDATE_DIR/run/current.json" ] && protect="$(sed -n 's/.*"snapshotId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$UPDATE_DIR/run/current.json" | head -1)"
  act() { if [ "$dry" -eq 1 ]; then echo "[dry-run] supprimerait : $1"; else eval "$2"; echo "supprimé : $1"; fi; }
  local d id n=0 now_s; now_s="$(date +%s)"
  if [ -n "$ids" ]; then
    # Suppression ciblée : seuls les identifiants donnés, existants, complets et non protégés ; jamais de règle de rétention.
    for id in ${ids//,/ }; do
      d="$BACKUP_DIR/$id"; [ -f "$d/manifest.json" ] || continue
      [ "$id" != "$protect" ] || { note "Point protégé (mise à jour en cours) conservé : $id"; continue; }
      act "$id" "rm -rf '$d'"
    done
  else
  # .invalid et dossiers incomplets de plus de 24 h
  for d in "$BACKUP_DIR"/*/; do
    [ -d "$d" ] || continue; id="$(basename "$d")"
    case "$id" in .lock) continue ;; esac
    case "$id" in *.invalid) act "$id" "rm -rf '${d%/}'"; continue ;; esac
    if [ ! -f "${d}manifest.json" ]; then
      local mt; mt="$(stat -c %Y "${d%/}" 2>/dev/null || stat -f %m "${d%/}")"
      [ $(( now_s - mt )) -gt 86400 ] && act "$id (incomplet)" "rm -rf '${d%/}'"
    fi
  done
  # Points planifiés : politique grand-père/père/fils — chaque fréquence garde ses N copies les plus récentes
  # (N lu dans .acra-update/backup-policy.json, 3 par défaut) ; un point sans fréquence retenue est supprimé.
  pol_keep() { local v; v="$(sed -n "s/^[[:space:]]*\"$1\":[[:space:]]*{.*\"keep\":[[:space:]]*\([0-9][0-9]*\).*/\1/p" "$UPDATE_DIR/backup-policy.json" 2>/dev/null | head -1)"; printf '%s' "${v:-3}"; }
  local keepset="" tier cnt kn tl
  for tier in daily weekly monthly; do
    kn="$(pol_keep "$tier")"; cnt=0
    for id in $(ls -1 "$BACKUP_DIR" 2>/dev/null | sort -r); do
      is_id "$id" || continue; case "$id" in *-scheduled-*) ;; *) continue ;; esac
      [ -f "$BACKUP_DIR/$id/manifest.json" ] || continue
      tl="$(mget_list "$BACKUP_DIR/$id/manifest.json" tiers)"
      case ",$tl," in *",$tier,"*) cnt=$(( cnt + 1 )); [ "$cnt" -gt "$kn" ] || keepset="$keepset
$id" ;; esac
    done
  done
  for id in $(ls -1 "$BACKUP_DIR" 2>/dev/null | sort -r); do
    is_id "$id" || continue; case "$id" in *-scheduled-*) ;; *) continue ;; esac
    d="$BACKUP_DIR/$id"; [ -f "$d/manifest.json" ] || continue
    [ "$id" != "$protect" ] || continue; [ ! -f "$d/keep" ] || continue
    printf '%s\n' "$keepset" | grep -qx "$id" || act "$id" "rm -rf '$d'"
  done
  # pre-update : garder les KEEP derniers valides + le point protégé ; manual : jamais (sauf --include-manual)
  for id in $(ls -1 "$BACKUP_DIR" 2>/dev/null | sort -r); do
    is_id "$id" || continue
    d="$BACKUP_DIR/$id"; [ -f "$d/manifest.json" ] || continue
    [ "$id" != "$protect" ] || continue
    [ ! -f "$d/keep" ] || continue
    case "$id" in
      *-pre-update-*) n=$(( n + 1 )); [ "$n" -gt "$KEEP" ] && act "$id" "rm -rf '$d'" ;;
      *-manual-*) [ "$includeManual" -eq 1 ] && act "$id" "rm -rf '$d'" ;;
    esac
  done
  fi
  # Bases techniques : clones orphelins, __failed_ trop anciens, __verify_ orphelines.
  local db; db="$(db_name 2>/dev/null || true)"
  if [ -n "$db" ]; then
    local name
    for name in $(dbq postgres "SELECT datname FROM pg_database WHERE datname LIKE '${db}\\_\\_%'" 2>/dev/null | tr -d '\r'); do
      case "$name" in
        *__snap_*) local sid; sid="$(ls -1 "$BACKUP_DIR" 2>/dev/null | while read -r x; do [ "$(mget "$BACKUP_DIR/$x/manifest.json" clone 2>/dev/null)" = "$name" ] && echo "$x"; done | head -1)"
                   [ -n "$sid" ] || act "base $name (clone orphelin)" "dbq postgres 'DROP DATABASE IF EXISTS \"$name\"' >/dev/null" ;;
        *__failed_*) local fts fsec; fts="${name##*__failed_}"; fsec="$(date -u -d "${fts:0:4}-${fts:4:2}-${fts:6:2}" +%s 2>/dev/null || date -j -u -f %Y%m%d "${fts:0:8}" +%s 2>/dev/null || echo "$now_s")"
                     [ $(( (now_s - fsec) / 86400 )) -ge "$FAILED_RETENTION_DAYS" ] && act "base $name (ancienne)" "dbq postgres 'DROP DATABASE IF EXISTS \"$name\"' >/dev/null" ;;
        *__verify_*) act "base $name (vérification orpheline)" "dbq postgres 'DROP DATABASE IF EXISTS \"$name\"' >/dev/null" ;;
      esac
    done
  fi
  [ "$dry" -eq 1 ] || cmd_index
}

CMD="${1:-}"; [ $# -gt 0 ] && shift
case "$CMD" in
  create) cmd_create "$@" ;;
  verify) cmd_verify "$@" ;;
  list) cmd_list "$@" ;;
  restore) cmd_restore "$@" ;;
  prune) cmd_prune "$@" ;;
  index) cmd_index ;;
  *) die 2 "Usage : acra-snapshot.sh create|verify|list|restore|prune|index (voir l'en-tête du script)" ;;
esac
