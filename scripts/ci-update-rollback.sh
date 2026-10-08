#!/usr/bin/env bash
# ─── Scénarios de mise à jour / retour arrière sur Docker réel (CI) — lot 5 de docs/specs/sauvegarde-rollback-spec.md ───
# 1. démarre la version STABLE précédente avec des données ; 2. point de restauration + restauration (comptes identiques) ;
# 3. mise à jour vers le commit de la PR (santé approfondie, document présent) ; 4. migration fautive ⇒ retour arrière automatique ;
# 5. `kill -9` pendant MIGRATE puis reprise par l'agent ⇒ retour arrière terminé.
# NON exécuté en local lors de sa rédaction (Docker indisponible) : à valider sur la première exécution de la CI.
set -Eeuo pipefail
WORK=/tmp/acra-ci; rm -rf "$WORK"; mkdir -p "$WORK"
PR_SHA="$(git rev-parse HEAD)"
SNAPSHOT_SCRIPT="$(cd "$(dirname "$0")" && pwd)/acra-snapshot.sh"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
# Appliquée à toutes les commandes compose du banc, y compris celles du lanceur
# et de l'agent de reprise. La cible peut surcharger l'identité via ACRA_REVISION.
export COMPOSE_FILE="docker-compose.yml:.acra-update/ci-identity.yml"
ORIGIN="$WORK/origin.git"
git clone -q --bare . "$ORIGIN"
git -C "$ORIGIN" update-ref refs/heads/main "$PR_SHA"
# La « stable » précédente : dernière release stable publiée, sinon le premier commit parent de la PR.
PREV="$(git rev-parse origin/stable 2>/dev/null || git rev-parse "$PR_SHA~1")"
git -C "$ORIGIN" update-ref refs/heads/stable "$PREV"

fail() { echo "✗ $*" >&2; exit 1; }
step() { echo; echo "── $*"; }
setup_instance() { # dossier
  rm -rf "$1"; git clone -q "$ORIGIN" "$1"; git -C "$1" checkout -q stable
  ( cd "$1"
    # Créer le bind mount côté hôte avant Compose : sinon Docker le crée en root
    # et le script de snapshot ne peut plus publier snapshots.json après arrêt de l'app.
    mkdir -p .acra-update; chmod 700 .acra-update
    bash "$SCRIPTS_DIR/ci-update-identity.sh" "$PREV" > .acra-update/ci-identity.yml
    cat > .env <<EOF
POSTGRES_USER=acra
POSTGRES_PASSWORD=ci-password
POSTGRES_DB=acra_ci
DATABASE_URL=postgresql://acra:ci-password@db:5432/acra_ci
NEXTAUTH_SECRET=ci-secret-ci-secret-ci-secret-ci-secret-ci-secret
NEXTAUTH_URL=http://localhost:3000
SECRETS_ENCRYPTION_KEY=ci-key-ci-key-ci-key-ci-key-ci-key-ci-key
EOF
    export COMPOSE_PROJECT_NAME="acraci$(basename "$1")"
    docker compose up -d --build --wait app )
}
run_target_update() { # dossier, arguments du lanceur cible
  ( cd "$1"
    ACRA_UPDATE_REEXEC=1 ACRA_ROOT="$PWD" \
    ACRA_UPDATE_LIB_PATH="$SCRIPTS_DIR/update-lib.sh" \
    ACRA_SNAPSHOT_SCRIPT="$SCRIPTS_DIR/acra-snapshot.sh" \
    ACRA_UPDATE_VERBOSE=1 \
    ACRA_HEALTH_RETRIES=6 ACRA_HEALTH_INTERVAL=1 \
    bash "$SCRIPTS_DIR/update.sh" "${@:2}" )
}
count() { ( cd "$1"; export COMPOSE_PROJECT_NAME="acraci$(basename "$1")"; docker compose exec -T db psql -U acra -d acra_ci -tA -c "SELECT (SELECT count(*) FROM \"User\")||'/'||(SELECT count(*) FROM \"_prisma_migrations\")" ); }
doc() { ( cd "$1"; export COMPOSE_PROJECT_NAME="acraci$(basename "$1")"; docker compose exec -T app sh -c 'mkdir -p /app/.data/documents && echo ci-document > /app/.data/documents/ci.txt' ); }
has_doc() { ( cd "$1"; export COMPOSE_PROJECT_NAME="acraci$(basename "$1")"; docker compose exec -T app cat /app/.data/documents/ci.txt | grep -q ci-document ); }
status_of() { sed -n "s/.*\"$2\":\"\{0,1\}\([^\",]*\).*/\1/p" "$1/.acra-update/status.json" | head -1; }
down() { ( cd "$1"; export COMPOSE_PROJECT_NAME="acraci$(basename "$1")"; docker compose down -v >/dev/null 2>&1 || true ); }

