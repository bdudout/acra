#!/bin/sh
# ─── Planificateur de sauvegardes PostgreSQL ─────────────────────────────────
# Exécute /backup.sh :
#   • une fois au démarrage, SAUF si un dump de moins de 20 h existe déjà (évite un dump par `docker compose up`) ;
#   • puis une fois par jour à l'heure BACKUP_HOUR (défaut 02h).
# Sémantique proche de cron via un tick régulier + garde par jour (anti-doublon).
# Utilisé par le service `backup` de docker-compose.yml (restart: unless-stopped).
#
# Variables :
#   BACKUP_HOUR       heure (0-23, 2 chiffres) de la sauvegarde quotidienne (défaut 02)
#   BACKUP_TICK       intervalle de vérification en secondes (défaut 1800 = 30 min)
#   BACKUP_KEEP       nombre de dumps conservés (transmis à backup.sh, défaut 7)
#   BACKUP_RETENTION  ancienne règle (jours), utilisée seulement sans BACKUP_KEEP
#   BACKUP_OFFSITE_CMD commande de copie hors-site (voir backup.sh)
set -u

BACKUP_HOUR="${BACKUP_HOUR:-02}"
TICK="${BACKUP_TICK:-1800}"

BACKUP_SCRIPT="${BACKUP_SCRIPT:-/backup.sh}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
echo "[backup-sched] démarre — sauvegarde quotidienne à ${BACKUP_HOUR}h (tick ${TICK}s, rétention ${BACKUP_KEEP:-7} dumps)"

# Sauvegarde au démarrage seulement si aucun dump récent (< 20 h = 1200 min) : ne jamais rester sans backup récent, sans en ajouter un à chaque redémarrage.
if [ -n "$(find "${BACKUP_DIR}" -maxdepth 1 -name 'ebios_*.sql.gz' -mmin -1200 2>/dev/null | head -1)" ]; then
  echo "[backup-sched] dump récent (< 20 h) présent : pas de sauvegarde au démarrage"
else
  sh "${BACKUP_SCRIPT}" || echo "[backup-sched] $(date '+%F %T') backup initial en échec (poursuite)"
fi
[ "${BACKUP_SCHED_ONCE:-0}" = "1" ] && exit 0

last_day=""
while true; do
  day="$(date +%Y%m%d)"
  hour="$(date +%H)"
  if [ "$hour" = "$BACKUP_HOUR" ] && [ "$last_day" != "$day" ]; then
    if sh "${BACKUP_SCRIPT}"; then
      last_day="$day"
    else
      echo "[backup-sched] $(date '+%F %T') backup quotidien en échec (nouvelle tentative au prochain tick)"
    fi
  fi
  sleep "$TICK"
done
