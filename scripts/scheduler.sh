#!/bin/sh
# =============================================================================
# ACRA — Planificateur des tâches périodiques (/api/cron/*)
# =============================================================================
# Utilisé par le service « scheduler » de docker-compose.yml. Appelle les
# endpoints cron de l'app EN INTERNE (http://app:3000) avec le CRON_SECRET.
#
# Cadence :
#   • conformite-snapshots : quotidien à 02:00 (snapshots auto de conformité)
#   • relances              : quotidien à 06:00 — UN e-mail de synthèse par personne : questionnaires,
#                             préconisations, plans d'action, recommandations d'audit, contrôles à
#                             exécuter, dérogations arrivant à expiration, vérifications et validations
#                             en attente (remplace controles-echeances, audit-rappels, derogations-expiry,
#                             dont les routes restent des alias idempotents)
#   • rapports-planifies    : quotidien à 05:00 (brouillons de rapports planifiés, les 1er–3 du mois)
#   • derogations-digest    : mensuel, le 1er à 08:00 (synthèse par organisation)
#
# Sémantique proche de cron via un tick régulier + garde par jour/mois (anti-
# doublon en mémoire). Les endpoints sont de toute façon IDEMPOTENTS. Le service
# « demo-purge » n'est PAS planifié ici : il est propre au mode démo
# (docker-compose.demo.yml embarque son propre planificateur horaire).
# =============================================================================
set -u

APP_URL="${APP_URL:-http://app:3000}"
TICK="${SCHEDULER_TICK:-900}"   # intervalle de vérification (s) — 15 min par défaut

# Sans secret, les endpoints répondraient 503 : on reste vivant mais inactif
# (évite une boucle de redémarrage du conteneur) et on le signale clairement.
if [ -z "${CRON_SECRET:-}" ]; then
  echo "[scheduler] CRON_SECRET absent → planification INACTIVE (les endpoints /api/cron/* répondraient 503)."
  echo "[scheduler] Renseignez CRON_SECRET dans .env pour activer les tâches planifiées."
  while true; do sleep 3600; done
fi

hit() {
  code=$(curl -fsS -o /dev/null -w '%{http_code}' -X POST \
    -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/cron/$1" 2>/dev/null)
  if [ -n "${code:-}" ]; then
    echo "[scheduler] $(date '+%F %T') $1 -> HTTP ${code}"
  else
    echo "[scheduler] $(date '+%F %T') $1 -> echec (app injoignable ?)"
  fi
}

echo "[scheduler] demarre — tick ${TICK}s, cible ${APP_URL}"
echo "[scheduler] planning : webhooks-dispatch chaque tick · snapshots 02:00 · relances 06:00 · derogations-digest 1er 08:00"

last_snap=""; last_rap=""; last_dig=""; last_rel=""
while true; do
  day="$(date +%Y%m%d)"; month="$(date +%Y%m)"; hour="$(date +%H)"; dom="$(date +%d)"

  # Livraison des webhooks sortants : à chaque tick (file idempotente, backoff interne).
  hit webhooks-dispatch

  [ "$hour" = "02" ] && [ "$last_snap" != "$day" ]   && { hit conformite-snapshots; last_snap="$day"; }
  [ "$hour" = "05" ] && [ "$last_rap"  != "$day" ]   && { hit rapports-planifies;   last_rap="$day"; }
  [ "$hour" = "06" ] && [ "$last_rel"  != "$day" ]   && { hit relances;             last_rel="$day"; }
  [ "$hour" = "08" ] && [ "$dom" = "01" ] && [ "$last_dig" != "$month" ] && { hit derogations-digest; last_dig="$month"; }

  sleep "$TICK"
done