step "1-2. Version précédente, point de restauration et restauration"
A="$WORK/a"; setup_instance "$A"; doc "$A"
before="$(count "$A")"
export COMPOSE_PROJECT_NAME="acraci$(basename "$A")"
( cd "$A"; docker compose stop app >/dev/null
  # La version source peut précéder le lot snapshot : le script est celui livré
  # par la révision cible, comme lors d'une première mise à jour réelle.
  cp "$SNAPSHOT_SCRIPT" scripts/acra-snapshot.sh; chmod +x scripts/acra-snapshot.sh
  ID="$(bash scripts/acra-snapshot.sh create --reason manual --verify full)"
  bash scripts/acra-snapshot.sh restore "$ID" --yes
  docker compose up -d --wait app )
[ "$(count "$A")" = "$before" ] || fail "comptes différents après restauration"
down "$A"

step "3. Mise à jour vers le commit de la PR"
B="$WORK/b"; setup_instance "$B"; doc "$B"
( export COMPOSE_PROJECT_NAME="acraci$(basename "$B")"; run_target_update "$B" beta --yes --status-file .acra-update/status.json ) || fail "mise à jour en échec"
[ "$(status_of "$B" state)" = SUCCESS ] || fail "statut non SUCCESS"
has_doc "$B" || fail "document perdu par la mise à jour"
down "$B"

step "4. Migration fautive : retour arrière automatique"
C="$WORK/c"; setup_instance "$C"; doc "$C"; before="$(count "$C")"
git clone -q "$ORIGIN" "$WORK/inject"; ( cd "$WORK/inject"; git checkout -q main; mkdir -p prisma/migrations/99999999999999_ci_fail; echo 'SELECT 1/0;' > prisma/migrations/99999999999999_ci_fail/migration.sql
  git -c user.name=ci -c user.email=ci@ci add -A; git -c user.name=ci -c user.email=ci@ci commit -q -m "ci: migration fautive"; git push -q origin HEAD:refs/heads/main )
( export COMPOSE_PROJECT_NAME="acraci$(basename "$C")"; run_target_update "$C" beta --yes --status-file .acra-update/status.json ) && fail "la mise à jour fautive aurait dû échouer" || true
[ "$(status_of "$C" rolledBack)" = true ] || fail "pas de retour arrière"
[ "$(count "$C")" = "$before" ] || fail "comptes différents après retour arrière"
has_doc "$C" || fail "document perdu par le retour arrière"
down "$C"

step "5. kill -9 pendant MIGRATE puis reprise"
D="$WORK/d"; setup_instance "$D"; before="$(count "$D")"; P="acraci$(basename "$D")"
# Même environnement que run_target_update, mais dans son propre groupe de processus (setsid) : la panne simulée doit
# pouvoir tout arrêter d'un coup.
( cd "$D"; export COMPOSE_PROJECT_NAME="$P" ACRA_UPDATE_REEXEC=1 ACRA_ROOT="$D" ACRA_UPDATE_LIB_PATH="$SCRIPTS_DIR/update-lib.sh" \
    ACRA_SNAPSHOT_SCRIPT="$SCRIPTS_DIR/acra-snapshot.sh" ACRA_UPDATE_VERBOSE=1 ACRA_HEALTH_RETRIES=6 ACRA_HEALTH_INTERVAL=1
  setsid bash "$SCRIPTS_DIR/update.sh" beta --yes --status-file .acra-update/status.json >/dev/null 2>&1 & echo $! > "$WORK/upd.pid" )
for _ in $(seq 1 600); do grep -q '"state": "MIGRATE"' "$D/.acra-update/run/current.json" 2>/dev/null && break; sleep 1; done
# Panne simulée (coupure) : tout le groupe de processus de la mise à jour (lanceur, compose, construction) et les
# conteneurs éphémères qu'elle a lancés (compose run : migrateur) s'arrêtent net ; la base et ses volumes restent.
# Tuer seulement les enfants directs laissait des orphelins appliquer la migration après la restauration (CI instable).
kill -9 -- "-$(cat "$WORK/upd.pid")" 2>/dev/null || true
docker ps -q --filter "label=com.docker.compose.project=$P" --filter "label=com.docker.compose.oneoff=True" | xargs -r docker kill >/dev/null 2>&1 || true
( cd "$D"; export COMPOSE_PROJECT_NAME="acraci$(basename "$D")"; mkdir -p .acra-update/inbox; bash scripts/update-agent.sh ) || true
[ "$(status_of "$D" rolledBack)" = true ] || fail "reprise : pas de retour arrière"
[ "$(count "$D")" = "$before" ] || fail "reprise : comptes différents"
down "$D"
echo; echo "✓ Cinq scénarios passés."
