#!/usr/bin/env bash
# ─── Mise à jour PROGRESSIVE d'une instance ACRA multi-instance (profil « ha ») — lot H1.4 ─────────────────────────────
# docs/specs/scalabilite-haute-disponibilite.md § 4 H1.4 et § 5 (intégrité avant disponibilité) ;
# procédure et limites : docs/deploiement-haute-disponibilite.md, section « Mise à jour sans interruption ».
#
# Usage : scripts/update-ha.sh [stable|beta] (--pitr-confirmed | --backup-cmd "<commande>") [--yes] [--allow-contract]
#                              [--replicas N]
#   --backup-cmd CMD   sauvegarde de la base EXTERNE lancée avant toute modification (ex. « pgbackrest --stanza=acra
#                      backup --type=full », ou la CLI de l'hébergeur) ; échec ⇒ rien n'est modifié. Variable : ACRA_HA_BACKUP_CMD.
#   --pitr-confirmed   l'exploitant atteste qu'une restauration à un instant donné (PITR) est active et vérifiée ; l'instant
#                      précédant la migration est journalisé comme cible de restauration. L'un des deux est OBLIGATOIRE.
#   --allow-contract   accepte une migration « contract » (marque `-- contract:` ou `-- acra:destructive`) entre la version
#                      installée et la cible : sans cette option, refus (l'ancienne version, encore en service pendant le
#                      remplacement, lit peut-être ce qui est supprimé — cas d'une montée qui saute une version).
#   --replicas N       nombre de réplicas visé (défaut : nombre de réplicas en service).
# Variables : ACRA_COMPOSE_FILES (défaut : les trois fichiers du profil « ha »), ACRA_REMOTE (origin),
#             ACRA_HEALTH_RETRIES (60), ACRA_HEALTH_INTERVAL (5 s), ACRA_HA_DRAIN_SECONDS (12 s), ACRA_HA_STOP_TIMEOUT (30 s).
#
# Déroulé : PRECHECK → BACKUP → FETCH → BUILD → MIGRATE (une seule fois, service migrator) → ROLL → FINALIZE.
# ROLL : pour chaque réplica, `docker compose up -d --no-deps --no-build --no-recreate --scale app=<n+1> app` démarre UN
# conteneur de la nouvelle image à côté des anciens (--no-recreate : les anciens ne sont pas recréés) ; on attend que SON
# /api/health?deep=1 réponde « ok » avec la révision cible ; puis un ancien est DRAINÉ (fichier /tmp/acra-drain ⇒ /api/health
# en 503, Caddy cesse de lui envoyer des requêtes), arrêté proprement (SIGTERM : requêtes en cours terminées) et supprimé.
# Échec de santé ⇒ le conteneur fautif est supprimé et les réplicas déjà remplacés reviennent à l'ancienne image, de la
# même façon (un par un). La base n'est JAMAIS restaurée automatiquement : des écritures ont pu être faites entre-temps par
# les réplicas en service ; la restauration (PITR) est une décision de l'exploitant (runbook).
# Journal : .acra-update/ha/last.json ; événements : .acra-update/events.log ; version en service : .acra-update/ha/version.env.
set -euo pipefail
umask 077

# Le lanceur se copie et se ré-exécute depuis la copie : jamais de lecture d'un script que `git merge` remplace.
if [ "${ACRA_UPDATE_HA_REEXEC:-0}" != "1" ]; then
  ACRA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"; export ACRA_ROOT
  TMPDIR_RUN="$(mktemp -d "${TMPDIR:-/tmp}/acra-update-ha.XXXXXX")"; export TMPDIR_RUN
  cp "$0" "$TMPDIR_RUN/update-ha.sh"
  ACRA_UPDATE_HA_REEXEC=1 exec bash "$TMPDIR_RUN/update-ha.sh" "$@"
fi
cd "$ACRA_ROOT"
TMPDIR_RUN="${TMPDIR_RUN:-$(mktemp -d "${TMPDIR:-/tmp}/acra-update-ha.XXXXXX")}"

CHANNEL=stable; YES=0; PITR=0; BACKUP_CMD="${ACRA_HA_BACKUP_CMD:-}"; ALLOW_CONTRACT=0; REPLICAS=""
case "${1:-}" in
  stable|beta) CHANNEL="$1"; shift ;;
  ""|--*) ;;
  *) echo "Canal inconnu : $1 (attendu : stable | beta)" >&2; exit 2 ;;
