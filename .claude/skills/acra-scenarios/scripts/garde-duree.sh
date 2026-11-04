#!/bin/bash
# ─── Garde de durée du run de recette (2 h max) ───
#   garde-duree.sh debut   → note l'heure de début du run
#   garde-duree.sh verif   → affiche « ECOULE=<min> DECISION=continuer|finir|arreter »
# Seuils : ≥ 90 min → finir (plus de nouveau scénario) ; ≥ 110 min → arreter (rapport partiel).
# Script dédié (plutôt qu'un `date > fichier`) pour pouvoir l'autoriser à l'avance :
# une demande d'autorisation sans personne devant l'écran fige la tâche planifiée.
RUN="${TMPDIR:-/tmp}/acra-recette"; F="$RUN/debut-run"
mkdir -p "$RUN"
case "${1:-verif}" in
  debut) date +%s > "$F"; echo "DEBUT=$(date '+%H:%M')";;
  verif)
    [ -f "$F" ] || { date +%s > "$F"; echo "ECOULE=0 DECISION=continuer (début noté maintenant)"; exit 0; }
    M=$(( ($(date +%s) - $(cat "$F")) / 60 ))
    if [ "$M" -ge 110 ]; then D=arreter; elif [ "$M" -ge 90 ]; then D=finir; else D=continuer; fi
    echo "ECOULE=$M DECISION=$D";;
  *) echo "usage: $0 debut|verif"; exit 2;;
esac
