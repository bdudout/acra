#!/bin/bash
# ─── Préparation automatique de l'environnement de recette (tests par scénarios) ───
# Idempotent, sans intervention : Docker Desktop → conteneur Postgres `ebios_db` →
# migrations + client Prisma → serveur de dev :3005 → comptes de recette.
# Sortie : une ligne « ETAT … » par étape, puis « PRET url=… » ou « ECHEC étape=… ».
# Le serveur lancé ici est noté dans $TMPDIR/acra-recette/dev-3005.pid (journaux au même endroit)
# (à arrêter en fin de run avec arreter-env.sh ; un serveur déjà présent n'est pas touché).
set -uo pipefail

REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
MEM="$REPO/.acra-test-memory"
# Fichiers volatils HORS du dépôt : Next surveille l'arborescence du projet, un journal écrit
# dedans déclenche une recompilation et un rechargement de page à chaque ligne (boucle).
RUN="${TMPDIR:-/tmp}/acra-recette"
LOG="$RUN/dev-3005.log"
PORT=3005
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
mkdir -p "$RUN"
cd "$REPO" || { echo "ECHEC etape=repo"; exit 1; }

echec() { echo "ECHEC etape=$1 ${2:-}"; exit 1; }
# Borne de durée portable (pas de `timeout` sur macOS) : tue la commande après N secondes.
# Indispensable : un `docker …` peut attendre indéfiniment quand Docker Desktop est à moitié
# démarré, ce qui laisse la session planifiée « en cours » et bloque les runs suivants (20/10/2026).
borne() { local s="$1"; shift; perl -e 'alarm shift; exec @ARGV or exit 127' "$s" "$@"; }

# 0. Place disque : sous 3 Go libres, Docker et la compilation Next figent le Mac (HANDOFF 117)
LIBRE_GO="$(df -g "$REPO" | awk 'NR==2 {print $4}')"
[ "${LIBRE_GO:-0}" -ge 3 ] || echec espace "seulement ${LIBRE_GO:-?} Go libres (minimum 3)"
echo "ETAT disque_libre=${LIBRE_GO}Go"
rm -f "$RUN/docker-lance-par-recette" "$RUN/db-lancee-par-recette"

# Greffon docker-ai : il figeait toutes les commandes docker (HANDOFF 117, désactivé depuis).
# S'il réapparaît, l'arrêter et le signaler plutôt que de rester bloqué.
if pgrep -f docker-ai >/dev/null 2>&1; then
  pkill -f docker-ai 2>/dev/null; echo "ETAT docker_ai=arrete (à désactiver dans Docker Desktop)"
fi

# 1. Docker Desktop (noté s'il est lancé par la recette, pour l'arrêter en fin de run)
if ! borne 15 docker info >/dev/null 2>&1; then
  echo "ETAT docker=demarrage"
  touch "$RUN/docker-lance-par-recette"
  open -ga Docker 2>/dev/null || echec docker "Docker Desktop introuvable"
  for _ in $(seq 1 60); do borne 10 docker info >/dev/null 2>&1 && break; sleep 3; done
  borne 15 docker info >/dev/null 2>&1 || echec docker "pas prêt après 3 min"
fi
# Mémoire de la VM : 2 Go sur ce Mac de 8 Go (au-delà, swap et sessions figées). Pas de
# modification automatique des réglages Docker : un écart est signalé dans le rapport.
MEM_VM="$(borne 15 docker info --format '{{.MemTotal}}' 2>/dev/null || echo 0)"
MEM_MO=$(( ${MEM_VM:-0} / 1048576 ))
if [ "$MEM_MO" -gt 2300 ]; then echo "ETAT docker=ok memoire=${MEM_MO}Mo ALERTE_au_dela_de_2Go"
else echo "ETAT docker=ok memoire=${MEM_MO}Mo"; fi