esac
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) YES=1 ;;
    --pitr-confirmed) PITR=1 ;;
    --backup-cmd) BACKUP_CMD="${2:-}"; shift ;;
    --allow-contract) ALLOW_CONTRACT=1 ;;
    --replicas) REPLICAS="${2:-}"; shift ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done
case "$CHANNEL" in stable) BRANCH=stable ;; *) BRANCH=main ;; esac
[ -z "$REPLICAS" ] || printf '%s' "$REPLICAS" | grep -Eq '^[1-9][0-9]?$' || { echo "--replicas : entier de 1 à 99 attendu." >&2; exit 2; }
REMOTE="${ACRA_REMOTE:-origin}"
ACRA_COMPOSE_FILES="${ACRA_COMPOSE_FILES:--f docker-compose.yml -f docker-compose.production.yml -f docker-compose.ha.yml}"
# shellcheck disable=SC2206
COMPOSE=(docker compose $ACRA_COMPOSE_FILES)
HEALTH_RETRIES="${ACRA_HEALTH_RETRIES:-60}"; HEALTH_INTERVAL="${ACRA_HEALTH_INTERVAL:-5}"
DRAIN_SECONDS="${ACRA_HA_DRAIN_SECONDS:-12}"; STOP_TIMEOUT="${ACRA_HA_STOP_TIMEOUT:-30}"
ROLLBACK_TAG="acra-app:ha-rollback"

