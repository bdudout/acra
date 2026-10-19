#!/bin/bash
# Arrête le serveur de dev :3005 SEULEMENT s'il a été lancé par preparer-env.sh
# (un serveur lancé par l'utilisateur ou un autre agent est laissé tel quel).
# La base Postgres reste démarrée.
PIDF="${TMPDIR:-/tmp}/acra-recette/dev-3005.pid"
[ -f "$PIDF" ] || { echo "ETAT serveur=non_lance_par_la_recette"; exit 0; }
PID="$(cat "$PIDF")"
if kill -0 "$PID" 2>/dev/null; then
  pkill -P "$PID" 2>/dev/null; kill "$PID" 2>/dev/null
  echo "ETAT serveur=arrete pid=$PID"
else
  echo "ETAT serveur=deja_arrete"
fi
rm -f "$PIDF"
