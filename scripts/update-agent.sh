#!/usr/bin/env bash
# ─── Agent de mise à jour ACRA (côté hôte) — issue #185 ──────────────────────
# Exécute les demandes de mise à jour déposées par l'interface d'administration
# (bouton « Mettre à jour »). L'application ne lance aucune commande : elle dépose
# `.acra-update/inbox/request.json` ; cet agent n'en lit QUE le canal (stable|beta),
# puis appelle scripts/update.sh. Il publie une pulsation et l'avancement.
#
# Installation (une fois, dans le dossier d'ACRA, avec l'utilisateur qui pilote Docker) :
#   scripts/update-agent.sh --install [--no-cron] [-f docker-compose.yml -f docker-compose.production.yml]
# L'installation ajoute elle-même la ligne cron (exécution chaque minute), sauf
# --no-cron. Désinstallation : scripts/update-agent.sh --uninstall.
# Variable de test : ACRA_CRONTAB (commande crontab, défaut : crontab).
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=".acra-update"
INBOX="$DIR/inbox"
ENV_FILE="$DIR/agent.env"
CRONTAB="${ACRA_CRONTAB:-crontab}"
MARK="# acra-update-agent $(pwd)"

# Lignes de la crontab hors celle de cet agent (grep -v renvoie 1 si rien ne reste).
cron_others() { { "$CRONTAB" -l 2>/dev/null || true; } | { grep -vF "$MARK" || true; }; }
cron_remove() { cron_others | "$CRONTAB" -; }

if [ "${1:-}" = "--uninstall" ]; then
  command -v "$CRONTAB" >/dev/null 2>&1 && cron_remove
  rm -f "$DIR/agent.json" "$ENV_FILE"
  echo "Agent désinstallé (ligne cron retirée). Le bouton affichera de nouveau les commandes."
  exit 0
fi

if [ "${1:-}" = "--install" ]; then
  shift
  CRON=1; COMPOSE_ARGS=()
  for a in "$@"; do
    if [ "$a" = "--no-cron" ]; then CRON=0; else COMPOSE_ARGS+=("$a"); fi
  done
  # Si Docker a démarré avant l'installation, il a pu créer le dossier en root.
  if [ -e "$DIR" ] && [ ! -w "$DIR" ]; then
    echo "Le dossier $DIR n'est pas modifiable par $(id -un) (créé par Docker en root ?)." >&2
    echo "Corriger puis relancer : sudo chown -R $(id -u):$(id -g) $DIR && scripts/update-agent.sh --install ${*:-}" >&2
    exit 1
  fi
  mkdir -p "$INBOX"
  chmod 755 "$DIR"
  # Le conteneur (utilisateur 1001) peut y DÉPOSER un fichier, sans lister ni
  # supprimer ceux des autres (sticky bit) ; l'agent, propriétaire, les supprime.
  chmod 1733 "$INBOX"
  printf 'ACRA_COMPOSE_FILES=%q\n' "${COMPOSE_ARGS[*]:-}" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  printf '{"at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DIR/agent.json"
  if ! docker info >/dev/null 2>&1; then
    echo "⚠ $(id -un) ne peut pas piloter Docker : l'ajouter au groupe docker, ou installer l'agent en root (sudo scripts/update-agent.sh --install)." >&2
  fi
  # cron a un PATH minimal : on fige celui de l'installation (docker, git).
  LINE="* * * * * cd $(printf %q "$(pwd)") && PATH=$(printf %q "$PATH") scripts/update-agent.sh >> $DIR/agent.log 2>&1 $MARK"
  if [ "$CRON" -eq 1 ] && command -v "$CRONTAB" >/dev/null 2>&1; then
    { cron_others; echo "$LINE"; } | "$CRONTAB" -
    echo "✓ Agent installé et planifié (cron, chaque minute)."
  else
    echo "Agent installé. Ajouter cette ligne à la crontab de cet utilisateur (crontab -e) :"
    echo "$LINE"
  fi
  echo "Si l'application tournait déjà, la redémarrer pour monter le dossier : docker compose ${COMPOSE_ARGS[*]:-} up -d"
  echo "Le bouton « Mettre à jour » (Administration → Version) est actif sous 1 minute."
  exit 0
fi

[ -d "$INBOX" ] || { echo "Agent non installé : scripts/update-agent.sh --install" >&2; exit 1; }
# Pulsation : l'interface n'active le bouton que si l'agent s'est manifesté < 5 min.
printf '{"at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DIR/agent.json.tmp" && mv "$DIR/agent.json.tmp" "$DIR/agent.json"

