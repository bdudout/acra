#!/bin/bash
# ─── Arrêt propre de l'environnement de recette (libère RAM et CPU) ───
# N'arrête QUE ce que preparer-env.sh a lui-même démarré :
#   1. le serveur de dev :3005 ;
#   2. le conteneur ebios_db (arrêt Postgres propre, `docker stop`) ;
#   3. Docker Desktop (VM de 2 Go rendue au Mac de 8 Go, cf. HANDOFF 117).
# Un serveur, une base ou un Docker déjà lancés par l'utilisateur ou un autre agent restent en place.
# Ne jamais réduire le disque virtuel ni « Reset » Docker : cela effacerait la base.
set -uo pipefail
RUN="${TMPDIR:-/tmp}/acra-recette"
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
borne() { local s="$1"; shift; perl -e 'alarm shift; exec @ARGV or exit 127' "$s" "$@"; }

# 1. Serveur de dev
PIDF="$RUN/dev-3005.pid"
if [ -f "$PIDF" ]; then
  PID="$(cat "$PIDF")"
  if kill -0 "$PID" 2>/dev/null; then
    pkill -P "$PID" 2>/dev/null; kill "$PID" 2>/dev/null
    echo "ETAT serveur=arrete pid=$PID"
  else
    echo "ETAT serveur=deja_arrete"
  fi
  rm -f "$PIDF"
else
  echo "ETAT serveur=non_lance_par_la_recette"
fi

# 2. Base Postgres
sleep 2
if [ -f "$RUN/db-lancee-par-recette" ] && pgrep -f "next dev" >/dev/null 2>&1; then
  # Un autre serveur ACRA (session de dev) utilise encore la base : la laisser.
  echo "ETAT db=laissee (un autre serveur next dev tourne)"
  rm -f "$RUN/db-lancee-par-recette" "$RUN/docker-lance-par-recette"
elif [ -f "$RUN/db-lancee-par-recette" ]; then
  if borne 60 docker stop ebios_db >/dev/null 2>&1; then echo "ETAT db=arretee"
  else echo "ETAT db=arret_impossible (à vérifier : docker ps)"; fi
  rm -f "$RUN/db-lancee-par-recette"
else
  echo "ETAT db=laissee (déjà lancée avant la recette)"
fi

# 3. Docker Desktop
AUTRES="$(borne 15 docker ps --format '{{.Names}}' 2>/dev/null | grep -vx ebios_db | tr '\n' ' ')"
if [ -f "$RUN/docker-lance-par-recette" ] && [ -n "$AUTRES" ]; then
  # Un autre projet ou agent s'est servi de Docker entre-temps : ne pas couper ses conteneurs.
  echo "ETAT docker=laisse (autres conteneurs actifs : $AUTRES)"
  rm -f "$RUN/docker-lance-par-recette"
elif [ -f "$RUN/docker-lance-par-recette" ]; then
  borne 90 docker desktop stop >/dev/null 2>&1 || osascript -e 'quit app "Docker"' >/dev/null 2>&1
  for _ in $(seq 1 30); do pgrep -x com.docker.backend >/dev/null 2>&1 || break; sleep 2; done
  if pgrep -x com.docker.backend >/dev/null 2>&1; then
    echo "ETAT docker=arret_incomplet (com.docker.backend encore actif : le signaler, ne pas forcer)"
  else
    echo "ETAT docker=arrete"
  fi
  rm -f "$RUN/docker-lance-par-recette"
else
  echo "ETAT docker=laisse (déjà lancé avant la recette)"
fi
