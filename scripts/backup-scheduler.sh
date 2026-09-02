#!/bin/sh
# ─── Planificateur de sauvegardes PostgreSQL ─────────────────────────────────
# Exécute /backup.sh :
#   • une fois immédiatement au démarrage (garantit un backup récent) ;
#   • puis une fois par jour à l'heure BACKUP_HOUR (défaut 02h).
# Sémantique proche de cron via un tick régulier + garde par jour (anti-doublon).
# Utilisé par le service `backup` de docker-compose.yml (restart: unless-stopped).
#
# Variables :
#   BACKUP_HOUR       heure (0-23, 2 chiffres) de la sauvegarde quotidienne (défaut 02)
#   BACKUP_TICK       intervalle de vérification en secondes (défaut 1800 = 30 min)
#   BACKUP_RETENTION  jours de rétention (transmis à backup.sh, défaut 7)
#   BACKUP_OFFSITE_CMD commande de copie hors-site (voir backup.sh)
set -u

BACKUP_HOUR="${BACKUP_HOUR:-02}"
TICK="${BACKUP_TICK:-1800}"

echo "[backup-sched] démarre — sauvegarde quotidienne à ${BACKUP_HOUR}h (tick ${TICK}s, rétention ${BACKUP_RETENTION:-7}j)"

# Sauvegarde immédiate au démarrage (ne jamais rester sans backup récent).
sh /backup.sh || echo "[backup-sched] $(date '+%F %T') backup initial en échec (poursuite)"

last_day=""
while true; do
  day="$(date +%Y%m%d)"
  hour="$(date +%H)"
  if [ "$hour" = "$BACKUP_HOUR" ] && [ "$last_day" != "$day" ]; then
    if sh /backup.sh; then
      last_day="$day"
    else
      echo "[backup-sched] $(date '+%F %T') backup quotidien en échec (nouvelle tentative au prochain tick)"
    fi
  fi
  sleep "$TICK"
done
