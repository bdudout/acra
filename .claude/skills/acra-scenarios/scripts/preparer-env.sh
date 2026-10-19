#!/bin/bash
# ─── Préparation automatique de l'environnement de recette (tests par scénarios) ───
# Idempotent, sans intervention : Docker Desktop → conteneur Postgres `ebios_db` →
# migrations + client Prisma → serveur de dev :3005 → comptes de recette.
# Sortie : une ligne « ETAT … » par étape, puis « PRET url=… » ou « ECHEC étape=… ».
# Le serveur lancé ici est noté dans .acra-test-memory/runner/dev-3005.pid
# (à arrêter en fin de run avec arreter-env.sh ; un serveur déjà présent n'est pas touché).
set -uo pipefail

REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
MEM="$REPO/.acra-test-memory"
RUN="$MEM/runner"
LOG="$RUN/dev-3005.log"
PORT=3005
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
mkdir -p "$RUN"
cd "$REPO" || { echo "ECHEC etape=repo"; exit 1; }

echec() { echo "ECHEC etape=$1 ${2:-}"; exit 1; }

# 1. Docker Desktop
if ! docker info >/dev/null 2>&1; then
  echo "ETAT docker=demarrage"
  open -ga Docker 2>/dev/null || echec docker "Docker Desktop introuvable"
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 3; done
  docker info >/dev/null 2>&1 || echec docker "pas prêt après 3 min"
fi
echo "ETAT docker=ok"

# 2. Base Postgres seule (jamais `docker compose up` complet : reconstruit toutes les images)
docker start ebios_db >/dev/null 2>&1 || docker compose up -d db >/dev/null 2>&1 || echec db "conteneur ebios_db"
for _ in $(seq 1 40); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' ebios_db 2>/dev/null)" = "healthy" ] && break; sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' ebios_db 2>/dev/null)" = "healthy" ] || echec db "non sain"
echo "ETAT db=ok"

# 3. Environnement (sans rien afficher) : base sur localhost
set -a; . ./.env; set +a
export DATABASE_URL="${DATABASE_URL/@db:5432/@localhost:5432}"
export NEXTAUTH_URL="http://localhost:$PORT" AUTH_URL="http://localhost:$PORT"

# 4. Migrations + client Prisma (le client est régénéré si le schéma a changé)
npx prisma migrate deploy >"$RUN/migrate.log" 2>&1 || echec migrations "voir runner/migrate.log"
SUM="$(shasum prisma/schema.prisma | cut -d' ' -f1)"
SCHEMA_CHANGE=0
if [ "$(cat "$RUN/schema.sha" 2>/dev/null)" != "$SUM" ]; then
  npx prisma generate >/dev/null 2>&1 || echec prisma-generate
  echo "$SUM" > "$RUN/schema.sha"; SCHEMA_CHANGE=1
fi
echo "ETAT migrations=ok schema_regenere=$SCHEMA_CHANGE"

# 5. Serveur de dev :3005 (redémarré seulement s'il a été lancé par ce script et que le client a changé)
EN_ECOUTE="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1)"
if [ -n "$EN_ECOUTE" ] && [ "$SCHEMA_CHANGE" = 1 ] && [ "$(cat "$RUN/dev-3005.pid" 2>/dev/null)" = "$EN_ECOUTE" ]; then
  kill "$EN_ECOUTE" 2>/dev/null; sleep 3; EN_ECOUTE=""
fi
if [ -z "$EN_ECOUTE" ]; then
  nohup npx next dev -p $PORT >"$LOG" 2>&1 &
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
[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://localhost:$PORT/api/health)" = "200" ] || echec serveur "health KO, voir runner/dev-3005.log"
# Premier rendu de la page de connexion (compilation à froid) avant d'ouvrir le navigateur
curl -s -o /dev/null --max-time 120 http://localhost:$PORT/auth/signin
echo "ETAT serveur=ok"

# 6. Comptes de recette (mot de passe commun du fichier + SUPER_ADMIN de recette)
[ -f "$MEM/recette-roles.json" ] || echec comptes "recette-roles.json absent"
node "$REPO/.claude/skills/acra-scenarios/scripts/comptes-recette.mjs" "$MEM/recette-roles.json" >"$RUN/comptes.log" 2>&1 \
  || echec comptes "voir runner/comptes.log"
echo "ETAT comptes=ok ($(grep -c '^✓' "$RUN/comptes.log"))"

echo "PRET url=http://localhost:$PORT"