# Pas de verrou d'exécution vivant : un journal d'exécution interrompu (kill, redémarrage de l'hôte) est REPRIS
# (retour arrière automatique) avant toute nouvelle demande — cf. docs/specs/sauvegarde-rollback-spec.md § 2.2.
RUN_CUR="$DIR/run/current.json"
if [ -f "$RUN_CUR" ]; then
  RUN_PID="$(cat "$DIR/run/lock/pid" 2>/dev/null || true)"
  if [ -z "$RUN_PID" ] || ! kill -0 "$RUN_PID" 2>/dev/null; then
    # shellcheck disable=SC1090
    [ -f "$ENV_FILE" ] && . "$ENV_FILE"
    export ACRA_COMPOSE_FILES="${ACRA_COMPOSE_FILES:-}"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] reprise d'une mise à jour interrompue"
    scripts/update.sh resume --status-file "$DIR/status.json" || true
  fi
fi

# Sauvegardes planifiées (quotidienne / hebdomadaire / mensuelle) : décidées et exécutées par scripts/acra-schedule.sh,
# appelé à chaque passage (cron, chaque minute) ; il ignore les passages sans échéance et ne s'exécute jamais pendant une mise à jour.
run_schedule() {
  [ -x scripts/acra-schedule.sh ] || return 0
  # shellcheck disable=SC1090
  [ -f "$ENV_FILE" ] && . "$ENV_FILE"
  export ACRA_COMPOSE_FILES="${ACRA_COMPOSE_FILES:-}"
  scripts/acra-schedule.sh tick >> "$DIR/schedule.log" 2>&1 || true
}

# Mesure de l'hôte Docker (`docker system df`), publiée au plus une fois par heure pour la supervision du stockage.
# Seuls les 4 types connus sont retenus ; les valeurs sont réduites à [A-Za-z0-9.%() ] (aucun nom d'image ni chemin).
publish_host_stats() {
  local f="$DIR/host-stats.json"
  [ -z "$(find "$DIR" -maxdepth 1 -name host-stats.json -mmin -60 2>/dev/null | head -1)" ] || return 0
  command -v docker >/dev/null 2>&1 || return 0
  local out rows="" line t sz rc first=1
  out="$(docker system df --format '{{.Type}}|{{.Size}}|{{.Reclaimable}}' 2>/dev/null)" || return 0
  while IFS= read -r line; do
    t="${line%%|*}"; line="${line#*|}"; sz="${line%%|*}"; rc="${line#*|}"
    case "$t" in Images|Containers|"Local Volumes"|"Build Cache") ;; *) continue ;; esac
    sz="$(printf '%s' "$sz" | tr -cd 'A-Za-z0-9.%() ')"; rc="$(printf '%s' "$rc" | tr -cd 'A-Za-z0-9.%() ')"
    [ "$first" -eq 1 ] || rows="$rows,"; first=0
    rows="$rows{\"type\":\"$t\",\"size\":\"$sz\",\"reclaimable\":\"$rc\"}"
  done <<EOF_ROWS
$out
EOF_ROWS
  [ -n "$rows" ] || return 0
  printf '{"schema":1,"at":"%s","rows":[%s]}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$rows" > "$f.tmp" && chmod 644 "$f.tmp" && mv "$f.tmp" "$f"
}
publish_host_stats

REQ="$INBOX/request.json"
[ -f "$REQ" ] || { run_schedule; exit 0; }

# Verrou portable (mkdir atomique) : une seule mise à jour à la fois.
LOCK="$DIR/.lock"
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK"' EXIT

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
invalid() { printf '{"state":"FAILED","message":"Demande invalide ignorée","code":"invalid_request","at":"%s"}\n' "$(now)" > "$DIR/status.json"; exit 0; }
# Seuls l'action, le canal et l'identifiant de point sont lus, chacun validé contre une liste fermée
# (ou, pour l'identifiant, contre l'index publié par scripts/acra-snapshot.sh) ; le reste est ignoré.
BODY="$(head -c 4096 "$REQ")"
rm -f "$REQ"
field() { printf '%s' "$BODY" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1; }
ACTION="$(field action)"; ACTION="${ACTION:-update}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
export ACRA_COMPOSE_FILES="${ACRA_COMPOSE_FILES:-}"