git() { command git -c safe.directory="$PWD" "$@"; }
iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }
pkg_version() { sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' | head -1; }
quiet() { if [ "${ACRA_UPDATE_VERBOSE:-0}" = "1" ]; then "$@"; else "$@" >/dev/null 2>&1; fi; }

# ── Journal ──────────────────────────────────────────────────────────────────────────────────────────
HA_DIR=".acra-update/ha"; JOURNAL="$HA_DIR/last.json"
mkdir -p "$HA_DIR"; chmod 755 .acra-update 2>/dev/null || true
STATE=PRECHECK; CODE=""; FROM=""; FROM_SHA=""; TO=""; TO_SHA=""; RP_KIND=""; RP_AT=""; STARTED="$(iso)"; MSG=""
jesc() { printf '%s' "$1" | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g'; }
journal() { # état [code] [message]
  STATE="$1"; CODE="${2:-}"; MSG="${3:-}"
  local codej=null; [ -z "$CODE" ] || codej="\"$CODE\""
  printf '{\n  "schema": 1,\n  "kind": "ha-update",\n  "channel": "%s",\n  "from": { "version": "%s", "sha": "%s" },\n  "to": { "version": "%s", "sha": "%s" },\n  "restorePoint": { "kind": "%s", "at": "%s" },\n  "state": "%s",\n  "code": %s,\n  "message": "%s",\n  "startedAt": "%s",\n  "updatedAt": "%s"\n}\n' \
    "$CHANNEL" "$FROM" "$FROM_SHA" "$TO" "$TO_SHA" "$RP_KIND" "$RP_AT" "$STATE" "$codej" "$(jesc "$MSG")" "$STARTED" "$(iso)" > "$JOURNAL.tmp"
  chmod 644 "$JOURNAL.tmp"; mv "$JOURNAL.tmp" "$JOURNAL"
}
event() { printf '%s\n' "$*" >> .acra-update/events.log; chmod 644 .acra-update/events.log 2>/dev/null || true; }
fail() { # code message — échec SANS changement des réplicas en service
  echo "✗ $2" >&2; journal FAILED "$1" "$2"; exit 1
}

# ── Verrou : une seule mise à jour à la fois (y compris scripts/update.sh) ─────────────────────────
LOCK="$HA_DIR/lock"
take_lock() {
  local p
  p="$(cat .acra-update/run/lock/pid 2>/dev/null || true)"
  if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then return 1; fi
  if mkdir "$LOCK" 2>/dev/null; then echo "$$" > "$LOCK/pid"; return 0; fi
  p="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then return 1; fi
  rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null && echo "$$" > "$LOCK/pid"
}
take_lock || { echo "✗ Une mise à jour est déjà en cours." >&2; exit 40; }
trap 'rm -rf "$LOCK" "$TMPDIR_RUN"' EXIT

# ── Conteneurs du service app ────────────────────────────────────────────────────────────────────────
app_containers() { "${COMPOSE[@]}" ps -a -q app 2>/dev/null | sed '/^$/d'; }
c_image() { docker inspect --format '{{.Image}}' "$1" 2>/dev/null; }
c_running() { [ "$(docker inspect --format '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }
c_health() { docker exec "$1" wget -q -O - 'http://127.0.0.1:3000/api/health?deep=1' 2>/dev/null || true; }
health_ok() { # sortie révision
  printf '%s' "$1" | grep -q "\"revision\":\"$2\"" && printf '%s' "$1" | grep -q '"status":"ok"' || return 1
  # Santé approfondie : aucune migration en attente ni en échec pour CETTE image.
  ! printf '%s' "$1" | grep -q '"migrations"' || { printf '%s' "$1" | grep -q '"pending":\[\]' && printf '%s' "$1" | grep -q '"failed":\[\]'; }
}
wait_container_health() { # conteneur révision
  local i out=""
  for (( i = 0; i < HEALTH_RETRIES; i++ )); do
    out="$(c_health "$1")"
    if health_ok "$out" "$2"; then return 0; fi
    sleep "$HEALTH_INTERVAL"
  done
  echo "✗ Réplica ${1:0:12} non sain (révision attendue : $2 ; dernière réponse : ${out:0:300})" >&2
  return 1
}
remove_container() { docker stop -t "$STOP_TIMEOUT" "$1" >/dev/null 2>&1 || true; docker rm -f "$1" >/dev/null 2>&1 || true; }
drain_and_remove() { # conteneur : plus de nouvelles requêtes (santé 503), puis arrêt propre (SIGTERM)
  docker exec "$1" touch /tmp/acra-drain >/dev/null 2>&1 || true
  sleep "$DRAIN_SECONDS"
  remove_container "$1"
}

# Remplace, un par un, tout réplica dont l'image n'est pas `cible` : démarrer un réplica cible, attendre sa santé, retirer
# un ancien. Retour 1 dès qu'un réplica cible n'est pas sain (il est supprimé ; les autres restent en service).
roll_to() { # id_image_cible révision nombre
  local target="$1" rev="$2" n="$3" guard=0 limit="" c before after new olds news
  while :; do
    olds=(); news=()
    for c in $(app_containers); do
      if [ "$(c_image "$c")" = "$target" ]; then news+=("$c"); else olds+=("$c"); fi
    done
    if [ "${#olds[@]}" -eq 0 ] && [ "${#news[@]}" -ge "$n" ]; then return 0; fi
    # Borne de sûreté : au plus un ajout et un retrait par itération.
    [ -n "$limit" ] || limit=$(( 2 * (n + ${#olds[@]} + ${#news[@]}) + 4 ))
    guard=$(( guard + 1 )); [ "$guard" -le "$limit" ] || { echo "✗ Remplacement des réplicas : nombre d'itérations dépassé." >&2; return 1; }
    if [ "${#news[@]}" -lt "$n" ]; then
      before="$(app_containers)"
      if ! quiet "${COMPOSE[@]}" up -d --no-deps --no-build --no-recreate --scale "app=$(( ${#olds[@]} + ${#news[@]} + 1 ))" app; then
        echo "✗ Démarrage d'un réplica impossible (docker compose up --scale)." >&2; return 1
      fi
      after="$(app_containers)"
      new="$(printf '%s\n' "$after" | grep -vxF -f <(printf '%s\n' "$before") || true)"
      if [ -z "$new" ] || [ "$(printf '%s\n' "$new" | wc -l | tr -d ' ')" -ne 1 ]; then
        echo "✗ Réplica démarré introuvable (attendu : exactement un nouveau conteneur)." >&2
        for c in $new; do remove_container "$c"; done
        return 1
      fi
      if [ "$(c_image "$new")" != "$target" ]; then
        echo "✗ Le réplica démarré n'utilise pas l'image attendue." >&2; remove_container "$new"; return 1
      fi
      echo "  + réplica ${new:0:12} démarré ; contrôle de santé…"
      if ! wait_container_health "$new" "$rev"; then remove_container "$new"; return 1; fi
      echo "  ✓ réplica ${new:0:12} sain"
    fi
    if [ "${#olds[@]}" -gt 0 ]; then
      echo "  − retrait du réplica ${olds[0]:0:12} (drainage ${DRAIN_SECONDS} s puis arrêt)"
      drain_and_remove "${olds[0]}"
    fi
  done
}

# ── PRECHECK ─────────────────────────────────────────────────────────────────────────────────────────
journal PRECHECK
case " $ACRA_COMPOSE_FILES " in *docker-compose.ha.yml*) ;; *) fail precheck_not_ha "ACRA_COMPOSE_FILES n'inclut pas docker-compose.ha.yml : pour une instance mono-instance, utiliser scripts/update.sh." ;; esac
CV="$(docker compose version --short 2>/dev/null | sed 's/^v//')"
[ -n "$CV" ] && [ "$(printf '%s\n%s\n' 2.24.4 "$CV" | sort -V | head -1)" = "2.24.4" ] || fail precheck_compose "Docker Compose >= 2.24.4 requis (trouvé : ${CV:-absent})."
if [ "$PITR" -eq 0 ] && [ -z "$BACKUP_CMD" ]; then
  fail no_restore_point "Aucun point de restauration de la base : fournir --backup-cmd \"<commande de sauvegarde>\" ou, si une restauration à un instant donné est active et vérifiée, --pitr-confirmed."
fi
git diff --quiet && git diff --cached --quiet || fail precheck_dirty "Modifications locales non commitées : mise à jour annulée (voir git status)."
git fetch "$REMOTE" --tags --prune --quiet || fail precheck_fetch "Impossible de joindre le dépôt $REMOTE."
git rev-parse --verify --quiet "refs/remotes/$REMOTE/$BRANCH" >/dev/null || fail precheck_branch "Branche $REMOTE/$BRANCH introuvable."
FROM="$(pkg_version < package.json)"; FROM_SHA="$(git rev-parse HEAD)"
TO_SHA="$(git rev-parse "refs/remotes/$REMOTE/$BRANCH")"; TO="$(git show "$TO_SHA:package.json" | pkg_version)"
echo "ACRA (profil ha) : $FROM → $TO (canal $CHANNEL, $REMOTE/$BRANCH)"
if [ "$FROM_SHA" = "$TO_SHA" ]; then echo "Déjà à jour."; journal DONE "" "Déjà à jour"; exit 0; fi
git merge-base --is-ancestor "$FROM_SHA" "$TO_SHA" || fail precheck_not_ff "Historique local divergent de $REMOTE/$BRANCH : avance rapide impossible, rien n'a été modifié."

# Migrations « contract » entre la version installée et la cible (règle expand/contract).
CONTRACTS=""
for f in $(git diff --name-only "$FROM_SHA" "$TO_SHA" -- prisma/migrations | grep '/migration\.sql$' || true); do
  if git show "$TO_SHA:$f" 2>/dev/null | grep -Eq '^--[[:space:]]*(contract:|acra:destructive)'; then CONTRACTS="$CONTRACTS $(basename "$(dirname "$f")")"; fi
done
if [ -n "$CONTRACTS" ]; then
  echo "⚠ Migrations « contract » entre $FROM et $TO :$CONTRACTS" >&2
  [ "$ALLOW_CONTRACT" -eq 1 ] || fail contract_in_range "Migrations « contract » à appliquer ($CONTRACTS ) : vérifier que la version $FROM n'utilise plus ce qu'elles suppriment (sinon passer d'abord par la version intermédiaire), puis relancer avec --allow-contract."
fi

# Réplicas en service : tous démarrés, sur une seule et même image.
CURRENT="$(app_containers)"
[ -n "$CURRENT" ] || fail precheck_no_replica "Aucun réplica « app » : démarrer d'abord l'instance (docker compose $ACRA_COMPOSE_FILES up -d)."
OLD_IMAGE=""; COUNT=0
for c in $CURRENT; do
  c_running "$c" || fail precheck_stopped_replica "Réplica ${c:0:12} arrêté : le supprimer (docker rm ${c:0:12}) ou le redémarrer avant la mise à jour."
  img="$(c_image "$c")"; [ -z "$OLD_IMAGE" ] || [ "$img" = "$OLD_IMAGE" ] || fail precheck_mixed "Réplicas sur des images différentes (mise à jour précédente inachevée ?) : rétablir une seule version avant de continuer."
  OLD_IMAGE="$img"; COUNT=$(( COUNT + 1 ))
done
FIRST="$(printf '%s\n' "$CURRENT" | head -1)"
OLD_REV="$(c_health "$FIRST" | sed -n 's/.*"revision":"\([^"]*\)".*/\1/p' | head -1)"
health_ok "$(c_health "$FIRST")" "${OLD_REV:-x}" || fail precheck_unhealthy "Le réplica ${FIRST:0:12} n'est pas sain : corriger avant de mettre à jour."
N="${REPLICAS:-$COUNT}"
echo "Réplicas en service : $COUNT (visé : $N) ; révision servie : $OLD_REV"
if [ "$YES" -ne 1 ]; then
  read -r -p "Continuer (migrations appliquées pendant que $FROM reste en service) ? [o/N] " a
  case "$a" in o|O|y|Y) ;; *) fail precheck_cancelled "Annulé par l'exploitant." ;; esac
fi
# Image en service conservée sous une étiquette fixe : le retour arrière ne dépend ni d'une reconstruction ni de son étiquette d'origine.
docker image tag "$OLD_IMAGE" "$ROLLBACK_TAG" >/dev/null 2>&1 || fail precheck_tag "Impossible d'étiqueter l'image en service (retour arrière non garanti) : rien n'a été modifié."

# ── BACKUP : point de restauration de la base EXTERNE ────────────────────────────────────────────────
journal BACKUP
if [ -n "$BACKUP_CMD" ]; then
  echo "Sauvegarde de la base : $BACKUP_CMD"
  bash -c "$BACKUP_CMD" || fail backup_failed "Sauvegarde de la base en échec : rien n'a été modifié."
  RP_KIND="backup-cmd"
else
  RP_KIND="pitr"
fi
RP_AT="$(iso)"
journal BACKUP "" "Point de restauration : $RP_KIND à $RP_AT"
echo "Point de restauration : $RP_KIND, instant $RP_AT (cible d'une restauration à un instant donné si nécessaire)."

# ── FETCH ─────────────────────────────────────────────────────────────────────────────────────────────
journal FETCH
reset_code() { git reset --hard -q "$FROM_SHA" || true; }
if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then git checkout -q "$BRANCH" || fail fetch_failed "Changement de branche impossible."
  else git checkout -q -b "$BRANCH" --track "$REMOTE/$BRANCH" || fail fetch_failed "Changement de branche impossible."; fi
fi
git merge --ff-only -q "$REMOTE/$BRANCH" || { reset_code; fail fetch_failed "Mise à jour du code impossible : code d'origine rétabli."; }

# ── BUILD (les réplicas en service ne sont pas touchés) ──────────────────────────────────────────────
journal BUILD
export ACRA_VERSION="v$TO" ACRA_REVISION="$TO_SHA"
if ! quiet "${COMPOSE[@]}" config -q; then reset_code; fail config_invalid "Configuration de la version $TO invalide (variable obligatoire absente ?) : code d'origine rétabli, rien d'autre n'a changé."; fi
if ! quiet "${COMPOSE[@]}" build app migrator; then reset_code; fail build_failed "Construction de l'image $TO en échec : code d'origine rétabli, rien d'autre n'a changé."; fi
NEW_IMAGE="$(docker image inspect --format '{{.Id}}' "acra-app:$ACRA_VERSION" 2>/dev/null || true)"
[ -n "$NEW_IMAGE" ] || { reset_code; fail build_failed "Image acra-app:$ACRA_VERSION introuvable après construction."; }
[ "$NEW_IMAGE" != "$OLD_IMAGE" ] || { reset_code; fail build_failed "L'image construite est identique à l'image en service."; }

# À partir d'ici, un signal n'interrompt pas la mise à jour : elle va jusqu'au succès ou au retour arrière.
trap 'echo "⚠ Signal reçu : la mise à jour se termine d’abord (retour arrière automatique si nécessaire)." >&2' INT TERM HUP

# ── MIGRATE : une seule fois, pendant que l'ancienne version sert ────────────────────────────────────
journal MIGRATE
export ACRA_MIGRATE_AUTO_RESOLVE=0   # jamais de « migrate resolve » automatique pendant une mise à jour
if ! quiet "${COMPOSE[@]}" run --rm --no-deps migrator; then
  reset_code
  fail migrate_failed "Migration en échec : la version $FROM reste en service (réplicas inchangés). La base n'est PAS restaurée automatiquement (des écritures continuent) : diagnostic docs/runbook-exploitation.md § 2 ; si une restauration s'impose, cible : $RP_KIND à $RP_AT."
fi
event "HA_MIGRATED $FROM $TO $RP_KIND $RP_AT $(iso)"

# ── ROLL : remplacement un par un ─────────────────────────────────────────────────────────────────────
journal ROLL
echo "Remplacement progressif de $COUNT réplica(s) par $N réplica(s) $TO…"
if ! roll_to "$NEW_IMAGE" "$TO_SHA" "$N"; then
  journal ROLLBACK health_failed "Réplica $TO non sain : retour des réplicas à $FROM."
  echo "Retour arrière : remise en service de $FROM, réplica par réplica…" >&2
  reset_code
  export ACRA_VERSION="ha-rollback" ACRA_REVISION="$OLD_REV"
  if roll_to "$OLD_IMAGE" "$OLD_REV" "$COUNT"; then
    event "HA_ROLLED_BACK $TO $FROM health_failed $(iso)"
    journal ROLLED_BACK health_failed "Mise à jour vers $TO annulée : $FROM de nouveau en service sur tous les réplicas. Migrations de $TO conservées (compatibles « expand »)."
    echo "✗ Mise à jour annulée : $FROM de nouveau en service. Les migrations de $TO restent appliquées (règle expand/contract)." >&2
    exit 1
  fi
  journal ROLLBACK_FAILED rollback_failed "Retour arrière incomplet : vérifier les réplicas (docker compose ps app)."
  cat >&2 <<EOF
✗ Retour arrière incomplet. Les réplicas sains restent en service ; à faire à la main (dossier d'ACRA) :
  docker compose $ACRA_COMPOSE_FILES ps app          # images et état de chaque réplica
  ACRA_VERSION=ha-rollback docker compose $ACRA_COMPOSE_FILES up -d --no-deps --no-build --no-recreate --scale app=$COUNT app
  docker rm -f <réplica de l'image $TO>               # un par un, après santé des réplicas $FROM
  (docs/deploiement-haute-disponibilite.md, « Mise à jour sans interruption » ; docs/runbook-exploitation.md § 6)
EOF
  exit 1
fi

# ── FINALIZE ──────────────────────────────────────────────────────────────────────────────────────────
journal FINALIZE
# Planificateur : sans trafic utilisateur, recréé pour prendre le script de la nouvelle version (non bloquant).
quiet "${COMPOSE[@]}" up -d --no-deps --no-build --force-recreate scheduler || echo "⚠ Planificateur non recréé (non bloquant) : docker compose $ACRA_COMPOSE_FILES up -d --no-deps scheduler" >&2
if ! git diff --quiet "$FROM_SHA" "$TO_SHA" -- Caddyfile.ha; then
  echo "⚠ Caddyfile.ha a changé : le frontal n'est PAS rechargé automatiquement (coupure de quelques secondes). À une heure calme :" >&2
  echo "    docker compose $ACRA_COMPOSE_FILES up -d --no-deps --force-recreate caddy" >&2
fi
printf 'ACRA_VERSION=v%s\nACRA_REVISION=%s\n' "$TO" "$TO_SHA" > "$HA_DIR/version.env"; chmod 644 "$HA_DIR/version.env"
# Images : on garde la cible et l'image précédente (étiquette ha-rollback) ; les autres étiquettes acra-app sont retirées.
while IFS= read -r tag; do
  case "$tag" in ''|"<none>"|"v$TO"|ha-rollback) continue ;; esac
  [ "$(docker image inspect --format '{{.Id}}' "acra-app:$tag" 2>/dev/null)" != "$OLD_IMAGE" ] || continue
  docker image rm "acra-app:$tag" >/dev/null 2>&1 || true
done < <(docker image ls acra-app --format '{{.Tag}}' 2>/dev/null || true)
event "HA_UPDATED $FROM $TO $(iso)"
journal DONE "" "Mise à jour terminée : $N réplica(s) $TO en service."
echo "✓ ACRA $TO en service sur $N réplica(s), sans interruption. Pour toute commande docker compose ultérieure : set -a; . $HA_DIR/version.env; set +a"