# 2. Base Postgres seule (jamais `docker compose up` complet : reconstruit toutes les images)
[ "$(borne 10 docker inspect -f '{{.State.Running}}' ebios_db 2>/dev/null)" = "true" ] || touch "$RUN/db-lancee-par-recette"
borne 60 docker start ebios_db >/dev/null 2>&1 || borne 120 docker compose up -d db >/dev/null 2>&1 || echec db "conteneur ebios_db"
for _ in $(seq 1 40); do
  [ "$(borne 10 docker inspect -f '{{.State.Health.Status}}' ebios_db 2>/dev/null)" = "healthy" ] && break; sleep 2
done
[ "$(borne 10 docker inspect -f '{{.State.Health.Status}}' ebios_db 2>/dev/null)" = "healthy" ] || echec db "non sain"
echo "ETAT db=ok"

# 3. Environnement (sans rien afficher) : base sur localhost
set -a; . ./.env; set +a
export DATABASE_URL="${DATABASE_URL/@db:5432/@localhost:5432}"
export NEXTAUTH_URL="http://localhost:$PORT" AUTH_URL="http://localhost:$PORT"

# 4. Migrations + client Prisma (le client est régénéré si le schéma a changé)
borne 180 npx prisma migrate deploy </dev/null >"$RUN/migrate.log" 2>&1 || echec migrations "voir $RUN/migrate.log"
SUM="$(shasum prisma/schema.prisma | cut -d' ' -f1)"
SCHEMA_CHANGE=0
if [ "$(cat "$RUN/schema.sha" 2>/dev/null)" != "$SUM" ]; then
  borne 240 npx prisma generate </dev/null >/dev/null 2>&1 || echec prisma-generate
  echo "$SUM" > "$RUN/schema.sha"; SCHEMA_CHANGE=1
fi
echo "ETAT migrations=ok schema_regenere=$SCHEMA_CHANGE"

# 5. Serveur de dev :3005 (redémarré seulement s'il a été lancé par ce script et que le client a changé)
EN_ECOUTE="$(borne 10 lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1)"
if [ -n "$EN_ECOUTE" ] && [ "$SCHEMA_CHANGE" = 1 ] && [ "$(cat "$RUN/dev-3005.pid" 2>/dev/null)" = "$EN_ECOUTE" ]; then
  kill "$EN_ECOUTE" 2>/dev/null; sleep 3; EN_ECOUTE=""
fi
if [ -z "$EN_ECOUTE" ]; then
  nohup npx next dev -p $PORT </dev/null >"$LOG" 2>&1 &
  echo $! > "$RUN/dev-3005.pid"
  echo "ETAT serveur=demarrage"
else
  echo "ETAT serveur=deja_present pid=$EN_ECOUTE"
  # Serveur lancé par quelqu'un d'autre : il garde l'ancien client Prisma si le schéma a changé.
  [ "$SCHEMA_CHANGE" = 1 ] && echo "ETAT serveur=client_prisma_perime (redémarrer ce serveur, sinon erreurs « Unknown field »)"
fi
for _ in $(seq 1 90); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://localhost:$PORT/api/health)" = "200" ] && break; sleep 2
done
[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://localhost:$PORT/api/health)" = "200" ] || echec serveur "health KO, voir $LOG"
# Premier rendu de la page de connexion (compilation à froid) avant d'ouvrir le navigateur
curl -s -o /dev/null --max-time 120 http://localhost:$PORT/auth/signin
echo "ETAT serveur=ok"

# 6. Comptes de recette (mot de passe commun du fichier + SUPER_ADMIN de recette)
[ -f "$MEM/recette-roles.json" ] || echec comptes "recette-roles.json absent"
borne 90 node "$REPO/.claude/skills/acra-scenarios/scripts/comptes-recette.mjs" "$MEM/recette-roles.json" >"$RUN/comptes.log" 2>&1 \
  || echec comptes "voir $RUN/comptes.log"
echo "ETAT comptes=ok ($(grep -c '^✓' "$RUN/comptes.log"))"

echo "PRET url=http://localhost:$PORT"
