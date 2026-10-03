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

REQ="$INBOX/request.json"
[ -f "$REQ" ] || exit 0

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
  *) invalid ;;
esac