case "$ACTION" in
  update)
    CHANNEL="$(field channel)"
    case "$CHANNEL" in stable|beta) ;; *) invalid ;; esac
    echo "[$(now)] mise à jour demandée : canal $CHANNEL"
    scripts/update.sh "$CHANNEL" --yes --status-file "$DIR/status.json" || true ;;
  rollback)
    SNAP="$(field snapshotId)"
    ID_RE='^[0-9]{8}T[0-9]{6}Z-(pre-update|manual|scheduled)-[0-9A-Za-z.+-]{1,40}$'
    printf '%s' "$SNAP" | grep -Eq "$ID_RE" || invalid
    # L'identifiant doit exister dans l'index de l'AGENT (l'application n'est pas digne de confiance sur ce point).
    SNAP_RE="$(printf '%s' "$SNAP" | sed 's/[.+]/\\&/g')"
    { [ -f "$DIR/snapshots.json" ] && grep -Eq "\"id\"[[:space:]]*:[[:space:]]*\"$SNAP_RE\"" "$DIR/snapshots.json"; } || invalid
    echo "[$(now)] retour arrière demandé : point $SNAP"
    scripts/update.sh rollback "$SNAP" --yes --status-file "$DIR/status.json" || true ;;
  backup-policy)
    # Politique de sauvegarde : chaque valeur est relue puis validée (booléen, bornes) ; rien d'autre n'est lu ni exécuté.
    D="$(printf '%s' "$BODY" | sed -n 's/.*"daily":{"enabled":\([a-z]*\),"keep":\([0-9]*\)}.*/\1 \2/p' | head -1)"
    W="$(printf '%s' "$BODY" | sed -n 's/.*"weekly":{"enabled":\([a-z]*\),"keep":\([0-9]*\),"weekday":\([0-9]*\)}.*/\1 \2 \3/p' | head -1)"
    M="$(printf '%s' "$BODY" | sed -n 's/.*"monthly":{"enabled":\([a-z]*\),"keep":\([0-9]*\),"day":\([0-9]*\)}.*/\1 \2 \3/p' | head -1)"
    H="$(printf '%s' "$BODY" | sed -n 's/.*"hour":\([0-9]*\).*/\1/p' | head -1)"
    # shellcheck disable=SC2086
    set -- $D; D_EN="${1:-}"; D_KEEP="${2:-}"
    # shellcheck disable=SC2086
    set -- $W; W_EN="${1:-}"; W_KEEP="${2:-}"; W_DAY="${3:-}"
    # shellcheck disable=SC2086
    set -- $M; M_EN="${1:-}"; M_KEEP="${2:-}"; M_DAY="${3:-}"
    ok_bool() { [ "$1" = "true" ] || [ "$1" = "false" ]; }
    ok_int() { printf '%s' "$1" | grep -Eq '^[0-9]{1,2}$' && [ "$1" -ge "$2" ] && [ "$1" -le "$3" ]; }
    { ok_bool "$D_EN" && ok_bool "$W_EN" && ok_bool "$M_EN" && ok_int "$D_KEEP" 1 60 && ok_int "$W_KEEP" 1 60 && ok_int "$M_KEEP" 1 60 \
      && ok_int "$W_DAY" 0 6 && ok_int "$M_DAY" 1 28 && ok_int "$H" 0 23; } || { echo "[$(now)] politique de sauvegarde invalide ignorée" >&2; exit 0; }
    [ "$D_EN" = true ] || [ "$W_EN" = true ] || [ "$M_EN" = true ] || { echo "[$(now)] politique sans aucune fréquence ignorée" >&2; exit 0; }
    printf '{\n  "schema": 1,\n  "daily": { "enabled": %s, "keep": %s },\n  "weekly": { "enabled": %s, "keep": %s, "weekday": %s },\n  "monthly": { "enabled": %s, "keep": %s, "day": %s },\n  "hour": %s\n}\n' \
      "$D_EN" "$((10#$D_KEEP))" "$W_EN" "$((10#$W_KEEP))" "$((10#$W_DAY))" "$M_EN" "$((10#$M_KEEP))" "$((10#$M_DAY))" "$((10#$H))" > "$DIR/backup-policy.json.tmp"
    chmod 644 "$DIR/backup-policy.json.tmp"; mv "$DIR/backup-policy.json.tmp" "$DIR/backup-policy.json"
    echo "[$(now)] politique de sauvegarde mise à jour"
    run_schedule ;;
  backup-prune)
    # Liste exacte d'identifiants : chacun validé (format) ET présent dans l'index de l'AGENT ; la rétention n'est pas recalculée ici.
    ID_RE='^[0-9]{8}T[0-9]{6}Z-(pre-update|manual|scheduled)-[0-9A-Za-z.+-]{1,40}$'
    IDS="$(printf '%s' "$BODY" | sed -n 's/.*"ids":\[\([^]]*\)\].*/\1/p' | head -1 | tr -d '"' | tr ',' ' ')"
    [ -n "$IDS" ] || invalid
    LIST=""
    for ONE in $IDS; do
      printf '%s' "$ONE" | grep -Eq "$ID_RE" || invalid
      ONE_RE="$(printf '%s' "$ONE" | sed 's/[.+]/\\&/g')"
      { [ -f "$DIR/snapshots.json" ] && grep -Eq "\"id\"[[:space:]]*:[[:space:]]*\"$ONE_RE\"" "$DIR/snapshots.json"; } || invalid
      LIST="${LIST:+$LIST,}$ONE"
    done
    echo "[$(now)] suppression de points de restauration demandée : $LIST"
    scripts/acra-snapshot.sh prune --ids "$LIST" >> "$DIR/prune.log" 2>&1 || echo "[$(now)] suppression en échec (voir prune.log)" >&2
    scripts/acra-schedule.sh stats >> "$DIR/schedule.log" 2>&1 || true ;;
  *) invalid ;;
esac
