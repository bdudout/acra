#!/usr/bin/env bash
# ─── Agent de mise à jour ACRA (côté hôte) — issue #185 ──────────────────────
# Exécute les demandes de mise à jour déposées par l'interface d'administration
# (bouton « Mettre à jour »). L'application ne lance aucune commande : elle dépose
# `.acra-update/inbox/request.json` ; cet agent n'en lit QUE le canal (stable|beta),
# puis appelle scripts/update.sh. Il publie une pulsation et l'avancement.
#
# Installation (une fois, dans le dossier d'ACRA, avec l'utilisateur qui gère Docker) :
#   scripts/update-agent.sh --install [-f docker-compose.yml -f docker-compose.production.yml]
# puis ajouter la ligne cron affichée (exécution chaque minute).
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=".acra-update"
INBOX="$DIR/inbox"
ENV_FILE="$DIR/agent.env"

if [ "${1:-}" = "--install" ]; then
  shift
  mkdir -p "$INBOX"
  chmod 755 "$DIR"
  # Le conteneur (utilisateur 1001) peut y DÉPOSER un fichier, sans lister ni
  # supprimer ceux des autres (sticky bit) ; l'agent, propriétaire, les supprime.
  chmod 1733 "$INBOX"
  printf 'ACRA_COMPOSE_FILES=%q\n' "${*:-}" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  printf '{"at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DIR/agent.json"
  echo "Agent installé. Ajoutez cette ligne à la crontab de cet utilisateur (crontab -e) :"
  echo "* * * * * cd $(pwd) && scripts/update-agent.sh >> $DIR/agent.log 2>&1"
  echo "Puis redémarrez l'application pour monter le dossier : docker compose ${*:-} up -d"
  exit 0
fi

[ -d "$INBOX" ] || { echo "Agent non installé : scripts/update-agent.sh --install" >&2; exit 1; }
# Pulsation : l'interface n'active le bouton que si l'agent s'est manifesté < 5 min.
printf '{"at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DIR/agent.json.tmp" && mv "$DIR/agent.json.tmp" "$DIR/agent.json"

REQ="$INBOX/request.json"
[ -f "$REQ" ] || exit 0

# Verrou portable (mkdir atomique) : une seule mise à jour à la fois.
LOCK="$DIR/.lock"
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK"' EXIT

# Seul le canal est lu, puis validé contre une liste fermée ; le reste est ignoré.
CHANNEL="$(head -c 4096 "$REQ" | sed -n 's/.*"channel"[[:space:]]*:[[:space:]]*"\([a-z]*\)".*/\1/p' | head -1)"
rm -f "$REQ"
case "$CHANNEL" in
  stable|beta) ;;
  *) printf '{"state":"FAILED","message":"Demande invalide ignorée","at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DIR/status.json"; exit 0 ;;
esac

# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
export ACRA_COMPOSE_FILES="${ACRA_COMPOSE_FILES:-}"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] mise à jour demandée : canal $CHANNEL"
scripts/update.sh "$CHANNEL" --yes --status-file "$DIR/status.json" || true
